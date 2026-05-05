/**
 * Bisection test for occt-wasm parity gap (#90).
 *
 * Builds shapes step-by-step under both kernels and prints bounds + topology
 * counts at each stage to localise the divergence:
 *
 *   1. `box(42,42,42)` alone — primitive parity?
 *   2. `translate(box, 0,0,0)` — does the no-op transform shift bounds?
 *      (Targets Lead 1: BRepBuilderAPI_Transform 3-arg vs 4-arg + Shape() vs ModifiedShape())
 *   3. `translate(box, 1.21, 0, 0)` — does a real translate shift correctly?
 *   4. `box - cylinder` cut (single boolean) — primitive boolean parity?
 *
 * Run:
 *   pnpm exec vitest run --config vitest.profile.config.ts \
 *     src/features/generation/worker/generators/__kernel-tests__/occtWasmBisect
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import {
  withKernel,
  getBounds,
  box,
  cylinder,
  translate,
  cut,
  fillet,
  chamfer,
  measureVolume,
  sketchRectangle,
  sketchExtrude,
  shell,
  isOk,
  unwrap,
  describe as describeSolid,
  getFaces,
} from 'brepjs';
import type { Shape3D } from 'brepjs';
import { initOcctKernel, initOcctWasmKernel } from './kernelInit';

interface BBox {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  zMin: number;
  zMax: number;
}

interface StepReport {
  bounds: BBox;
  cx: number; // bbox center X (diagnostic for shift)
  cy: number;
  cz: number;
}

function unwrapShape<T>(maybe: T | { ok: boolean }): T {
  if (
    maybe &&
    typeof maybe === 'object' &&
    'ok' in maybe &&
    isOk(maybe as Parameters<typeof isOk>[0])
  ) {
    return unwrap(maybe as Parameters<typeof unwrap>[0]) as T;
  }
  return maybe as T;
}

function reportBounds(b: BBox): StepReport {
  return {
    bounds: b,
    cx: (b.xMin + b.xMax) / 2,
    cy: (b.yMin + b.yMax) / 2,
    cz: (b.zMin + b.zMax) / 2,
  };
}

function step1_makeBox(kernelId: 'occt' | 'occt-wasm'): StepReport {
  const b = withKernel(kernelId, () => box(42, 42, 42));
  const bb = withKernel(kernelId, () => getBounds(b)) as BBox;
  return reportBounds(bb);
}

function step2_translateZero(kernelId: 'occt' | 'occt-wasm'): StepReport {
  const b = withKernel(kernelId, () => box(42, 42, 42));
  const t = withKernel(kernelId, () => translate(b, [0, 0, 0]));
  const bb = withKernel(kernelId, () => getBounds(t as Shape3D)) as BBox;
  return reportBounds(bb);
}

function step3_translateX(kernelId: 'occt' | 'occt-wasm'): StepReport {
  const b = withKernel(kernelId, () => box(42, 42, 42));
  const t = withKernel(kernelId, () => translate(b, [1.21, 0, 0]));
  const bb = withKernel(kernelId, () => getBounds(t as Shape3D)) as BBox;
  return reportBounds(bb);
}

interface DetailedStep extends StepReport {
  faceCount: number;
  edgeCount: number;
  vertexCount: number;
  volume: number;
}

function detailReport(kernelId: 'occt' | 'occt-wasm', solid: Shape3D): DetailedStep {
  const bb = withKernel(kernelId, () => getBounds(solid)) as BBox;
  const desc = withKernel(kernelId, () => describeSolid(solid));
  const volRaw = withKernel(kernelId, () => measureVolume(solid));
  const volume =
    typeof volRaw === 'number'
      ? volRaw
      : isOk(volRaw as Parameters<typeof isOk>[0])
        ? (unwrap(volRaw as Parameters<typeof unwrap>[0]) as number)
        : Number.NaN;
  return {
    ...reportBounds(bb),
    faceCount: desc.faceCount,
    edgeCount: desc.edgeCount,
    vertexCount: desc.vertexCount,
    volume,
  };
}

function step4_cylCut(kernelId: 'occt' | 'occt-wasm'): DetailedStep {
  const base = withKernel(kernelId, () => box(42, 42, 42));
  const tool = withKernel(kernelId, () => cylinder(5, 50));
  const result = withKernel(kernelId, () => cut(base, tool));
  const solid = unwrapShape<Shape3D>(result);
  return detailReport(kernelId, solid);
}

/** Chained boolean — cut three holes in the same box. Tests boolean state propagation. */
function step5_chainedCuts(kernelId: 'occt' | 'occt-wasm'): DetailedStep {
  let s = withKernel(kernelId, () => box(42, 42, 42)) as Shape3D;
  for (const xy of [
    [10, 10],
    [21, 21],
    [32, 32],
  ]) {
    const tool = withKernel(
      kernelId,
      () => translate(cylinder(3, 50), [xy[0], xy[1], 0]) as Shape3D
    );
    const r = withKernel(kernelId, () => cut(s, tool));
    s = unwrapShape<Shape3D>(r);
  }
  return detailReport(kernelId, s);
}

/** Fillet all edges of a box. Highly sensitive to OCCT-API differences. */
function step6_filletAll(kernelId: 'occt' | 'occt-wasm'): DetailedStep | { error: string } {
  try {
    const b = withKernel(kernelId, () => box(42, 42, 42));
    const r = withKernel(kernelId, () => fillet(b, 1.5));
    const solid = unwrapShape<Shape3D>(r);
    return detailReport(kernelId, solid);
  } catch (e) {
    return { error: String(e) };
  }
}

/** Chamfer all edges of a box. */
function step7_chamferAll(kernelId: 'occt' | 'occt-wasm'): DetailedStep | { error: string } {
  try {
    const b = withKernel(kernelId, () => box(42, 42, 42));
    const r = withKernel(kernelId, () => chamfer(b, 1.5));
    const solid = unwrapShape<Shape3D>(r);
    return detailReport(kernelId, solid);
  } catch (e) {
    return { error: String(e) };
  }
}

/** Sketch a rectangle on the XY plane and extrude it — exercises the 2D sketch pipeline. */
function step8_sketchExtrude(kernelId: 'occt' | 'occt-wasm'): DetailedStep | { error: string } {
  try {
    const solid = withKernel(kernelId, () => {
      const sk = sketchRectangle(42, 42);
      return sketchExtrude(sk, 7);
    });
    return detailReport(kernelId, solid);
  } catch (e) {
    return { error: String(e) };
  }
}

/** Shell a box (hollow it with a wall thickness) — opens the top face. */
function step9_shellBox(kernelId: 'occt' | 'occt-wasm'): DetailedStep | { error: string } {
  try {
    const result = withKernel(kernelId, () => {
      const b = box(42, 42, 42);
      // Pick the top face (max z). brepjs `shell` accepts a finder fn.
      const faces = getFaces(b);
      // top face has all vertices at z=42; identify by bounds.zMax close to 42
      const topFace = faces.find((f) => {
        const fb = getBounds(f) as BBox;
        return Math.abs(fb.zMax - 42) < 0.01 && Math.abs(fb.zMin - 42) < 0.01;
      });
      if (!topFace) throw new Error('top face not found');
      return shell(b, [topFace], -1.5);
    });
    const solid = unwrapShape<Shape3D>(result);
    return detailReport(kernelId, solid);
  } catch (e) {
    return { error: String(e) };
  }
}

describe('occt-wasm bisection: primitive vs transform vs boolean', () => {
  let s1Occt: StepReport;
  let s1Wasm: StepReport;
  let s2Occt: StepReport;
  let s2Wasm: StepReport;
  let s3Occt: StepReport;
  let s3Wasm: StepReport;
  let s4Occt: DetailedStep;
  let s4Wasm: DetailedStep;
  let s5Occt: DetailedStep;
  let s5Wasm: DetailedStep;
  let s6Occt: DetailedStep | { error: string };
  let s6Wasm: DetailedStep | { error: string };
  let s7Occt: DetailedStep | { error: string };
  let s7Wasm: DetailedStep | { error: string };
  let s8Occt: DetailedStep | { error: string };
  let s8Wasm: DetailedStep | { error: string };
  let s9Occt: DetailedStep | { error: string };
  let s9Wasm: DetailedStep | { error: string };

  beforeAll(async () => {
    await initOcctKernel();
    await initOcctWasmKernel();

    s1Occt = step1_makeBox('occt');
    s1Wasm = step1_makeBox('occt-wasm');
    s2Occt = step2_translateZero('occt');
    s2Wasm = step2_translateZero('occt-wasm');
    s3Occt = step3_translateX('occt');
    s3Wasm = step3_translateX('occt-wasm');
    s4Occt = step4_cylCut('occt');
    s4Wasm = step4_cylCut('occt-wasm');
    s5Occt = step5_chainedCuts('occt');
    s5Wasm = step5_chainedCuts('occt-wasm');
    s6Occt = step6_filletAll('occt');
    s6Wasm = step6_filletAll('occt-wasm');
    s7Occt = step7_chamferAll('occt');
    s7Wasm = step7_chamferAll('occt-wasm');
    s8Occt = step8_sketchExtrude('occt');
    s8Wasm = step8_sketchExtrude('occt-wasm');
    s9Occt = step9_shellBox('occt');
    s9Wasm = step9_shellBox('occt-wasm');
  }, 120_000);

  it('prints bisection report', () => {
    /* eslint-disable no-console */
    const fmt = (n: number) => n.toFixed(4).padStart(10);
    const fmtBB = (b: BBox) =>
      `x=[${fmt(b.xMin)},${fmt(b.xMax)}] y=[${fmt(b.yMin)},${fmt(b.yMax)}] z=[${fmt(b.zMin)},${fmt(b.zMax)}]`;
    const dC = (a: StepReport, b: StepReport) => ({
      dx: b.cx - a.cx,
      dy: b.cy - a.cy,
      dz: b.cz - a.cz,
    });

    console.log('\n=== OCCT-WASM BISECTION REPORT ===\n');
    console.log('STEP 1 — box(42,42,42):');
    console.log(
      `  occt:      ${fmtBB(s1Occt.bounds)}  center=(${fmt(s1Occt.cx)},${fmt(s1Occt.cy)},${fmt(s1Occt.cz)})`
    );
    console.log(
      `  occt-wasm: ${fmtBB(s1Wasm.bounds)}  center=(${fmt(s1Wasm.cx)},${fmt(s1Wasm.cy)},${fmt(s1Wasm.cz)})`
    );
    const d1 = dC(s1Occt, s1Wasm);
    console.log(`  delta:     dx=${fmt(d1.dx)} dy=${fmt(d1.dy)} dz=${fmt(d1.dz)}`);

    console.log('\nSTEP 2 — translate(box, [0,0,0]):');
    console.log(
      `  occt:      ${fmtBB(s2Occt.bounds)}  center=(${fmt(s2Occt.cx)},${fmt(s2Occt.cy)},${fmt(s2Occt.cz)})`
    );
    console.log(
      `  occt-wasm: ${fmtBB(s2Wasm.bounds)}  center=(${fmt(s2Wasm.cx)},${fmt(s2Wasm.cy)},${fmt(s2Wasm.cz)})`
    );
    const d2 = dC(s2Occt, s2Wasm);
    console.log(`  delta:     dx=${fmt(d2.dx)} dy=${fmt(d2.dy)} dz=${fmt(d2.dz)}`);

    console.log('\nSTEP 3 — translate(box, [1.21,0,0]):');
    console.log(
      `  occt:      ${fmtBB(s3Occt.bounds)}  center=(${fmt(s3Occt.cx)},${fmt(s3Occt.cy)},${fmt(s3Occt.cz)})`
    );
    console.log(
      `  occt-wasm: ${fmtBB(s3Wasm.bounds)}  center=(${fmt(s3Wasm.cx)},${fmt(s3Wasm.cy)},${fmt(s3Wasm.cz)})`
    );
    const d3 = dC(s3Occt, s3Wasm);
    console.log(`  delta:     dx=${fmt(d3.dx)} dy=${fmt(d3.dy)} dz=${fmt(d3.dz)}`);

    const fmtDetail = (d: DetailedStep) =>
      `${fmtBB(d.bounds)}  F/E/V=${d.faceCount}/${d.edgeCount}/${d.vertexCount}  vol=${d.volume.toFixed(2)}`;

    console.log('\nSTEP 4 — cut(box, cylinder(r=5,h=50)):');
    console.log(`  occt:      ${fmtDetail(s4Occt)}`);
    console.log(`  occt-wasm: ${fmtDetail(s4Wasm)}`);
    const d4 = dC(s4Occt, s4Wasm);
    console.log(
      `  delta:     dx=${fmt(d4.dx)} dy=${fmt(d4.dy)} dz=${fmt(d4.dz)}  Δfaces=${s4Wasm.faceCount - s4Occt.faceCount}  Δvol=${(s4Wasm.volume - s4Occt.volume).toFixed(2)}`
    );

    console.log('\nSTEP 5 — chained cut x3 (three cylinders out of one box):');
    console.log(`  occt:      ${fmtDetail(s5Occt)}`);
    console.log(`  occt-wasm: ${fmtDetail(s5Wasm)}`);
    const d5 = dC(s5Occt, s5Wasm);
    console.log(
      `  delta:     dx=${fmt(d5.dx)} dy=${fmt(d5.dy)} dz=${fmt(d5.dz)}  Δfaces=${s5Wasm.faceCount - s5Occt.faceCount}  Δvol=${(s5Wasm.volume - s5Occt.volume).toFixed(2)}`
    );

    const fmtMaybe = (s: DetailedStep | { error: string }) =>
      'error' in s ? `ERROR: ${s.error}` : fmtDetail(s);

    console.log('\nSTEP 6 — fillet(box, r=1.5) all edges:');
    console.log(`  occt:      ${fmtMaybe(s6Occt)}`);
    console.log(`  occt-wasm: ${fmtMaybe(s6Wasm)}`);
    if (!('error' in s6Occt) && !('error' in s6Wasm)) {
      const d6 = dC(s6Occt, s6Wasm);
      console.log(
        `  delta:     dx=${fmt(d6.dx)} dy=${fmt(d6.dy)} dz=${fmt(d6.dz)}  Δfaces=${s6Wasm.faceCount - s6Occt.faceCount}  Δvol=${(s6Wasm.volume - s6Occt.volume).toFixed(2)}`
      );
    }

    console.log('\nSTEP 7 — chamfer(box, d=1.5) all edges:');
    console.log(`  occt:      ${fmtMaybe(s7Occt)}`);
    console.log(`  occt-wasm: ${fmtMaybe(s7Wasm)}`);
    if (!('error' in s7Occt) && !('error' in s7Wasm)) {
      const d7 = dC(s7Occt, s7Wasm);
      console.log(
        `  delta:     dx=${fmt(d7.dx)} dy=${fmt(d7.dy)} dz=${fmt(d7.dz)}  Δfaces=${s7Wasm.faceCount - s7Occt.faceCount}  Δvol=${(s7Wasm.volume - s7Occt.volume).toFixed(2)}`
      );
    }

    console.log('\nSTEP 8 — sketchRectangle(42,42) → sketchExtrude(7):');
    console.log(`  occt:      ${fmtMaybe(s8Occt)}`);
    console.log(`  occt-wasm: ${fmtMaybe(s8Wasm)}`);
    if (!('error' in s8Occt) && !('error' in s8Wasm)) {
      const d8 = dC(s8Occt, s8Wasm);
      console.log(
        `  delta:     dx=${fmt(d8.dx)} dy=${fmt(d8.dy)} dz=${fmt(d8.dz)}  Δfaces=${s8Wasm.faceCount - s8Occt.faceCount}  Δvol=${(s8Wasm.volume - s8Occt.volume).toFixed(2)}`
      );
    }

    console.log('\nSTEP 9 — shell(box, [topFace], -1.5):');
    console.log(`  occt:      ${fmtMaybe(s9Occt)}`);
    console.log(`  occt-wasm: ${fmtMaybe(s9Wasm)}`);
    if (!('error' in s9Occt) && !('error' in s9Wasm)) {
      const d9 = dC(s9Occt, s9Wasm);
      console.log(
        `  delta:     dx=${fmt(d9.dx)} dy=${fmt(d9.dy)} dz=${fmt(d9.dz)}  Δfaces=${s9Wasm.faceCount - s9Occt.faceCount}  Δvol=${(s9Wasm.volume - s9Occt.volume).toFixed(2)}`
      );
    }

    console.log('\n========================================\n');

    // ── Verdict logic ──────────────────────────────────────────────────────
    const SHIFT_TOL = 0.01;
    const step1Diverges =
      Math.abs(d1.dx) > SHIFT_TOL || Math.abs(d1.dy) > SHIFT_TOL || Math.abs(d1.dz) > SHIFT_TOL;
    const step2NewShift =
      !step1Diverges &&
      (Math.abs(d2.dx) > SHIFT_TOL || Math.abs(d2.dy) > SHIFT_TOL || Math.abs(d2.dz) > SHIFT_TOL);
    const step3NewShift =
      !step1Diverges &&
      !step2NewShift &&
      (Math.abs(d3.dx) > SHIFT_TOL || Math.abs(d3.dy) > SHIFT_TOL || Math.abs(d3.dz) > SHIFT_TOL);
    const step4FaceDiverges = s4Occt.faceCount !== s4Wasm.faceCount;

    console.log('VERDICT:');
    if (step1Diverges) {
      console.log(
        '  → primitive `box()` itself diverges. NOT a transform issue. Look at BRepPrimAPI_MakeBox.'
      );
    } else if (step2NewShift) {
      console.log(
        '  → no-op translate shifts bounds. CONFIRMS Lead 1 (BRepBuilderAPI_Transform 3-arg/Shape() vs 4-arg/ModifiedShape()).'
      );
    } else if (step3NewShift) {
      console.log('  → real translate shifts wrong amount. Transform direction or magnitude bug.');
    } else {
      console.log(
        '  → primitive + translate match exactly. Shift originates downstream of these ops.'
      );
    }
    if (step4FaceDiverges) {
      console.log(
        `  → single-shot cut() face count diverges (${s4Occt.faceCount} → ${s4Wasm.faceCount}). Boolean op or implicit unification difference.`
      );
    } else {
      console.log(
        `  → single-shot cut() face count matches (${s4Occt.faceCount}). Booleans not the cause.`
      );
    }
    if (s5Occt.faceCount !== s5Wasm.faceCount || Math.abs(s5Wasm.volume - s5Occt.volume) > 0.01) {
      console.log(
        `  → chained cuts diverge (faces ${s5Occt.faceCount}→${s5Wasm.faceCount}, vol Δ=${(s5Wasm.volume - s5Occt.volume).toFixed(2)}). Boolean *chaining* introduces drift.`
      );
    } else {
      console.log(`  → chained cuts match. Boolean chaining is not the cause.`);
    }
    if ('error' in s6Occt || 'error' in s6Wasm) {
      console.log(
        `  → fillet errored: occt=${'error' in s6Occt ? 'FAIL' : 'ok'}, occt-wasm=${'error' in s6Wasm ? 'FAIL' : 'ok'}`
      );
    } else if (
      s6Occt.faceCount !== s6Wasm.faceCount ||
      Math.abs(s6Wasm.volume - s6Occt.volume) > 0.01
    ) {
      console.log(
        `  → fillet diverges (faces ${s6Occt.faceCount}→${s6Wasm.faceCount}, vol Δ=${(s6Wasm.volume - s6Occt.volume).toFixed(2)}). LIKELY CAUSE — fillet is the most OCCT-API-sensitive op.`
      );
    } else {
      console.log(`  → fillet matches. Not the cause.`);
    }
    if ('error' in s7Occt || 'error' in s7Wasm) {
      console.log(
        `  → chamfer errored: occt=${'error' in s7Occt ? 'FAIL' : 'ok'}, occt-wasm=${'error' in s7Wasm ? 'FAIL' : 'ok'}`
      );
    } else if (
      s7Occt.faceCount !== s7Wasm.faceCount ||
      Math.abs(s7Wasm.volume - s7Occt.volume) > 0.01
    ) {
      console.log(
        `  → chamfer diverges (faces ${s7Occt.faceCount}→${s7Wasm.faceCount}, vol Δ=${(s7Wasm.volume - s7Occt.volume).toFixed(2)}). Chamfer-API divergence.`
      );
    } else {
      console.log(`  → chamfer matches. Not the cause.`);
    }
    /* eslint-enable no-console */

    // Soft expectations — we want the report regardless of pass/fail.
    expect(s1Occt.bounds).toBeDefined();
    expect(s1Wasm.bounds).toBeDefined();
  });
});

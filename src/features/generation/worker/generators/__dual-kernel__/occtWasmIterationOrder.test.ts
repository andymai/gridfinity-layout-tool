/**
 * Validates the iteration-order hypothesis for #90.
 *
 * Premise: kernels produce equivalent shapes, but `getFaces` / `getEdges`
 * return them in different orders. If a downstream finder selects by index
 * or if a fillet/chamfer's order-dependent internal accumulation matters,
 * the same input shape would yield different output topology.
 *
 * Method: compare the *sorted* face property lists between kernels for
 * shapes built by `generateBin`-like operation chains. If sorted-by-centroid
 * lists match, the kernels truly produce equivalent geometry and only
 * iteration order differs.
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import {
  withKernel,
  box,
  cut,
  cylinder,
  translate,
  getFaces,
  faceCenter,
  measureArea,
  isOk,
  unwrap,
} from 'brepjs';
import type { Shape3D, Face } from 'brepjs';
import { initOcctKernel, initOcctWasmKernel } from './kernelInit';

interface FaceFingerprint {
  cx: number;
  cy: number;
  cz: number;
  area: number;
}

function asNumber(v: unknown): number {
  if (typeof v === 'number') return v;
  if (v && typeof v === 'object' && isOk(v as Parameters<typeof isOk>[0])) {
    return unwrap(v as Parameters<typeof unwrap>[0]) as number;
  }
  return Number.NaN;
}

function fingerprintFace(kernelId: 'occt' | 'occt-wasm', face: Face): FaceFingerprint {
  const c = withKernel(kernelId, () => faceCenter(face));
  const area = withKernel(kernelId, () => asNumber(measureArea(face)));
  return { cx: c[0], cy: c[1], cz: c[2], area };
}

/** Sort fingerprints lexicographically — canonical comparison key. */
function sortFingerprints(fps: FaceFingerprint[]): FaceFingerprint[] {
  return [...fps].sort((a, b) => {
    if (Math.abs(a.cx - b.cx) > 0.001) return a.cx - b.cx;
    if (Math.abs(a.cy - b.cy) > 0.001) return a.cy - b.cy;
    if (Math.abs(a.cz - b.cz) > 0.001) return a.cz - b.cz;
    return a.area - b.area;
  });
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

/**
 * Build "box minus three cylinders" — a multi-step boolean cascade with
 * predictable face count. Captures iteration order at each stage.
 */
function buildAndFingerprint(kernelId: 'occt' | 'occt-wasm'): {
  rawOrder: FaceFingerprint[];
  sortedOrder: FaceFingerprint[];
} {
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

  const faces = withKernel(kernelId, () => getFaces(s));
  const rawOrder = faces.map((f) => fingerprintFace(kernelId, f));
  const sortedOrder = sortFingerprints(rawOrder);
  return { rawOrder, sortedOrder };
}

describe('occt-wasm iteration order: same shape, different face traversal?', () => {
  let occtFps: ReturnType<typeof buildAndFingerprint>;
  let wasmFps: ReturnType<typeof buildAndFingerprint>;

  beforeAll(async () => {
    await initOcctKernel();
    await initOcctWasmKernel();
    occtFps = buildAndFingerprint('occt');
    wasmFps = buildAndFingerprint('occt-wasm');
  }, 120_000);

  it('reports raw vs sorted face fingerprint comparison', () => {
    const fmt = (f: FaceFingerprint) =>
      `(${f.cx.toFixed(2)},${f.cy.toFixed(2)},${f.cz.toFixed(2)})  area=${f.area.toFixed(2)}`;

    /* eslint-disable no-console */
    console.log('\n=== ITERATION-ORDER REPORT ===\n');
    console.log(
      `Face count: occt=${occtFps.rawOrder.length}  occt-wasm=${wasmFps.rawOrder.length}\n`
    );

    if (occtFps.rawOrder.length !== wasmFps.rawOrder.length) {
      console.log('Different face counts — kernels produce structurally different shapes here.');
      console.log('=== END ===');
      return;
    }

    let rawMatchCount = 0;
    let sortedMatchCount = 0;
    for (let i = 0; i < occtFps.rawOrder.length; i++) {
      const o = occtFps.rawOrder[i];
      const w = wasmFps.rawOrder[i];
      if (
        Math.abs(o.cx - w.cx) < 0.001 &&
        Math.abs(o.cy - w.cy) < 0.001 &&
        Math.abs(o.cz - w.cz) < 0.001 &&
        Math.abs(o.area - w.area) < 0.01
      ) {
        rawMatchCount++;
      }
      const os = occtFps.sortedOrder[i];
      const ws = wasmFps.sortedOrder[i];
      if (
        Math.abs(os.cx - ws.cx) < 0.001 &&
        Math.abs(os.cy - ws.cy) < 0.001 &&
        Math.abs(os.cz - ws.cz) < 0.001 &&
        Math.abs(os.area - ws.area) < 0.01
      ) {
        sortedMatchCount++;
      }
    }

    console.log(`Raw-order matches:    ${rawMatchCount} / ${occtFps.rawOrder.length}`);
    console.log(`Sorted-order matches: ${sortedMatchCount} / ${occtFps.rawOrder.length}\n`);

    console.log('Side-by-side raw order (first 10):');
    for (let i = 0; i < Math.min(10, occtFps.rawOrder.length); i++) {
      console.log(`  [${i}]  occt: ${fmt(occtFps.rawOrder[i])}`);
      console.log(`        wasm: ${fmt(wasmFps.rawOrder[i])}`);
    }

    console.log('\nVerdict:');
    if (rawMatchCount === occtFps.rawOrder.length) {
      console.log('  → faces match in raw order. No iteration-order divergence.');
    } else if (sortedMatchCount === occtFps.rawOrder.length) {
      console.log(
        '  → faces match WHEN SORTED but not in raw order. ITERATION ORDER DIFFERS — confirms hypothesis.'
      );
    } else if (sortedMatchCount > rawMatchCount) {
      console.log(
        `  → partial: ${sortedMatchCount - rawMatchCount} more matches when sorted. Order is part of the picture but shapes also differ.`
      );
    } else {
      console.log('  → kernels produce STRUCTURALLY different faces. Not an iteration issue.');
    }
    console.log('\n=================================\n');
    /* eslint-enable no-console */

    expect(occtFps.rawOrder.length).toBeGreaterThan(0);
  });
});

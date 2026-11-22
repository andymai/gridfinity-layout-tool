// @vitest-environment node
/**
 * Scenario tests for the connector fit-sample tray (calibration card).
 *
 * The tray builds one row for the selected connector style across a fit-offset
 * ladder, each cell a mated pair of abstract coupons, plus one shared loose
 * key/clip for the key/clip styles. Verified against the real OCCT kernel:
 *   1. every piece is a valid, positive-volume solid,
 *   2. the exported STL is watertight (each coupon's groove/pocket + embossed
 *      label fuse cleanly — no boundary/non-manifold edges) and bed-resting, and
 *   3. the piece count matches the selected style (5 pairs, +1 loose for key/clip).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import {
  box,
  getBounds,
  intersect,
  measureVolume,
  mesh,
  translate,
  unwrap,
  type Shape3D,
  type ValidSolid,
} from 'brepjs';
import type { ResolvedBaseplateParams } from '@/shared/types/bin';
import { isOk } from '@/core/result';
import { parseSTLBinary } from '@/shared/generation/stlParser';
import { GRIDFINITY } from '@/shared/constants/bin';
import { loadTestFonts } from '@/test/loadTestFonts';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { buildConnectorSampleTray, exportConnectorSample, LABEL_DEPTH } from './connectorSample';

beforeAll(async () => {
  await initBrepjs();
  // Without jetbrains-mono registered, buildTextSolid returns null and coupons
  // ship textless but still watertight — so the label assertion below would pass
  // on unlabeled output. Register it the way the worker does at init.
  await loadTestFonts(['jetbrains-mono']);
}, 60000);

const defaults = (overrides: Partial<ResolvedBaseplateParams> = {}): ResolvedBaseplateParams => ({
  width: 2,
  depth: 2,
  gridUnitMm: 42,
  magnetHoles: false,
  magnetDiameter: 6.5,
  magnetDepth: 2.4,
  paddingLeft: 0,
  paddingRight: 0,
  paddingFront: 0,
  paddingBack: 0,
  fractionalEdgeX: 'end',
  fractionalEdgeY: 'end',
  ...overrides,
});

/**
 * Volume of raised label that has no coupon material under it (mm³): the label
 * layer, lowered 0.3mm, must still lie inside the coupon. Text over a groove or
 * a pocket opening at the seam would block the mating part.
 */
function unsupportedLabelMm3(piece: Shape3D): number {
  const b = getBounds(piece);
  const slab = box(b.xMax - b.xMin + 2, b.yMax - b.yMin + 2, LABEL_DEPTH, {
    at: [(b.xMin + b.xMax) / 2, (b.yMin + b.yMax) / 2, 0.02 + LABEL_DEPTH / 2],
  });
  const layer = unwrap(intersect(piece as ValidSolid, slab));
  const lowered = translate(layer, [0, 0, -0.3]);
  const kept = intersect(piece as ValidSolid, lowered);
  const missing = vol(layer) - (kept.ok ? vol(kept.value) : 0);
  for (const s of [slab, layer, lowered, ...(kept.ok ? [kept.value] : [])]) s.delete();
  return missing;
}

/** Smallest XY gap between a coupon's raised label and the edge of its body (mm). */
function labelInsetMm(piece: Shape3D): number {
  const m = mesh(piece, { tolerance: 0.05, angularTolerance: 10 });
  const body = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
  const label = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
  for (let i = 0; i < m.vertices.length; i += 3) {
    const [x, y, z] = [m.vertices[i], m.vertices[i + 1], m.vertices[i + 2]];
    const box = z > 0.01 ? label : body;
    box.x0 = Math.min(box.x0, x);
    box.x1 = Math.max(box.x1, x);
    box.y0 = Math.min(box.y0, y);
    box.y1 = Math.max(box.y1, y);
  }
  return Math.min(label.x0 - body.x0, body.x1 - label.x1, label.y0 - body.y0, body.y1 - label.y1);
}

function analyze(stl: ArrayBuffer) {
  const parsed = parseSTLBinary(stl);
  if (!isOk(parsed)) throw new Error('STL parse failed');
  const { vertices } = parsed.value;
  const triangleCount = vertices.length / 9;
  const QUANTIZE = 1e4;
  const vKey = (x: number, y: number, z: number): string =>
    `${Math.round(x * QUANTIZE)},${Math.round(y * QUANTIZE)},${Math.round(z * QUANTIZE)}`;
  const eKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const edgeCount = new Map<string, number>();
  let minZ = Infinity,
    maxZ = -Infinity,
    hasNaN = false;
  for (let t = 0; t < triangleCount; t++) {
    const base = t * 9;
    const verts: Array<[number, number, number]> = [
      [vertices[base], vertices[base + 1], vertices[base + 2]],
      [vertices[base + 3], vertices[base + 4], vertices[base + 5]],
      [vertices[base + 6], vertices[base + 7], vertices[base + 8]],
    ];
    for (const [x, y, z] of verts) {
      if (Number.isNaN(x) || Number.isNaN(y) || Number.isNaN(z)) hasNaN = true;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
    const keys = verts.map(([x, y, z]) => vKey(x, y, z));
    for (let i = 0; i < 3; i++) {
      const k = eKey(keys[i], keys[(i + 1) % 3]);
      edgeCount.set(k, (edgeCount.get(k) ?? 0) + 1);
    }
  }
  let nonManifoldEdges = 0;
  let boundaryEdges = 0;
  for (const count of edgeCount.values()) {
    if (count === 1) boundaryEdges++;
    else if (count > 2) nonManifoldEdges++;
  }
  return { triangleCount, nonManifoldEdges, boundaryEdges, minZ, maxZ, hasNaN };
}

const vol = (s: Parameters<typeof measureVolume>[0]): number => {
  const r = measureVolume(s);
  if (!isOk(r)) throw new Error('measureVolume failed');
  return r.value;
};

describe('connectorSample — fit-sample tray', () => {
  const TEST_TIMEOUT_MS = 120_000;

  it(
    'builds only the selected style row of valid, positive-volume pieces',
    () => {
      // Integral tongue/groove styles: 5 offsets × 2 coupons, no loose part = 10.
      // `undefined` is the default integral dovetail.
      for (const style of [undefined, 'dovetail', 'puzzle'] as const) {
        const pieces = buildConnectorSampleTray(defaults({ connectorStyle: style }));
        try {
          expect(pieces, String(style)).toHaveLength(10);
          for (const piece of pieces) {
            const v = vol(piece);
            expect(Number.isFinite(v)).toBe(true);
            expect(v).toBeGreaterThan(0);
          }
        } finally {
          for (const p of pieces) p.delete();
        }
      }
    },
    TEST_TIMEOUT_MS
  );

  it(
    'adds one shared loose part for the key/clip styles',
    () => {
      // 5 offsets × 2 coupons + 1 shared loose part = 11.
      for (const style of ['dovetailKey', 'snapClip'] as const) {
        const pieces = buildConnectorSampleTray(defaults({ connectorStyle: style }));
        try {
          expect(pieces, style).toHaveLength(11);
          for (const piece of pieces) expect(vol(piece)).toBeGreaterThan(0);
        } finally {
          for (const p of pieces) p.delete();
        }
      }
    },
    TEST_TIMEOUT_MS
  );

  it.each(
    // The default nozzle, and the largest, where the openings reach furthest in.
    [undefined, 'puzzle', 'dovetailKey', 'snapClip'].flatMap((style) =>
      [0.4, 1.0].map((nozzle) => [style, nozzle] as const)
    )
  )(
    'keeps every label off the seam openings (%s, %s mm nozzle)',
    (style, nozzleSizeMm) => {
      const pieces = buildConnectorSampleTray(
        defaults({
          nozzleSizeMm,
          connectorStyle: style as ResolvedBaseplateParams['connectorStyle'],
        })
      );
      const coupons = pieces.filter((p) => getBounds(p).zMax > LABEL_DEPTH / 2);
      const missing = coupons.map((p) => unsupportedLabelMm3(p));
      for (const p of pieces) p.delete();
      expect(coupons.length).toBeGreaterThan(0);
      for (const v of missing) expect(v).toBeLessThan(0.01);
    },
    TEST_TIMEOUT_MS
  );

  it.each([0.2, 0.4, 0.6, 0.8, 1.0])(
    'embosses the offset on every coupon (%s mm nozzle)',
    (nozzleSizeMm) => {
      const pieces = buildConnectorSampleTray(defaults({ nozzleSizeMm }));
      // A coupon's top face is at z=0 before the tray's lift; its emboss rises
      // LABEL_DEPTH above that, so a textless coupon tops out at 0.
      const labeled = pieces.filter((p) => getBounds(p).zMax > LABEL_DEPTH / 2).length;
      // The coupon is sized to the digits' ink, so the label must also stay
      // inside it, clear of the edge, rather than hang over it.
      const inset = pieces.map((p) => labelInsetMm(p));
      for (const p of pieces) p.delete();
      expect(pieces.length).toBeGreaterThan(0);
      expect(labeled).toBe(pieces.length);
      for (const d of inset) expect(d).toBeGreaterThan(1);
    },
    TEST_TIMEOUT_MS
  );

  it.each([undefined, 'puzzle', 'dovetailKey', 'snapClip'] as const)(
    'exports a watertight, bed-resting, labeled STL tray (%s)',
    async (style) => {
      const { data, fileName } = await exportConnectorSample(
        defaults({ connectorStyle: style }),
        'stl'
      );
      const stats = analyze(data);
      expect(fileName).toBe('connector_fit_sample.stl');
      expect(stats.hasNaN, 'no NaN vertices').toBe(false);
      expect(stats.triangleCount, 'non-empty mesh').toBeGreaterThan(0);
      expect(stats.nonManifoldEdges, 'non-manifold edges').toBe(0);
      expect(stats.boundaryEdges, 'boundary edges').toBe(0);
      // Whole tray rests on the bed.
      expect(stats.minZ, 'rests on bed').toBeCloseTo(0, 1);
      // Watertightness alone passes even when every label silently drops, so
      // assert the emboss landed: a textless tray tops out at couponHeight
      // (SOCKET_HEIGHT, no magnet holes); a labeled one is LABEL_DEPTH higher.
      expect(stats.maxZ, 'coupons carry raised labels').toBeGreaterThan(
        GRIDFINITY.SOCKET_HEIGHT + LABEL_DEPTH / 2
      );
    },
    TEST_TIMEOUT_MS
  );

  it(
    'exports a watertight puzzle tray at max nozzle (near-collapsed neck)',
    async () => {
      // Worst case for the puzzle groove: the 1.0mm nozzle grows the base
      // clearance and the +0.10 column of the offset ladder rides on top, driving
      // the neck→head transition (PUZZLE_NECK_PROTRUSION) toward the wall plane
      // while the armpit fillets stay applied. The clamp in `puzzleOutline` must
      // keep the groove a valid, watertight solid rather than degenerate.
      const { data } = await exportConnectorSample(
        defaults({ connectorStyle: 'puzzle', nozzleSizeMm: 1.0 }),
        'stl'
      );
      const stats = analyze(data);
      expect(stats.hasNaN, 'no NaN vertices').toBe(false);
      expect(stats.triangleCount, 'non-empty mesh').toBeGreaterThan(0);
      expect(stats.nonManifoldEdges, 'non-manifold edges').toBe(0);
      expect(stats.boundaryEdges, 'boundary edges').toBe(0);
    },
    TEST_TIMEOUT_MS
  );

  it(
    'exports a non-empty STEP tray',
    async () => {
      const { data, fileName } = await exportConnectorSample(defaults(), 'step');
      expect(fileName).toBe('connector_fit_sample.step');
      expect(data.byteLength).toBeGreaterThan(0);
    },
    TEST_TIMEOUT_MS
  );

  it(
    'magnet-hole baseplates produce taller, still-valid coupons',
    () => {
      const pieces = buildConnectorSampleTray(defaults({ magnetHoles: true, magnetDepth: 2.4 }));
      try {
        expect(pieces).toHaveLength(10);
        for (const piece of pieces) {
          expect(vol(piece)).toBeGreaterThan(0);
        }
      } finally {
        for (const p of pieces) p.delete();
      }
    },
    TEST_TIMEOUT_MS
  );
});

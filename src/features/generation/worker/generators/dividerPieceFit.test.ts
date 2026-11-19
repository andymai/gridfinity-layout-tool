/**
 * Real-kernel checks for the piece fit (`dividerPieces.pieceFit`): it loosens a
 * removable divider where it seats by thinning the PIECE, so a bad fit costs a
 * reprinted divider rather than a reprinted bin. Each test measures the solid
 * the export ships, never the plan that produced it.
 *
 * Flat print frame of a piece: X along the length, Y up the installed height
 * (-Y is the edge that rests on the floor), Z through the thickness with the
 * bed face at Z = 0.
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { box, intersect, isErr, isValid, measureVolume, mesh, unwrap } from 'brepjs';
import type { Shape3D } from 'brepjs';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { meshTopologyStats } from './__kernel-tests__/meshAssertions';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';
import {
  calculateDividerLength,
  calculateSlotPositions,
  dividerInterior,
  getDividerLockPlan,
  getEffectiveSlotDimensions,
  tabEngagement,
} from '@/shared/utils/slotMath';
import { lipInnerReachMm } from '@/shared/utils/lipNotchPlan';
import { buildUniqueDividerPieces } from './dividerBuilder';
import type { DividerBedFit } from './dividerSeamPlan';
import { splitDividerPieceAtSeams } from './dividerSplit';
import { buildSlotCuts, slotCutsFeature } from './slotBuilder';
import { createInitialContext } from './pipeline/context';
import { deriveDimensions } from './pipeline/context';
import { LIP_TAPER_WIDTH } from './generatorConstants';

beforeAll(async () => {
  await initBrepjs();
}, 120_000);

const slotted = (over: Partial<BinParams>): BinParams => ({
  ...DEFAULT_BIN_PARAMS,
  style: 'slotted',
  ...over,
});

const withFit = (params: BinParams, pieceFit: number | undefined): BinParams => ({
  ...params,
  dividerPieces: { ...params.dividerPieces, pieceFit },
});

const singleX = (over: Partial<BinParams> = {}): BinParams =>
  slotted({
    slotConfig: {
      ...DEFAULT_BIN_PARAMS.slotConfig,
      x: { enabled: true, pitch: 40 },
      y: { enabled: false, pitch: 40 },
    },
    ...over,
  });

const BOTH_AXES = {
  ...DEFAULT_BIN_PARAMS.slotConfig,
  x: { enabled: true, pitch: 25 },
  y: { enabled: true, pitch: 25 },
};

/**
 * Piece volumes recorded from main before the piece fit existed, rounded to
 * 1e-4 mm³. A design that never sets the fit must still build these exactly.
 */
const BASELINE: Record<string, { params: BinParams; fit?: DividerBedFit; volumes: number[] }> = {
  singleX: { params: singleX(), volumes: [1842.432] },
  lapBoth: { params: slotted({ slotConfig: BOTH_AXES }), volumes: [1793.376, 1793.376] },
  insert: {
    params: slotted({ slotConfig: { ...BOTH_AXES, crossStyle: 'insert' } }),
    volumes: [1785.5808, 566.256, 615.168],
  },
  lengthSetLip: {
    params: slotted({
      width: 3,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
      slotConfig: { ...BOTH_AXES, partialStyle: 'lengthSet' },
    }),
    volumes: [
      2691.84, 562.3776, 1080.6432, 1598.9088, 2117.1744, 505.9776, 1024.2432, 1542.5088, 1793.376,
      608.4, 1172.688, 552,
    ],
  },
  snappable: {
    params: slotted({ slotConfig: { ...BOTH_AXES, partialStyle: 'snappable' } }),
    volumes: [1777.1328, 1777.1328],
  },
  authored: {
    params: slotted({
      slotConfig: {
        ...DEFAULT_BIN_PARAMS.slotConfig,
        layout: 'custom',
        customGrid: { cols: 2, rows: 2, cells: [0, 1, 2, 2] },
      },
    }),
    volumes: [902.808, 1842.432],
  },
  windowSeams: {
    params: singleX({
      width: 5,
      depth: 2,
      height: 6,
      walls: {
        ...DEFAULT_BIN_PARAMS.walls,
        enabled: true,
        shape: 'u-shape',
        interior: { ...DEFAULT_BIN_PARAMS.walls.interior, enabled: true, width: 40, depth: 50 },
      },
    }),
    fit: { printBed: { widthMm: 120, depthMm: 120 } },
    volumes: [9407.7505],
  },
};

function build(params: BinParams, fit?: DividerBedFit) {
  const { wallHeight } = deriveDimensions(params, true);
  const { innerW, innerD } = dividerInterior(params);
  return buildUniqueDividerPieces(params, innerW, innerD, wallHeight, params.base.stackingLip, fit);
}

function withPieces<T>(
  params: BinParams,
  run: (pieces: ReturnType<typeof build>) => T,
  fit?: DividerBedFit
): T {
  const pieces = build(params, fit);
  try {
    return run(pieces);
  } finally {
    for (const p of pieces) p.shape.delete();
  }
}

interface Extent {
  readonly min: [number, number, number];
  readonly max: [number, number, number];
}

function extentOf(shape: Shape3D): Extent | null {
  const m = mesh(shape, { tolerance: 0.01, angularTolerance: 0.3, cache: false });
  if (m.vertices.length === 0) return null;
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < m.vertices.length; i += 3) {
    for (let a = 0; a < 3; a++) {
      min[a] = Math.min(min[a], m.vertices[i + a]);
      max[a] = Math.max(max[a], m.vertices[i + a]);
    }
  }
  return { min, max };
}

function mustExtent(shape: Shape3D): Extent {
  const e = extentOf(shape);
  if (!e) throw new Error('empty shape');
  return e;
}

/**
 * The Z span of solid inside a column over [x0, x1] × [y0, y1] through the
 * whole thickness, or null where the column holds no material.
 */
function zSpan(
  shape: Shape3D,
  x0: number,
  x1: number,
  y0: number,
  y1: number
): { lo: number; hi: number } | null {
  const probe = box(x1 - x0, y1 - y0, 20, { at: [(x0 + x1) / 2, (y0 + y1) / 2, 0] });
  try {
    const hit = intersect(shape, probe, { optimisation: 'none' });
    if (isErr(hit)) {
      if (hit.error.code === 'INTERSECT_NOT_3D') return null;
      throw new Error(`${hit.error.code}: ${hit.error.message}`);
    }
    try {
      const e = extentOf(hit.value);
      return e ? { lo: e.min[2], hi: e.max[2] } : null;
    } finally {
      hit.value.delete();
    }
  } finally {
    probe.delete();
  }
}

function thicknessAt(shape: Shape3D, x0: number, x1: number, y0: number, y1: number): number {
  const span = zSpan(shape, x0, x1, y0, y1);
  return span ? span.hi - span.lo : 0;
}

const round4 = (v: number): number => Math.round(v * 1e4) / 1e4;

describe('piece fit through the real kernel', () => {
  describe('a design that never sets the piece fit', () => {
    for (const [name, { params, fit, volumes }] of Object.entries(BASELINE)) {
      for (const pieceFit of [undefined, 0]) {
        it(`builds the ${name} pieces exactly as before (pieceFit ${String(pieceFit)})`, () => {
          const built = withPieces(
            withFit(params, pieceFit),
            (pieces) => pieces.map((p) => round4(unwrap(measureVolume(p.shape)))),
            fit
          );
          expect(built).toEqual(volumes);
        });
      }
    }
  });

  it('thins each tab end by twice the fit, from the top face, leaving the bed face flat', () => {
    const params = withFit(singleX(), 0.1);
    const T = params.dividerPieces.thickness;
    withPieces(params, ([piece]) => {
      const e = mustExtent(piece.shape);
      const midY = (e.min[1] + e.max[1]) / 2;
      for (const end of [e.max[0], e.min[0]]) {
        const inward = Math.sign(-end);
        const span = zSpan(
          piece.shape,
          Math.min(end, end + inward * 0.25),
          Math.max(end, end + inward * 0.25),
          midY - 2,
          midY + 2
        );
        expect(span).not.toBeNull();
        expect(span?.lo).toBeCloseTo(0, 3);
        expect(span?.hi).toBeCloseTo(T - 0.2, 3);
      }
      // The body between the ends keeps its full thickness.
      expect(thicknessAt(piece.shape, -1, 1, midY - 2, midY + 2)).toBeCloseTo(T, 3);
    });
  });

  it('thins the whole stretch that passes through the wall slot and the lip channel', () => {
    const params = withFit(
      singleX({ base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true } }),
      0.1
    );
    const T = params.dividerPieces.thickness;
    const { slotDepth } = getEffectiveSlotDimensions(
      params.wallThickness,
      T,
      params.dividerPieces.clearance
    );
    const reach =
      tabEngagement(slotDepth, params.dividerPieces.clearance) +
      Math.max(0, lipInnerReachMm(params) - params.wallThickness);
    withPieces(params, ([piece]) => {
      const e = mustExtent(piece.shape);
      const topY = e.max[1];
      // Up near the rim, where the piece rides in the lip channel as it drops in.
      expect(
        thicknessAt(piece.shape, e.max[0] - reach, e.max[0], topY - 1.5, topY - 0.5)
      ).toBeCloseTo(T - 0.2, 3);
    });
  });

  it('thins the bottom edge that seats in the floor groove, along the whole length', () => {
    for (const floorGroove of [true, false]) {
      const params = withFit(
        singleX({ dividerPieces: { ...DEFAULT_BIN_PARAMS.dividerPieces, floorGroove } }),
        0.1
      );
      const T = params.dividerPieces.thickness;
      withPieces(params, ([piece]) => {
        const e = mustExtent(piece.shape);
        const bottom = e.min[1];
        const t = thicknessAt(piece.shape, -1, 1, bottom + 0.1, bottom + 0.7);
        expect(t).toBeCloseTo(floorGroove ? T - 0.2 : T, 3);
      });
    }
  });

  it('keeps the neck relief clear of the throat whichever is thinner', () => {
    for (const pieceFit of [0.1, 0.25]) {
      const params = withFit(singleX(), pieceFit);
      const { thickness: T, clearance } = params.dividerPieces;
      const lock = getDividerLockPlan(T, clearance);
      withPieces(params, ([piece]) => {
        const e = mustExtent(piece.shape);
        const bottom = e.min[1];
        const tip = e.max[0];
        const neck = thicknessAt(
          piece.shape,
          tip - 0.25,
          tip - 0.05,
          bottom + lock.headHeight + 0.1,
          bottom + lock.headHeight + lock.throatHeight - 0.1
        );
        expect(neck).toBeCloseTo(Math.min(lock.neckWidth, T - 2 * pieceFit), 3);
        expect(neck).toBeLessThan(lock.throatWidth);
        // The head below the throat is the thinned tab, still wider than the
        // neck so the throat has a shoulder to close over.
        const head = thicknessAt(piece.shape, tip - 0.25, tip - 0.05, bottom + 0.1, bottom + 0.4);
        expect(head).toBeCloseTo(T - 2 * pieceFit, 3);
      });
    }
  });

  it('keeps the piece length, so it reaches as far into each slot as before', () => {
    const base = singleX();
    const { innerW } = dividerInterior(base);
    const { slotDepth } = getEffectiveSlotDimensions(
      base.wallThickness,
      base.dividerPieces.thickness,
      base.dividerPieces.clearance
    );
    const expected = calculateDividerLength(innerW, slotDepth, base.dividerPieces.clearance);
    for (const pieceFit of [0, 0.2]) {
      withPieces(withFit(base, pieceFit), ([piece]) => {
        const e = mustExtent(piece.shape);
        expect(e.max[0] - e.min[0]).toBeCloseTo(expected, 3);
      });
    }
  });

  it('widens each cross-lap notch by twice the fit', () => {
    const base = slotted({ slotConfig: BOTH_AXES });
    const { innerW } = dividerInterior(base);
    const { slotWidth } = getEffectiveSlotDimensions(
      base.wallThickness,
      base.dividerPieces.thickness,
      base.dividerPieces.clearance
    );
    const lipOverhang = base.base.stackingLip
      ? Math.max(0, LIP_TAPER_WIDTH - base.wallThickness)
      : 0;
    const [crossing] = calculateSlotPositions(innerW, BOTH_AXES.y.pitch, lipOverhang);
    expect(crossing).toBeDefined();
    const solidAt = (pieceFit: number, x0: number, x1: number): boolean =>
      withPieces(withFit(base, pieceFit), ([xPiece]) => {
        const e = mustExtent(xPiece.shape);
        // X pieces are notched from the installed top.
        return zSpan(xPiece.shape, x0, x1, e.max[1] - 2, e.max[1] - 0.5) !== null;
      });
    // The probe reads a real notch: its centre is open at either fit.
    expect(solidAt(0, crossing - 0.05, crossing + 0.05)).toBe(false);
    // Just outside today's notch edge, inside the widened one.
    const x0 = crossing + slotWidth / 2 + 0.03;
    const x1 = crossing + slotWidth / 2 + 0.07;
    expect(solidAt(0, x0, x1)).toBe(true);
    expect(solidAt(0.1, x0, x1)).toBe(false);
  });

  it('thins the receptacle ends of the short insert pieces', () => {
    const params = withFit(slotted({ slotConfig: { ...BOTH_AXES, crossStyle: 'insert' } }), 0.1);
    const T = params.dividerPieces.thickness;
    withPieces(params, (pieces) => {
      expect(pieces.map((p) => p.label)).toContain('divider-horizontal-compartment');
      const interior = pieces.find((p) => p.label.endsWith('-compartment'));
      expect(interior).toBeDefined();
      if (!interior) return;
      const e = mustExtent(interior.shape);
      const midY = (e.min[1] + e.max[1]) / 2;
      expect(
        thicknessAt(interior.shape, e.max[0] - 0.2, e.max[0] - 0.05, midY - 1, midY + 1)
      ).toBeCloseTo(T - 0.2, 3);
    });
  });

  it('caps the fit so a thin piece keeps a printable seat', () => {
    const params = withFit(
      singleX({ dividerPieces: { ...DEFAULT_BIN_PARAMS.dividerPieces, thickness: 0.8 } }),
      0.3
    );
    withPieces(params, ([piece]) => {
      const e = mustExtent(piece.shape);
      const midY = (e.min[1] + e.max[1]) / 2;
      expect(
        thicknessAt(piece.shape, e.max[0] - 0.2, e.max[0] - 0.05, midY - 1, midY + 1)
      ).toBeCloseTo(0.6, 3);
    });
  });

  it('builds closed solids where the thinning lands on a receptacle or score floor', () => {
    // A 2mm piece's receptacle and score grooves are 0.6mm deep per face, the
    // same depth a 0.3mm fit thins the top face by.
    const dividerPieces = { ...DEFAULT_BIN_PARAMS.dividerPieces, thickness: 2 };
    for (const slotConfig of [
      { ...BOTH_AXES, crossStyle: 'insert' as const },
      { ...BOTH_AXES, partialStyle: 'snappable' as const },
    ]) {
      const loose = withFit(slotted({ slotConfig, dividerPieces }), 0.3);
      const tight = withFit(slotted({ slotConfig, dividerPieces }), 0);
      const volumes = (p: BinParams): number[] =>
        withPieces(p, (pieces) => pieces.map((piece) => unwrap(measureVolume(piece.shape))));
      withPieces(loose, (pieces) => {
        for (const piece of pieces) {
          expect(isValid(piece.shape), piece.label).toBe(true);
          const m = mesh(piece.shape, { tolerance: 0.01, angularTolerance: 0.3, cache: false });
          const indices = new Uint32Array(m.triangles);
          const stats = meshTopologyStats({
            vertices: new Float32Array(m.vertices),
            normals: new Float32Array(m.normals),
            indices,
            edgeVertices: new Float32Array(0),
            triangleCount: indices.length / 3,
          });
          expect(stats.boundaryEdges, piece.label).toBe(0);
          expect(stats.nonManifoldEdges, piece.label).toBe(0);
        }
      });
      const before = volumes(tight);
      const after = volumes(loose);
      after.forEach((v, i) => expect(v).toBeLessThan(before[i]));
    }
  });

  it('still splits a thinned piece at its bed seams', () => {
    const { params, fit } = BASELINE.windowSeams;
    withPieces(
      withFit(params, 0.1),
      ([piece]) => {
        expect(piece.seams?.length).toBeGreaterThan(0);
        const split = splitDividerPieceAtSeams(piece.shape, piece.seams ?? []);
        expect(split.ok).toBe(true);
        if (!split.ok) return;
        expect(split.value).toHaveLength((piece.seams?.length ?? 0) + 1);
        for (const part of split.value) part.delete();
      },
      fit
    );
  });

  it('leaves the bin slots exactly as they were', () => {
    for (const base of [singleX(), slotted({ slotConfig: BOTH_AXES })]) {
      const keyOf = (p: BinParams): string | null =>
        slotCutsFeature.cacheKey(createInitialContext(p, undefined, true));
      expect(keyOf(withFit(base, 0.2))).toBe(keyOf(withFit(base, undefined)));

      const volumeOf = (p: BinParams): number => {
        const dims = deriveDimensions(p, true);
        const cuts = buildSlotCuts(p, dims.innerW, dims.innerD, dims.interiorHeight);
        if (!cuts) throw new Error('no slot cuts');
        try {
          return unwrap(measureVolume(cuts));
        } finally {
          cuts.delete();
        }
      };
      expect(volumeOf(withFit(base, 0.2))).toBe(volumeOf(withFit(base, undefined)));
    }
  });
});

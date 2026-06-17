// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { DEFAULT_BIN_PARAMS, DISABLED_WALL_CUTOUT } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';
import type { Shape3D } from 'brepjs';
import { loadFont } from 'brepjs';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isErr } from '@/core/result';
import { initTestKernel } from '@/test/initTestKernel';

type BuildCompartmentWallsFn = (
  params: BinParams,
  innerW: number,
  innerD: number,
  wallHeight: number
) => Shape3D | null;
type BuildInsertCutsFn = (params: BinParams) => Shape3D | null;
type BuildCutoutCutsFn = (
  params: BinParams,
  innerW: number,
  innerD: number,
  wallHeight: number
) => Shape3D | null;
type BuildLabelTabsFn = (
  params: BinParams,
  innerW: number,
  innerD: number,
  wallHeight: number,
  wallThickness: number
) => Shape3D | null;
type BuildScoopRampsFn = (
  params: BinParams,
  innerW: number,
  innerD: number,
  wallHeight: number,
  wallThickness: number
) => Shape3D | null;
type BuildWallCutoutCutsFn = (
  params: BinParams,
  innerW: number,
  innerD: number,
  wallHeight: number,
  hasLip: boolean
) => Shape3D | null;

let buildCompartmentWalls: BuildCompartmentWallsFn;
let buildInsertCuts: BuildInsertCutsFn;
let buildCutoutCuts: BuildCutoutCutsFn;
let buildLabelTabs: BuildLabelTabsFn;
let buildScoopRamps: BuildScoopRampsFn;
let buildWallCutoutCuts: BuildWallCutoutCutsFn;

let meshShape: (shape: unknown) => { vertices: ArrayLike<number>; triangles: ArrayLike<number> };

beforeAll(async () => {
  const { mesh: meshFn } = await import('brepjs');
  await initTestKernel();

  // Cutout-label tests need the bundled Atkinson font (the textDefaults default);
  // load from disk since the test env has no `fetch` for `?url` assets.
  const buffer = readFileSync(
    resolve(__dirname, '../assets/fonts/AtkinsonHyperlegible-Regular.ttf')
  );
  const fontResult = await loadFont(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    'atkinson'
  );
  if (isErr(fontResult)) throw new Error(`Font load failed: ${fontResult.error.message}`);

  const mod = await import('./featureBuilder');
  buildCompartmentWalls = mod.buildCompartmentWalls;
  buildInsertCuts = mod.buildInsertCuts;
  buildCutoutCuts = mod.buildCutoutCuts;
  buildLabelTabs = mod.buildLabelTabs;
  buildScoopRamps = mod.buildScoopRamps;
  buildWallCutoutCuts = mod.buildWallCutoutCuts;

  meshShape = (shape) => meshFn(shape as never, { tolerance: 1, angularTolerance: 30 });
}, 30000);

describe('buildCompartmentWalls', () => {
  it('returns null for single compartment', () => {
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      compartments: { cols: 1, rows: 1, cells: [0], thickness: 0.8 },
    };
    const result = buildCompartmentWalls(params, 80, 80, 16);
    expect(result).toBeNull();
  });

  it('builds walls for 2x2 compartments', () => {
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      compartments: { cols: 2, rows: 2, cells: [0, 1, 2, 3], thickness: 0.8 },
    };
    const result = buildCompartmentWalls(params, 80, 80, 16);
    expect(result).not.toBeNull();
    const meshed = meshShape(result);
    expect(meshed.vertices.length).toBeGreaterThan(0);
  }, 30000);

  it('returns null when all cells are merged', () => {
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      compartments: { cols: 2, rows: 2, cells: [0, 0, 0, 0], thickness: 0.8 },
    };
    const result = buildCompartmentWalls(params, 80, 80, 16);
    expect(result).toBeNull();
  });

  it('builds partial walls for merged compartments', () => {
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      compartments: { cols: 3, rows: 2, cells: [0, 0, 1, 2, 3, 4], thickness: 0.8 },
    };
    const result = buildCompartmentWalls(params, 80, 80, 16);
    expect(result).not.toBeNull();
    const meshed = meshShape(result);
    expect(meshed.vertices.length).toBeGreaterThan(0);
  }, 30000);

  it('builds walls when a divider has a tilt override (1×2)', () => {
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      compartments: {
        cols: 1,
        rows: 2,
        cells: [0, 1],
        thickness: 1.2,
        dividerOverrides: [{ compartmentA: 0, compartmentB: 1, offsetStart: 10, offsetEnd: -10 }],
      },
    };
    const result = buildCompartmentWalls(params, 80, 80, 16);
    expect(result).not.toBeNull();
    const meshed = meshShape(result);
    expect(meshed.vertices.length).toBeGreaterThan(0);
  }, 30000);

  it('tilted divider produces a different mesh than the equivalent straight one', () => {
    const base: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      compartments: { cols: 1, rows: 2, cells: [0, 1], thickness: 1.2 },
    };
    const tilted: BinParams = {
      ...base,
      compartments: {
        ...base.compartments,
        dividerOverrides: [{ compartmentA: 0, compartmentB: 1, offsetStart: 12, offsetEnd: -12 }],
      },
    };
    const straight = buildCompartmentWalls(base, 80, 80, 16);
    const skew = buildCompartmentWalls(tilted, 80, 80, 16);
    expect(straight).not.toBeNull();
    expect(skew).not.toBeNull();
    // Tilted divider has different vertex topology than the axis-aligned
    // box — at minimum, vertex counts differ.
    const straightMesh = meshShape(straight);
    const skewMesh = meshShape(skew);
    expect(skewMesh.vertices.length).not.toBe(straightMesh.vertices.length);
  }, 30000);

  it('does not crash on a tilted override that pushes the divider outside the bin interior', () => {
    // Defensive guard against malformed JSON or invariant breakage where
    // the override drives the whole prism past the clip box. Build must
    // omit the bad divider silently — never crash the worker.
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      compartments: {
        cols: 1,
        rows: 2,
        cells: [0, 1],
        thickness: 1.2,
        dividerOverrides: [{ compartmentA: 0, compartmentB: 1, offsetStart: 200, offsetEnd: 200 }],
      },
    };
    expect(() => buildCompartmentWalls(params, 80, 80, 16)).not.toThrow();
  }, 30000);

  it('applies overrides only to the matching pair when a boundary spans multiple pairs', () => {
    // 2×2 grid with no merging — the vertical boundary between col 0 and col
    // 1 runs through pair (0,1) at row 0 and pair (2,3) at row 1. Before
    // the pair-aware run split, the whole vertical run was one segment and
    // the (0,1) override would silently apply to the (2,3) half — meaning
    // an override on ONLY (0,1) would produce identical geometry to
    // overriding BOTH pairs (because the bottom half secretly got the
    // same tilt). With the fix, top-only-override and both-override
    // produce DIFFERENT meshes.
    //
    // This is the load-bearing assertion. The previous version of this
    // test only compared against baseline, which would still pass if the
    // bug persisted (the buggy code does change the mesh — it just
    // changes the wrong part).
    const baseCells = [0, 1, 2, 3];
    const make = (
      overrides: {
        compartmentA: number;
        compartmentB: number;
        offsetStart: number;
        offsetEnd: number;
      }[]
    ): BinParams => ({
      ...DEFAULT_BIN_PARAMS,
      compartments: {
        cols: 2,
        rows: 2,
        cells: baseCells,
        thickness: 1.2,
        dividerOverrides: overrides,
      },
    });

    const topOnly = buildCompartmentWalls(
      make([{ compartmentA: 0, compartmentB: 1, offsetStart: 10, offsetEnd: -10 }]),
      80,
      80,
      16
    );
    // Use a DIFFERENT tilt for (2,3) than for (0,1) so the two halves
    // can't fuse into one indistinguishable parallelogram. With matched
    // offsets, two adjacent identical parallelograms fuse into a single
    // larger parallelogram with the same vertex count as the buggy
    // single-run output — the test would pass trivially and not catch
    // the bug. With mismatched offsets, the bottom half has a distinct
    // angle and can't fuse cleanly.
    const bothPairs = buildCompartmentWalls(
      make([
        { compartmentA: 0, compartmentB: 1, offsetStart: 10, offsetEnd: -10 },
        { compartmentA: 2, compartmentB: 3, offsetStart: -8, offsetEnd: 8 },
      ]),
      80,
      80,
      16
    );
    expect(topOnly).not.toBeNull();
    expect(bothPairs).not.toBeNull();
    // Use raw vertex-position sum as the discriminator rather than vertex
    // count: OCCT's fuse may normalize coincident vertices, and two
    // parallelograms with the same vertex count can land at different
    // positions. The position sum catches positional differences even
    // when the count happens to match. (Not a true centroid — no
    // division by count — but the differential check works the same.)
    const sumPositions = (mesh: { vertices: ArrayLike<number> }): number => {
      let s = 0;
      for (let i = 0; i < mesh.vertices.length; i++) s += mesh.vertices[i];
      return s;
    };
    const topOnlySum = sumPositions(meshShape(topOnly));
    const bothSum = sumPositions(meshShape(bothPairs));
    // Pre-fix: these would be identical because the (0,1) override would
    // silently tilt both halves of the boundary and the (2,3) override
    // would be a no-op. Post-fix: they differ because only the (2,3)
    // half changes — proving the override is now scoped to its pair.
    expect(Math.abs(topOnlySum - bothSum)).toBeGreaterThan(0.01);
  }, 30000);
});

describe('buildInsertCuts', () => {
  it('returns null for empty inserts', () => {
    const params: BinParams = { ...DEFAULT_BIN_PARAMS, inserts: [] };
    const result = buildInsertCuts(params);
    expect(result).toBeNull();
  });

  it('builds a circle insert cut', () => {
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      inserts: [
        { shape: 'circle', width: 20, depth: 20, cutDepth: 5, x: 0, y: 0, cornerRadius: 0 },
      ],
    };
    const result = buildInsertCuts(params);
    expect(result).not.toBeNull();
    const meshed = meshShape(result);
    expect(meshed.vertices.length).toBeGreaterThan(0);
  }, 30000);

  it('builds a rounded-rect insert cut', () => {
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      inserts: [
        {
          shape: 'rounded-rect',
          width: 30,
          depth: 20,
          cutDepth: 5,
          x: 0,
          y: 0,
          cornerRadius: 3,
        },
      ],
    };
    const result = buildInsertCuts(params);
    expect(result).not.toBeNull();
    const meshed = meshShape(result);
    expect(meshed.vertices.length).toBeGreaterThan(0);
  }, 30000);
});

describe('buildCutoutCuts', () => {
  it('returns empty cut and fuse lists when no cutouts are configured', () => {
    const params: BinParams = { ...DEFAULT_BIN_PARAMS, cutouts: [] };
    expect(buildCutoutCuts(params, 80, 80, 16)).toEqual({ cutTools: [], fuseTools: [] });
  });

  it('returns one cut tool per logical cutout for boolean subtraction', () => {
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      cutoutConfig: { topOffset: 0 },
      cutouts: [
        {
          id: 'c1',
          shape: 'rectangle',
          width: 15,
          depth: 15,
          cutDepth: 5,
          x: 10,
          y: 10,
          rotation: 0,
          cornerRadius: 0,
          label: '',
          groupId: null,
        },
      ],
    };
    const { cutTools, fuseTools } = buildCutoutCuts(params, 80, 80, 16);
    expect(cutTools).toHaveLength(1);
    expect(fuseTools).toHaveLength(0);
    const meshed = meshShape(cutTools[0]);
    expect(meshed.vertices.length).toBeGreaterThan(0);
  }, 30000);

  it('returns an embossed label as a fuse tool, not a cut', () => {
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      cutoutConfig: { topOffset: 0 },
      textDefaults: { ...DEFAULT_BIN_PARAMS.textDefaults, mode: 'emboss' },
      cutouts: [
        {
          id: 'c1',
          shape: 'rectangle',
          width: 15,
          depth: 15,
          cutDepth: 5,
          x: 10,
          y: 30,
          rotation: 0,
          cornerRadius: 0,
          label: 'HI',
          engraveLabel: true,
          textSide: 'top',
          groupId: null,
        },
      ],
    };
    const { cutTools, fuseTools } = buildCutoutCuts(params, 80, 80, 16);
    // One cavity cut + one emboss fuse; the cavity stays subtractive.
    expect(cutTools).toHaveLength(1);
    expect(fuseTools).toHaveLength(1);
    const meshed = meshShape(fuseTools[0]);
    expect(meshed.vertices.length).toBeGreaterThan(0);
  }, 30000);
});

describe('buildLabelTabs', () => {
  it('returns null when labels are disabled', () => {
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: false },
    };
    const result = buildLabelTabs(params, 80, 80, 16, 1.2);
    expect(result).toBeNull();
  });

  it('builds bracket-style label tabs', () => {
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, support: 'bracket' },
    };
    const result = buildLabelTabs(params, 80, 80, 16, 1.2);
    expect(result).not.toBeNull();
    const meshed = meshShape(result);
    expect(meshed.vertices.length).toBeGreaterThan(0);
  }, 30000);

  it('builds solid-style label tabs', () => {
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, support: 'solid' },
    };
    const result = buildLabelTabs(params, 80, 80, 16, 1.2);
    expect(result).not.toBeNull();
    const meshed = meshShape(result);
    expect(meshed.vertices.length).toBeGreaterThan(0);
  }, 30000);
});

describe('buildScoopRamps', () => {
  it('returns null when scoop is disabled', () => {
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      scoop: { enabled: false, radius: 'auto' },
    };
    const result = buildScoopRamps(params, 80, 80, 16, 1.2);
    expect(result).toBeNull();
  });

  it('returns null for non-standard bin style', () => {
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      style: 'slotted',
      scoop: { enabled: true, radius: 'auto' },
    };
    const result = buildScoopRamps(params, 80, 80, 16, 1.2);
    expect(result).toBeNull();
  });

  it('builds scoop ramps with auto radius', () => {
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      scoop: { enabled: true, radius: 'auto' },
    };
    const result = buildScoopRamps(params, 80, 80, 16, 1.2);
    expect(result).not.toBeNull();
    const meshed = meshShape(result);
    expect(meshed.vertices.length).toBeGreaterThan(0);
  }, 30000);

  it('builds scoop ramps with fixed radius', () => {
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      scoop: { enabled: true, radius: 10 },
    };
    const result = buildScoopRamps(params, 80, 80, 16, 1.2);
    expect(result).not.toBeNull();
    const meshed = meshShape(result);
    expect(meshed.vertices.length).toBeGreaterThan(0);
  }, 30000);
});

describe('buildWallCutoutCuts', () => {
  it('returns null when walls feature is disabled', () => {
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      walls: { ...DEFAULT_BIN_PARAMS.walls, enabled: false },
    };
    const result = buildWallCutoutCuts(params, 80, 80, 16, false);
    expect(result).toBeNull();
  });

  it('builds cutouts for enabled sides', () => {
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      walls: {
        enabled: true,
        width: 0,
        depth: 0,
        front: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 70, depth: 50 },
        back: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 70, depth: 50 },
        left: DISABLED_WALL_CUTOUT,
        right: DISABLED_WALL_CUTOUT,
        interior: DISABLED_WALL_CUTOUT,
      },
    };
    const result = buildWallCutoutCuts(params, 80, 80, 16, false);
    expect(result).not.toBeNull();
    const meshed = meshShape(result);
    expect(meshed.vertices.length).toBeGreaterThan(0);
  }, 30000);

  it('returns null when all sides are disabled', () => {
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      walls: {
        enabled: true,
        width: 70,
        depth: 50,
        front: DISABLED_WALL_CUTOUT,
        back: DISABLED_WALL_CUTOUT,
        left: DISABLED_WALL_CUTOUT,
        right: DISABLED_WALL_CUTOUT,
        interior: DISABLED_WALL_CUTOUT,
      },
    };
    const result = buildWallCutoutCuts(params, 80, 80, 16, false);
    expect(result).toBeNull();
  });

  it('builds cutout for a single side override', () => {
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      walls: {
        enabled: true,
        width: 0,
        depth: 0,
        front: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 60, depth: 40 },
        back: DISABLED_WALL_CUTOUT,
        left: DISABLED_WALL_CUTOUT,
        right: DISABLED_WALL_CUTOUT,
        interior: DISABLED_WALL_CUTOUT,
      },
    };
    const result = buildWallCutoutCuts(params, 80, 80, 16, false);
    expect(result).not.toBeNull();
    const meshed = meshShape(result);
    expect(meshed.vertices.length).toBeGreaterThan(0);
  }, 30000);

  it('returns null when width and depth are both 0', () => {
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      walls: {
        enabled: true,
        width: 0,
        depth: 0,
        front: DISABLED_WALL_CUTOUT,
        back: DISABLED_WALL_CUTOUT,
        left: DISABLED_WALL_CUTOUT,
        right: DISABLED_WALL_CUTOUT,
        interior: DISABLED_WALL_CUTOUT,
      },
    };
    const result = buildWallCutoutCuts(params, 80, 80, 16, false);
    expect(result).toBeNull();
  });

  it('builds interior wall cutouts with compartments', () => {
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      compartments: { cols: 2, rows: 2, cells: [0, 1, 2, 3], thickness: 1.2 },
      walls: {
        enabled: true,
        width: 70,
        depth: 50,
        front: DISABLED_WALL_CUTOUT,
        back: DISABLED_WALL_CUTOUT,
        left: DISABLED_WALL_CUTOUT,
        right: DISABLED_WALL_CUTOUT,
        interior: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 70, depth: 50 },
      },
    };
    const result = buildWallCutoutCuts(params, 80, 80, 16, false);
    expect(result).not.toBeNull();
    const meshed = meshShape(result);
    expect(meshed.vertices.length).toBeGreaterThan(0);
  }, 30000);

  it('handles 100% depth (full interior height cutout)', () => {
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      walls: {
        enabled: true,
        width: 0,
        depth: 0,
        front: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 70, depth: 100 },
        back: DISABLED_WALL_CUTOUT,
        left: DISABLED_WALL_CUTOUT,
        right: DISABLED_WALL_CUTOUT,
        interior: DISABLED_WALL_CUTOUT,
      },
    };
    const result = buildWallCutoutCuts(params, 80, 80, 16, true);
    expect(result).not.toBeNull();
    const meshed = meshShape(result);
    expect(meshed.vertices.length).toBeGreaterThan(0);
  }, 30000);

  it('builds scoop shape cutouts for enabled sides', () => {
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      walls: {
        enabled: true,
        shape: 'scoop',
        width: 0,
        depth: 0,
        front: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 70, depth: 50 },
        back: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 70, depth: 50 },
        left: DISABLED_WALL_CUTOUT,
        right: DISABLED_WALL_CUTOUT,
        interior: DISABLED_WALL_CUTOUT,
      },
    };
    const result = buildWallCutoutCuts(params, 80, 80, 16, false);
    expect(result).not.toBeNull();
    const meshed = meshShape(result);
    expect(meshed.vertices.length).toBeGreaterThan(0);
  }, 30000);

  it('builds funnel shape cutouts for enabled sides', () => {
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      walls: {
        enabled: true,
        shape: 'funnel',
        width: 0,
        depth: 0,
        front: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 70, depth: 50 },
        back: DISABLED_WALL_CUTOUT,
        left: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 70, depth: 50 },
        right: DISABLED_WALL_CUTOUT,
        interior: DISABLED_WALL_CUTOUT,
      },
    };
    const result = buildWallCutoutCuts(params, 80, 80, 16, false);
    expect(result).not.toBeNull();
    const meshed = meshShape(result);
    expect(meshed.vertices.length).toBeGreaterThan(0);
  }, 30000);

  it('builds scoop with very wide cutout (width > 2*height) as floor-bounded arc', () => {
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      walls: {
        enabled: true,
        shape: 'scoop',
        width: 0,
        depth: 0,
        front: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 90, depth: 30 },
        back: DISABLED_WALL_CUTOUT,
        left: DISABLED_WALL_CUTOUT,
        right: DISABLED_WALL_CUTOUT,
        interior: DISABLED_WALL_CUTOUT,
      },
    };
    const result = buildWallCutoutCuts(params, 80, 80, 16, false);
    expect(result).not.toBeNull();
    const meshed = meshShape(result);
    expect(meshed.vertices.length).toBeGreaterThan(0);
  }, 30000);
});

// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';
import type { Shape3D } from 'brepjs';

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
  const { initFromOC, mesh: meshFn } = await import('brepjs');
  const opencascade = (await import('brepjs-opencascade/src/brepjs_single.js')).default;
  const { readFileSync } = await import('fs');
  const { join } = await import('path');

  const wasmPath = join(process.cwd(), 'node_modules/brepjs-opencascade/src/brepjs_single.wasm');
  const wasmBinary = readFileSync(wasmPath);
  const OC = await opencascade({ wasmBinary });
  initFromOC(OC);

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
  it('returns null for empty cutouts', () => {
    const params: BinParams = { ...DEFAULT_BIN_PARAMS, cutouts: [] };
    const result = buildCutoutCuts(params, 80, 80, 16);
    expect(result).toBeNull();
  });

  it('builds a rectangle cutout', () => {
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
    const result = buildCutoutCuts(params, 80, 80, 16);
    expect(result).not.toBeNull();
    const meshed = meshShape(result);
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

  it('builds cutouts with global defaults (no per-side overrides)', () => {
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      walls: {
        enabled: true,
        width: 70,
        depth: 50,
        front: { enabled: false, width: 0, depth: 0 },
        back: { enabled: false, width: 0, depth: 0 },
        left: { enabled: false, width: 0, depth: 0 },
        right: { enabled: false, width: 0, depth: 0 },
        interior: { enabled: false, width: 0, depth: 0 },
      },
    };
    const result = buildWallCutoutCuts(params, 80, 80, 16, false);
    expect(result).not.toBeNull();
    const meshed = meshShape(result);
    expect(meshed.vertices.length).toBeGreaterThan(0);
  }, 30000);

  it('builds cutout for a single side override', () => {
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      walls: {
        enabled: true,
        width: 0,
        depth: 0,
        front: { enabled: true, width: 60, depth: 40 },
        back: { enabled: false, width: 0, depth: 0 },
        left: { enabled: false, width: 0, depth: 0 },
        right: { enabled: false, width: 0, depth: 0 },
        interior: { enabled: false, width: 0, depth: 0 },
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
        front: { enabled: false, width: 0, depth: 0 },
        back: { enabled: false, width: 0, depth: 0 },
        left: { enabled: false, width: 0, depth: 0 },
        right: { enabled: false, width: 0, depth: 0 },
        interior: { enabled: false, width: 0, depth: 0 },
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
        front: { enabled: false, width: 0, depth: 0 },
        back: { enabled: false, width: 0, depth: 0 },
        left: { enabled: false, width: 0, depth: 0 },
        right: { enabled: false, width: 0, depth: 0 },
        interior: { enabled: true, width: 70, depth: 50 },
      },
    };
    const result = buildWallCutoutCuts(params, 80, 80, 16, false);
    expect(result).not.toBeNull();
    const meshed = meshShape(result);
    expect(meshed.vertices.length).toBeGreaterThan(0);
  }, 30000);

  it('handles 100% depth (full height cutout)', () => {
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      walls: {
        enabled: true,
        width: 70,
        depth: 100,
        front: { enabled: false, width: 0, depth: 0 },
        back: { enabled: false, width: 0, depth: 0 },
        left: { enabled: false, width: 0, depth: 0 },
        right: { enabled: false, width: 0, depth: 0 },
        interior: { enabled: false, width: 0, depth: 0 },
      },
    };
    const result = buildWallCutoutCuts(params, 80, 80, 16, true);
    expect(result).not.toBeNull();
    const meshed = meshShape(result);
    expect(meshed.vertices.length).toBeGreaterThan(0);
  }, 30000);
});

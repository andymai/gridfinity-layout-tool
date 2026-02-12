/**
 * Parametric snapshot tests for bin generation.
 *
 * Captures `triangleCount` across parameter combinations to detect geometry
 * regressions. Uses lean matrix design: dimensions and base styles are tested
 * independently (not cross-product) since they don't interact.
 *
 * Update snapshots after verified geometry changes:
 *   npm run test:run -- -u src/features/generation/worker/generators/binGenerator.scenario.snapshots
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams, BaseStyle, BinStyle, Cutout, Insert } from '@/shared/types/bin';
import type { MeshData } from '@/features/generation/bridge/types';

type GenerateFn = (
  params: BinParams,
  onProgress?: (stage: string, progress: number) => void,
  forExport?: boolean
) => MeshData;
let generateBin: GenerateFn;

beforeAll(async () => {
  const { initFromOC } = await import('brepjs');
  const opencascade = (await import('brepjs-opencascade/src/brepjs_single.js')).default;
  const { readFileSync } = await import('fs');
  const { join } = await import('path');

  const wasmPath = join(process.cwd(), 'node_modules/brepjs-opencascade/src/brepjs_single.wasm');
  const wasmBinary = readFileSync(wasmPath);
  const OC = await opencascade({ wasmBinary });
  initFromOC(OC);

  const mod = await import('@/features/generation/worker/generators/binGenerator');
  generateBin = mod.generateBin as GenerateFn;
}, 30000);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildParams(overrides: Partial<BinParams>): BinParams {
  return { ...DEFAULT_BIN_PARAMS, ...overrides };
}

function snapshotBin(params: BinParams, forExport?: boolean): void {
  const result = generateBin(params, undefined, forExport);
  expect(result.vertices.length).toBeGreaterThan(0);
  expect(result.triangleCount).toBeGreaterThan(0);
  expect(result.triangleCount).toMatchSnapshot();
}

const makeInsert = (overrides: Partial<Insert>): Insert => ({
  id: 'test-insert',
  templateId: null,
  shape: 'circle',
  x: 0,
  y: 0,
  width: 20,
  depth: 20,
  cutDepth: 5,
  rotation: 0,
  cornerRadius: 0,
  label: '',
  ...overrides,
});

const makeCutout = (overrides: Partial<Cutout>): Cutout => ({
  id: 'test-cutout',
  shape: 'rectangle',
  x: 0,
  y: 0,
  width: 15,
  depth: 15,
  cutDepth: 5,
  rotation: 0,
  cornerRadius: 0,
  label: '',
  groupId: null,
  ...overrides,
});

// ---------------------------------------------------------------------------
// 1. Dimensions (standard base, ±lip) — 10 tests
// ---------------------------------------------------------------------------

describe('dimensions', () => {
  describe.each([
    { w: 0.5, d: 0.5, label: '0.5×0.5' },
    { w: 1, d: 1, label: '1×1' },
    { w: 2, d: 2, label: '2×2' },
    { w: 4, d: 4, label: '4×4' },
    { w: 1.5, d: 2, label: '1.5×2 fractional' },
  ])('$label', ({ w, d }) => {
    it.each([
      { lip: true, label: 'with lip' },
      { lip: false, label: 'no lip' },
    ])(
      '$label',
      ({ lip }) => {
        snapshotBin(
          buildParams({
            width: w,
            depth: d,
            base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: lip },
          })
        );
      },
      30000
    );
  });
});

// ---------------------------------------------------------------------------
// 2. Base styles (1×1 reference size, ±lip) — 12 tests
// ---------------------------------------------------------------------------

describe('base styles', () => {
  describe.each<{ style: BaseStyle; label: string }>([
    { style: 'standard', label: 'standard' },
    { style: 'magnet', label: 'magnet' },
    { style: 'screw', label: 'screw' },
    { style: 'magnet_and_screw', label: 'magnet+screw' },
    { style: 'weighted', label: 'weighted' },
    { style: 'flat', label: 'flat' },
  ])('$label base', ({ style }) => {
    it.each([
      { lip: true, label: 'with lip' },
      { lip: false, label: 'no lip' },
    ])(
      '$label',
      ({ lip }) => {
        snapshotBin(
          buildParams({
            width: 1,
            depth: 1,
            base: { ...DEFAULT_BIN_PARAMS.base, style, stackingLip: lip },
          })
        );
      },
      30000
    );
  });
});

// ---------------------------------------------------------------------------
// 3. Bin styles — 3 tests
// ---------------------------------------------------------------------------

describe('bin styles', () => {
  it.each<{ style: BinStyle; base?: Partial<BinParams['base']>; label: string }>([
    { style: 'standard', label: 'standard' },
    { style: 'slotted', label: 'slotted' },
    { style: 'solid', base: { solid: true }, label: 'solid' },
  ])(
    '2×2 $label',
    ({ style, base }) => {
      snapshotBin(buildParams({ style, base: { ...DEFAULT_BIN_PARAMS.base, ...base } }));
    },
    30000
  );
});

// ---------------------------------------------------------------------------
// 4. Height variations — 2 tests [P0 gap]
// ---------------------------------------------------------------------------

describe('height', () => {
  it.each([
    { height: 2, label: 'minimum (2u)' },
    { height: 10, label: 'tall (10u)' },
  ])(
    '2×2 height $label',
    ({ height }) => {
      snapshotBin(buildParams({ height }));
    },
    30000
  );
});

// ---------------------------------------------------------------------------
// 5. Wall thickness — 2 tests [P0 gap]
// ---------------------------------------------------------------------------

describe('wall thickness', () => {
  it.each([
    { wallThickness: 0.4, label: 'thin (0.4mm)' },
    { wallThickness: 2.4, label: 'thick (2.4mm)' },
  ])(
    '2×2 $label walls',
    ({ wallThickness }) => {
      snapshotBin(buildParams({ wallThickness }));
    },
    30000
  );
});

// ---------------------------------------------------------------------------
// 6. Compartments — 4 tests (added dense grid) [P2 gap]
// ---------------------------------------------------------------------------

describe('compartments', () => {
  it.each([
    {
      compartments: { cols: 1, rows: 1, cells: [0], thickness: 0.8 },
      label: '1×1 (none)',
    },
    {
      compartments: { cols: 2, rows: 2, cells: [0, 1, 2, 3], thickness: 0.8 },
      label: '2×2',
    },
    {
      compartments: { cols: 3, rows: 2, cells: [0, 0, 1, 2, 3, 4], thickness: 0.8 },
      label: '3×2 merged top-left',
    },
    {
      compartments: {
        cols: 4,
        rows: 4,
        cells: Array.from({ length: 16 }, (_, i) => i),
        thickness: 0.8,
      },
      label: '4×4 dense grid',
    },
  ])(
    '2×2 bin with $label compartments',
    ({ compartments }) => {
      snapshotBin(buildParams({ compartments }));
    },
    60000
  );
});

// ---------------------------------------------------------------------------
// 7. Scoop — 3 tests
// ---------------------------------------------------------------------------

describe('scoop', () => {
  it.each([
    { scoop: { enabled: false, radius: 'auto' as const }, label: 'disabled' },
    { scoop: { enabled: true, radius: 'auto' as const }, label: 'auto radius' },
    { scoop: { enabled: true, radius: 10 }, label: 'radius 10mm' },
  ])(
    '2×2 scoop $label',
    ({ scoop }) => {
      snapshotBin(buildParams({ scoop }));
    },
    30000
  );
});

// ---------------------------------------------------------------------------
// 8. Scoop + lip interactions — 2 tests [P0 gap: PR #668 lip offset]
// ---------------------------------------------------------------------------

describe('scoop + lip interaction', () => {
  it('scoop with lip (single compartment, front-row offset active)', () => {
    snapshotBin(
      buildParams({
        scoop: { enabled: true, radius: 'auto' },
        base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
      })
    );
  }, 30000);

  it('scoop with lip + 2 rows (front-row offset vs interior-row)', () => {
    snapshotBin(
      buildParams({
        scoop: { enabled: true, radius: 'auto' },
        base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
        compartments: { cols: 1, rows: 2, cells: [0, 1], thickness: 0.8 },
      })
    );
  }, 30000);
});

// ---------------------------------------------------------------------------
// 9. Label tabs — 5 tests (added alignments) [P1 gap]
// ---------------------------------------------------------------------------

describe('label tabs', () => {
  it.each([
    { enabled: false, support: 'bracket' as const, alignment: 'left' as const, label: 'disabled' },
    {
      enabled: true,
      support: 'bracket' as const,
      alignment: 'left' as const,
      label: 'bracket left',
    },
    { enabled: true, support: 'solid' as const, alignment: 'left' as const, label: 'solid left' },
    {
      enabled: true,
      support: 'bracket' as const,
      alignment: 'center' as const,
      label: 'bracket center',
    },
    {
      enabled: true,
      support: 'bracket' as const,
      alignment: 'right' as const,
      label: 'bracket right',
    },
  ])(
    '2×2 label $label',
    ({ enabled, support, alignment }) => {
      snapshotBin(
        buildParams({
          label: { ...DEFAULT_BIN_PARAMS.label, enabled, support, alignment },
        })
      );
    },
    30000
  );
});

// ---------------------------------------------------------------------------
// 10. Inserts — 5 tests (added rectangle, slot) [P1 gap]
// ---------------------------------------------------------------------------

describe('inserts', () => {
  it.each([
    { insert: makeInsert({ shape: 'circle', width: 20, depth: 20 }), label: 'circle' },
    {
      insert: makeInsert({ shape: 'rounded-rect', width: 30, depth: 20, cornerRadius: 3 }),
      label: 'rounded-rect',
    },
    { insert: makeInsert({ shape: 'hexagon', width: 20, depth: 20 }), label: 'hexagon' },
    { insert: makeInsert({ shape: 'rectangle', width: 30, depth: 20 }), label: 'rectangle' },
    { insert: makeInsert({ shape: 'slot', width: 30, depth: 10 }), label: 'slot' },
  ])(
    '2×2 with $label insert',
    ({ insert }) => {
      snapshotBin(buildParams({ inserts: [insert] }));
    },
    30000
  );
});

// ---------------------------------------------------------------------------
// 11. Multiple inserts — 1 test [P2 gap: fuseAll path]
// ---------------------------------------------------------------------------

describe('multiple inserts', () => {
  it('2×2 with 2 circle inserts', () => {
    snapshotBin(
      buildParams({
        inserts: [
          makeInsert({ id: 'a', shape: 'circle', x: -10, y: 0, width: 20, depth: 20 }),
          makeInsert({ id: 'b', shape: 'circle', x: 10, y: 0, width: 20, depth: 20 }),
        ],
      })
    );
  }, 30000);
});

// ---------------------------------------------------------------------------
// 12. Solid bin cutouts — 8 tests (added cornerRadius, rotation, ellipse,
//     grouped, topOffset) [P1 gaps]
// ---------------------------------------------------------------------------

describe('solid cutouts', () => {
  it.each([
    { cutout: makeCutout({ shape: 'rectangle' }), label: 'rectangle' },
    { cutout: makeCutout({ shape: 'circle', width: 20, depth: 20 }), label: 'circle' },
    {
      cutout: makeCutout({ shape: 'rectangle', scoopRadius: 3 }),
      label: 'rectangle with scoop',
    },
    {
      cutout: makeCutout({ shape: 'rectangle', cornerRadius: 3 }),
      label: 'rounded-rectangle',
    },
    {
      cutout: makeCutout({ shape: 'rectangle', rotation: 45 }),
      label: 'rotated 45°',
    },
    {
      cutout: makeCutout({ shape: 'circle', width: 20, depth: 30 }),
      label: 'ellipse',
    },
  ])(
    '2×2 solid with $label cutout',
    ({ cutout }) => {
      snapshotBin(
        buildParams({
          style: 'solid',
          base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
          cutouts: [cutout],
        })
      );
    },
    30000
  );

  it('2×2 solid with grouped cutouts', () => {
    snapshotBin(
      buildParams({
        style: 'solid',
        base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
        cutouts: [
          makeCutout({ id: 'g-a', x: -5, y: 0, groupId: 'g1' }),
          makeCutout({ id: 'g-b', x: 10, y: 0, groupId: 'g1' }),
        ],
      })
    );
  }, 30000);

  it('2×2 solid with triangular path cutout', () => {
    snapshotBin(
      buildParams({
        style: 'solid',
        base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
        cutouts: [
          makeCutout({
            shape: 'path',
            x: 10,
            y: 10,
            width: 20,
            depth: 20,
            path: [
              { x: 10, y: 10, handleIn: null, handleOut: null, symmetric: false },
              { x: 30, y: 10, handleIn: null, handleOut: null, symmetric: false },
              { x: 20, y: 30, handleIn: null, handleOut: null, symmetric: false },
            ],
          }),
        ],
      })
    );
  }, 30000);

  it('2×2 solid with curved path cutout (bezier handles)', () => {
    snapshotBin(
      buildParams({
        style: 'solid',
        base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
        cutouts: [
          makeCutout({
            shape: 'path',
            x: 5,
            y: 5,
            width: 30,
            depth: 25,
            path: [
              { x: 5, y: 5, handleIn: null, handleOut: { dx: 10, dy: 0 }, symmetric: false },
              {
                x: 35,
                y: 5,
                handleIn: { dx: 0, dy: -10 },
                handleOut: { dx: 0, dy: 10 },
                symmetric: true,
              },
              {
                x: 35,
                y: 30,
                handleIn: { dx: 10, dy: 0 },
                handleOut: { dx: -10, dy: 0 },
                symmetric: true,
              },
              { x: 5, y: 30, handleIn: { dx: 0, dy: 10 }, handleOut: null, symmetric: false },
            ],
          }),
        ],
      })
    );
  }, 30000);

  it('2×2 solid with path cutout having closing bezier curve', () => {
    snapshotBin(
      buildParams({
        style: 'solid',
        base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
        cutouts: [
          makeCutout({
            shape: 'path',
            x: 8,
            y: 8,
            width: 24,
            depth: 24,
            path: [
              {
                x: 8,
                y: 20,
                handleIn: { dx: 0, dy: 8 },
                handleOut: { dx: 0, dy: -8 },
                symmetric: true,
              },
              {
                x: 20,
                y: 8,
                handleIn: { dx: -8, dy: 0 },
                handleOut: { dx: 8, dy: 0 },
                symmetric: true,
              },
              {
                x: 32,
                y: 20,
                handleIn: { dx: 0, dy: -8 },
                handleOut: { dx: 0, dy: 8 },
                symmetric: true,
              },
              {
                x: 20,
                y: 32,
                handleIn: { dx: 8, dy: 0 },
                handleOut: { dx: -8, dy: 0 },
                symmetric: true,
              },
            ],
          }),
        ],
      })
    );
  }, 30000);

  it('2×2 solid with topOffset', () => {
    snapshotBin(
      buildParams({
        style: 'solid',
        base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
        cutoutConfig: { topOffset: 3 },
        cutouts: [makeCutout({ shape: 'rectangle', cutDepth: 5 })],
      })
    );
  }, 30000);
});

// ---------------------------------------------------------------------------
// 13. Half-sockets — 3 tests
// ---------------------------------------------------------------------------

describe('half-sockets', () => {
  it.each([
    { w: 1, d: 1, label: '1×1' },
    { w: 1.5, d: 1.5, label: '1.5×1.5' },
    { w: 2, d: 2, label: '2×2' },
  ])(
    '$label with half sockets',
    ({ w, d }) => {
      snapshotBin(
        buildParams({
          width: w,
          depth: d,
          base: { ...DEFAULT_BIN_PARAMS.base, halfSockets: true },
        })
      );
    },
    30000
  );
});

// ---------------------------------------------------------------------------
// 14. Slotted variations — 3 tests [P1/P2 gaps: Y-axis, both axes, no lip]
// ---------------------------------------------------------------------------

describe('slotted variations', () => {
  it('slotted with Y-axis slots', () => {
    snapshotBin(
      buildParams({
        style: 'slotted',
        slotConfig: {
          x: { enabled: false, pitch: 20 },
          y: { enabled: true, pitch: 20 },
          width: 2.0,
          depth: 1.0,
        },
      })
    );
  }, 30000);

  it('slotted with both axes', () => {
    snapshotBin(
      buildParams({
        style: 'slotted',
        slotConfig: {
          x: { enabled: true, pitch: 20 },
          y: { enabled: true, pitch: 20 },
          width: 2.0,
          depth: 1.0,
        },
      })
    );
  }, 30000);

  it('slotted without lip', () => {
    snapshotBin(
      buildParams({
        style: 'slotted',
        base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
      })
    );
  }, 30000);
});

// ---------------------------------------------------------------------------
// 15. Export mode — 1 test [P1 gap: different tessellation + loft]
// ---------------------------------------------------------------------------

describe('export mode', () => {
  it('2×2 default params (forExport=true)', () => {
    snapshotBin(DEFAULT_BIN_PARAMS, true);
  }, 60000);
});

// ---------------------------------------------------------------------------
// 16. Large bin — 1 test [P2 gap: tessellation quality path]
// ---------------------------------------------------------------------------

describe('large bin', () => {
  it('8×8 standard', () => {
    snapshotBin(buildParams({ width: 8, depth: 8 }));
  }, 60000);
});

// ---------------------------------------------------------------------------
// 17. Asymmetric dimensions — 1 test [P2 gap: corner radius clamping]
// ---------------------------------------------------------------------------

describe('asymmetric dimensions', () => {
  it('0.5×4 extreme asymmetry', () => {
    snapshotBin(buildParams({ width: 0.5, depth: 4 }));
  }, 30000);
});

// ---------------------------------------------------------------------------
// 18. Combined features — 5 tests (added interaction combos)
// ---------------------------------------------------------------------------

describe('combined features', () => {
  it('2×2 standard + lip + 2×2 compartments + scoop', () => {
    snapshotBin(
      buildParams({
        base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
        compartments: { cols: 2, rows: 2, cells: [0, 1, 2, 3], thickness: 0.8 },
        scoop: { enabled: true, radius: 'auto' },
      })
    );
  }, 60000);

  it('4×4 magnet + label bracket + half-sockets', () => {
    snapshotBin(
      buildParams({
        width: 4,
        depth: 4,
        base: {
          ...DEFAULT_BIN_PARAMS.base,
          style: 'magnet',
          stackingLip: false,
          halfSockets: true,
        },
        label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, support: 'bracket' },
      })
    );
  }, 60000);

  it('1.5×2 flat + slotted + 3×2 merged compartments', () => {
    snapshotBin(
      buildParams({
        width: 1.5,
        depth: 2,
        style: 'slotted',
        base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat' },
        compartments: { cols: 3, rows: 2, cells: [0, 0, 1, 2, 3, 4], thickness: 0.8 },
      })
    );
  }, 60000);

  it('2×2 compartments + insert (overlap interaction)', () => {
    snapshotBin(
      buildParams({
        compartments: { cols: 2, rows: 1, cells: [0, 1], thickness: 0.8 },
        inserts: [makeInsert({ shape: 'circle', width: 15, depth: 15, x: 0, y: 0 })],
      })
    );
  }, 30000);

  it('2×2 label tabs with merged compartments', () => {
    snapshotBin(
      buildParams({
        compartments: { cols: 3, rows: 2, cells: [0, 0, 1, 2, 3, 4], thickness: 0.8 },
        label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, support: 'bracket' },
      })
    );
  }, 30000);
});

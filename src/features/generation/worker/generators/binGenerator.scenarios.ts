/**
 * All bin generation scenario case definitions.
 *
 * Organised by category — each array maps 1:1 to the old test file it was
 * migrated from. Categories are consumed by the unified test runner
 * (`binGenerator.scenario.test.ts`).
 *
 * Update snapshots after verified geometry changes:
 *   npm run test:run -- -u src/features/generation/worker/generators/binGenerator.scenario.test
 */
import { expect } from 'vitest';
import { DEFAULT_BIN_PARAMS, GRIDFINITY } from '@/shared/constants/bin';
import type { BinParams, BaseStyle, BinStyle } from '@/shared/types/bin';
import { countWallVerticesInZone } from './__test-infra__/meshAssertions';
import { defineScenario, makeInsert, makeCutout } from './__test-infra__/scenarioTypes';
import type { ScenarioCase } from './__test-infra__/scenarioTypes';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SIZE = GRIDFINITY.GRID_SIZE;

// ─── 1. Dimensions (from snapshots:88-113) ──────────────────────────────────

const dimensionCombos: Array<{ w: number; d: number; label: string }> = [
  { w: 0.5, d: 0.5, label: '0.5×0.5' },
  { w: 1, d: 1, label: '1×1' },
  { w: 2, d: 2, label: '2×2' },
  { w: 4, d: 4, label: '4×4' },
  { w: 1.5, d: 2, label: '1.5×2 fractional' },
];

const dimensions: ScenarioCase[] = dimensionCombos.flatMap(({ w, d, label }) => [
  defineScenario('dimensions', `${label} with lip`, {
    params: { width: w, depth: d, base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true } },
  }),
  defineScenario('dimensions', `${label} no lip`, {
    params: { width: w, depth: d, base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false } },
  }),
]);

// ─── 2. Base styles (from snapshots:119-145) ────────────────────────────────

const baseStyleList: Array<{ style: BaseStyle; label: string }> = [
  { style: 'standard', label: 'standard' },
  { style: 'magnet', label: 'magnet' },
  { style: 'screw', label: 'screw' },
  { style: 'magnet_and_screw', label: 'magnet+screw' },
  { style: 'weighted', label: 'weighted' },
  { style: 'flat', label: 'flat' },
];

const baseStyles: ScenarioCase[] = baseStyleList.flatMap(({ style, label }) => [
  defineScenario('base styles', `${label} base with lip`, {
    params: {
      width: 1,
      depth: 1,
      base: { ...DEFAULT_BIN_PARAMS.base, style, stackingLip: true },
    },
  }),
  defineScenario('base styles', `${label} base no lip`, {
    params: {
      width: 1,
      depth: 1,
      base: { ...DEFAULT_BIN_PARAMS.base, style, stackingLip: false },
    },
  }),
]);

// ─── 3. Bin styles (from snapshots:151-163) ─────────────────────────────────

const binStyleList: Array<{ style: BinStyle; base?: Partial<BinParams['base']>; label: string }> = [
  { style: 'standard', label: 'standard' },
  { style: 'slotted', label: 'slotted' },
  { style: 'solid', base: { solid: true }, label: 'solid' },
];

const binStyles: ScenarioCase[] = binStyleList.map(({ style, base, label }) =>
  defineScenario('bin styles', `2×2 ${label}`, {
    params: { style, base: { ...DEFAULT_BIN_PARAMS.base, ...base } },
  })
);

// ─── 4. Height variations (from snapshots:169-180) ──────────────────────────

const heightVariations: ScenarioCase[] = [
  defineScenario('height', '2×2 height minimum (2u)', { params: { height: 2 } }),
  defineScenario('height', '2×2 height tall (10u)', { params: { height: 10 } }),
];

// ─── 5. Wall thickness (from snapshots:186-197) ─────────────────────────────

const wallThickness: ScenarioCase[] = [
  defineScenario('wall thickness', '2×2 thin (0.4mm) walls', {
    params: { wallThickness: 0.4 },
  }),
  defineScenario('wall thickness', '2×2 thick (2.4mm) walls', {
    params: { wallThickness: 2.4 },
  }),
];

// ─── 6. Compartments (from snapshots:203-233) ───────────────────────────────

const compartments: ScenarioCase[] = [
  defineScenario('compartments', '2×2 bin with 1×1 (none) compartments', {
    params: { compartments: { cols: 1, rows: 1, cells: [0], thickness: 0.8 } },
  }),
  defineScenario('compartments', '2×2 bin with 2×2 compartments', {
    params: { compartments: { cols: 2, rows: 2, cells: [0, 1, 2, 3], thickness: 0.8 } },
  }),
  defineScenario('compartments', '2×2 bin with 3×2 merged top-left compartments', {
    params: { compartments: { cols: 3, rows: 2, cells: [0, 0, 1, 2, 3, 4], thickness: 0.8 } },
  }),
  defineScenario('compartments', '2×2 bin with 4×4 dense grid compartments', {
    params: {
      compartments: {
        cols: 4,
        rows: 4,
        cells: Array.from({ length: 16 }, (_, i) => i),
        thickness: 0.8,
      },
    },
    timeout: 60_000,
  }),
];

// ─── 7. Scoop (from snapshots:239-251) ──────────────────────────────────────

const scoop: ScenarioCase[] = [
  defineScenario('scoop', '2×2 scoop disabled', {
    params: { scoop: { enabled: false, radius: 'auto' as const } },
  }),
  defineScenario('scoop', '2×2 scoop auto radius', {
    params: { scoop: { enabled: true, radius: 'auto' as const } },
  }),
  defineScenario('scoop', '2×2 scoop radius 10mm', {
    params: { scoop: { enabled: true, radius: 10 } },
  }),
];

// ─── 8. Scoop + lip interaction (from snapshots:257-276) ────────────────────

const scoopLipInteraction: ScenarioCase[] = [
  defineScenario(
    'scoop + lip interaction',
    'scoop with lip (single compartment, front-row offset active)',
    {
      params: {
        scoop: { enabled: true, radius: 'auto' },
        base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
      },
    }
  ),
  defineScenario(
    'scoop + lip interaction',
    'scoop with lip + 2 rows (front-row offset vs interior-row)',
    {
      params: {
        scoop: { enabled: true, radius: 'auto' },
        base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
        compartments: { cols: 1, rows: 2, cells: [0, 1], thickness: 0.8 },
      },
    }
  ),
];

// ─── 9. Label tabs (from snapshots:282-315) ─────────────────────────────────

const labelTabs: ScenarioCase[] = [
  defineScenario('label tabs', '2×2 label disabled', {
    params: {
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: false, support: 'bracket', alignment: 'left' },
    },
  }),
  defineScenario('label tabs', '2×2 label bracket left', {
    params: {
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, support: 'bracket', alignment: 'left' },
    },
  }),
  defineScenario('label tabs', '2×2 label solid left', {
    params: {
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, support: 'solid', alignment: 'left' },
    },
  }),
  defineScenario('label tabs', '2×2 label bracket center', {
    params: {
      label: {
        ...DEFAULT_BIN_PARAMS.label,
        enabled: true,
        support: 'bracket',
        alignment: 'center',
      },
    },
  }),
  defineScenario('label tabs', '2×2 label bracket right', {
    params: {
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, support: 'bracket', alignment: 'right' },
    },
  }),
];

// ─── 10. Inserts (from snapshots:321-338) ───────────────────────────────────

const inserts: ScenarioCase[] = [
  defineScenario('inserts', '2×2 with circle insert', {
    params: { inserts: [makeInsert({ shape: 'circle', width: 20, depth: 20 })] },
  }),
  defineScenario('inserts', '2×2 with rounded-rect insert', {
    params: {
      inserts: [makeInsert({ shape: 'rounded-rect', width: 30, depth: 20, cornerRadius: 3 })],
    },
  }),
  defineScenario('inserts', '2×2 with hexagon insert', {
    params: { inserts: [makeInsert({ shape: 'hexagon', width: 20, depth: 20 })] },
  }),
  defineScenario('inserts', '2×2 with rectangle insert', {
    params: { inserts: [makeInsert({ shape: 'rectangle', width: 30, depth: 20 })] },
  }),
  defineScenario('inserts', '2×2 with slot insert', {
    params: { inserts: [makeInsert({ shape: 'slot', width: 30, depth: 10 })] },
  }),
];

// ─── 11. Multiple inserts (from snapshots:344-355) ──────────────────────────

const multipleInserts: ScenarioCase[] = [
  defineScenario('multiple inserts', '2×2 with 2 circle inserts', {
    params: {
      inserts: [
        makeInsert({ id: 'a', shape: 'circle', x: -10, y: 0, width: 20, depth: 20 }),
        makeInsert({ id: 'b', shape: 'circle', x: 10, y: 0, width: 20, depth: 20 }),
      ],
    },
  }),
];

// ─── 12. Solid cutouts (from snapshots:361-526) ─────────────────────────────

const solidCutouts: ScenarioCase[] = [
  defineScenario('solid cutouts', '2×2 solid with rectangle cutout', {
    params: {
      style: 'solid',
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
      cutouts: [makeCutout({ shape: 'rectangle' })],
    },
  }),
  defineScenario('solid cutouts', '2×2 solid with circle cutout', {
    params: {
      style: 'solid',
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
      cutouts: [makeCutout({ shape: 'circle', width: 20, depth: 20 })],
    },
  }),
  defineScenario('solid cutouts', '2×2 solid with rectangle with scoop cutout', {
    params: {
      style: 'solid',
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
      cutouts: [makeCutout({ shape: 'rectangle', scoopRadius: 3 })],
    },
  }),
  defineScenario('solid cutouts', '2×2 solid with rounded-rectangle cutout', {
    params: {
      style: 'solid',
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
      cutouts: [makeCutout({ shape: 'rectangle', cornerRadius: 3 })],
    },
  }),
  defineScenario('solid cutouts', '2×2 solid with rotated 45° cutout', {
    params: {
      style: 'solid',
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
      cutouts: [makeCutout({ shape: 'rectangle', rotation: 45 })],
    },
  }),
  defineScenario('solid cutouts', '2×2 solid with ellipse cutout', {
    params: {
      style: 'solid',
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
      cutouts: [makeCutout({ shape: 'circle', width: 20, depth: 30 })],
    },
  }),
  defineScenario('solid cutouts', '2×2 solid with grouped cutouts', {
    params: {
      style: 'solid',
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
      cutouts: [
        makeCutout({ id: 'g-a', x: -5, y: 0, groupId: 'g1' }),
        makeCutout({ id: 'g-b', x: 10, y: 0, groupId: 'g1' }),
      ],
    },
  }),
  defineScenario('solid cutouts', '2×2 solid with triangular path cutout', {
    params: {
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
    },
  }),
  defineScenario('solid cutouts', '2×2 solid with curved path cutout (bezier handles)', {
    params: {
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
    },
  }),
  defineScenario('solid cutouts', '2×2 solid with path cutout having closing bezier curve', {
    params: {
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
    },
  }),
  defineScenario('solid cutouts', '2×2 solid with topOffset', {
    params: {
      style: 'solid',
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
      cutoutConfig: { topOffset: 3 },
      cutouts: [makeCutout({ shape: 'rectangle', cutDepth: 5 })],
    },
  }),
];

// ─── 13. Half-sockets (from snapshots:532-550) ──────────────────────────────

const halfSockets: ScenarioCase[] = [
  { w: 1, d: 1, label: '1×1' },
  { w: 1.5, d: 1.5, label: '1.5×1.5' },
  { w: 2, d: 2, label: '2×2' },
].map(({ w, d, label }) =>
  defineScenario('half-sockets', `${label} with half sockets`, {
    params: {
      width: w,
      depth: d,
      base: { ...DEFAULT_BIN_PARAMS.base, halfSockets: true },
    },
  })
);

// ─── 14. Slotted variations (from snapshots:556-593) ────────────────────────

const slottedVariations: ScenarioCase[] = [
  defineScenario('slotted variations', 'slotted with Y-axis slots', {
    params: {
      style: 'slotted',
      slotConfig: {
        x: { enabled: false, pitch: 20 },
        y: { enabled: true, pitch: 20 },
        width: 2.0,
        depth: 1.0,
      },
    },
  }),
  defineScenario('slotted variations', 'slotted with both axes', {
    params: {
      style: 'slotted',
      slotConfig: {
        x: { enabled: true, pitch: 20 },
        y: { enabled: true, pitch: 20 },
        width: 2.0,
        depth: 1.0,
      },
    },
  }),
  defineScenario('slotted variations', 'slotted without lip', {
    params: {
      style: 'slotted',
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
    },
  }),
];

// ─── 15. Export mode (from snapshots:599-603) ────────────────────────────────

const exportMode: ScenarioCase[] = [
  defineScenario('export mode', '2×2 default params (forExport=true)', {
    params: {},
    forExport: true,
    timeout: 60_000,
  }),
];

// ─── 16. Large bin (from snapshots:609-613) ─────────────────────────────────

const largeBin: ScenarioCase[] = [
  defineScenario('large bin', '8×8 standard', {
    params: { width: 8, depth: 8 },
    timeout: 60_000,
  }),
];

// ─── 17. Asymmetric dimensions (from snapshots:619-623) ─────────────────────

const asymmetric: ScenarioCase[] = [
  defineScenario('asymmetric dimensions', '0.5×4 extreme asymmetry', {
    params: { width: 0.5, depth: 4 },
  }),
];

// ─── 18. Combined features (from snapshots:629-685) ─────────────────────────

const combinedFeatures: ScenarioCase[] = [
  defineScenario('combined features', '2×2 standard + lip + 2×2 compartments + scoop', {
    params: {
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
      compartments: { cols: 2, rows: 2, cells: [0, 1, 2, 3], thickness: 0.8 },
      scoop: { enabled: true, radius: 'auto' },
    },
    timeout: 60_000,
  }),
  defineScenario('combined features', '4×4 magnet + label bracket + half-sockets', {
    params: {
      width: 4,
      depth: 4,
      base: {
        ...DEFAULT_BIN_PARAMS.base,
        style: 'magnet',
        stackingLip: false,
        halfSockets: true,
      },
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, support: 'bracket' },
    },
    timeout: 60_000,
  }),
  defineScenario('combined features', '1.5×2 flat + slotted + 3×2 merged compartments', {
    params: {
      width: 1.5,
      depth: 2,
      style: 'slotted',
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat' },
      compartments: { cols: 3, rows: 2, cells: [0, 0, 1, 2, 3, 4], thickness: 0.8 },
    },
    timeout: 60_000,
  }),
  defineScenario('combined features', '2×2 compartments + insert (overlap interaction)', {
    params: {
      compartments: { cols: 2, rows: 1, cells: [0, 1], thickness: 0.8 },
      inserts: [makeInsert({ shape: 'circle', width: 15, depth: 15, x: 0, y: 0 })],
    },
  }),
  defineScenario('combined features', '2×2 label tabs with merged compartments', {
    params: {
      compartments: { cols: 3, rows: 2, cells: [0, 0, 1, 2, 3, 4], thickness: 0.8 },
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, support: 'bracket' },
    },
  }),
];

// ─── 19. Integration (from integration:29-192) ──────────────────────────────

const integration: ScenarioCase[] = [
  defineScenario('integration', 'generates a 1x1 bin without lip', {
    assert: 'structural',
    params: {
      width: 1,
      depth: 1,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
    },
  }),
  defineScenario('integration', 'generates a 1x1 bin with lip', {
    assert: 'structural',
    params: {
      width: 1,
      depth: 1,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
    },
    customAssert: (result) => {
      expect(result.triangleCount).toBeGreaterThan(100);
    },
  }),
  defineScenario('integration', 'generates a 2x2 bin (DEFAULT_BIN_PARAMS)', {
    assert: 'structural',
    params: {},
    timeout: 60_000,
    customAssert: (result) => {
      expect(result.triangleCount).toBeGreaterThan(100);
    },
  }),
  defineScenario('integration', '1.5x2 bin with segmented sockets (full + half cells)', {
    assert: 'structural',
    params: {
      width: 1.5,
      depth: 2,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
    },
    timeout: 60_000,
  }),
  defineScenario('integration', '0.5x0.5 bin with single half-cell socket', {
    assert: 'structural',
    params: {
      width: 0.5,
      depth: 0.5,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
    },
  }),
  defineScenario('integration', '1.5x1.5 bin with lip', {
    assert: 'structural',
    params: {
      width: 1.5,
      depth: 1.5,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
    },
    timeout: 60_000,
  }),
  defineScenario('integration', '0.5x1 bin with half-width socket cell', {
    assert: 'structural',
    params: {
      width: 0.5,
      depth: 1,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
    },
  }),
  defineScenario('integration', '1.5x2 bin with magnets only in full cells', {
    assert: 'structural',
    params: {
      width: 1.5,
      depth: 2,
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet', stackingLip: false },
    },
    timeout: 60_000,
    customAssert: (result) => {
      expect(result.triangleCount).toBeGreaterThan(100);
    },
  }),
  defineScenario('integration', '1x1x3 bin with honeycomb walls (export mode)', {
    assert: 'structural',
    params: {
      width: 1,
      depth: 1,
      height: 3,
      wallPattern: { enabled: true, pattern: 'honeycomb' },
    },
    forExport: true,
    timeout: 120_000,
    customAssert: (result) => {
      expect(result.triangleCount).toBeGreaterThan(100);
    },
  }),
  defineScenario('integration', '1x1x3 bin with honeycomb walls (preview mode)', {
    assert: 'structural',
    params: {
      width: 1,
      depth: 1,
      height: 3,
      wallPattern: { enabled: true, pattern: 'honeycomb' },
    },
    timeout: 120_000,
    customAssert: (result) => {
      expect(result.triangleCount).toBeGreaterThan(100);
    },
  }),
  defineScenario('integration', '1x1x3 bin WITHOUT honeycomb walls', {
    assert: 'structural',
    params: {
      width: 1,
      depth: 1,
      height: 3,
      wallPattern: { enabled: false, pattern: 'honeycomb' },
    },
    timeout: 60_000,
    customAssert: (result) => {
      expect(result.triangleCount).toBeGreaterThan(100);
    },
  }),
];

// ─── 20. Edge cases (from edge-cases:46-606) ────────────────────────────────

const edgeCases: ScenarioCase[] = [
  // Small bins
  defineScenario('edge cases', '0.5x0.5x2 minimal bin', {
    assert: 'structural',
    params: { width: 0.5, depth: 0.5, height: 2 },
  }),
  defineScenario('edge cases', '1x1x2 small bin', {
    assert: 'structural',
    params: { width: 1, depth: 1, height: 2 },
  }),
  defineScenario('edge cases', '0.5x1x2 half-width bin', {
    assert: 'structural',
    params: { width: 0.5, depth: 1, height: 2 },
  }),

  // Complex compartments
  defineScenario('edge cases', '2x2 with 2x2 compartments', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      compartments: { cols: 2, rows: 2, cells: [0, 1, 2, 3], thickness: 0.8 },
    },
  }),
  defineScenario('edge cases', '2x2 with 4x4 compartments', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      compartments: {
        cols: 4,
        rows: 4,
        cells: Array.from({ length: 16 }, (_, i) => i),
        thickness: 0.8,
      },
    },
  }),
  defineScenario('edge cases', '1x1 with 2x2 compartments', {
    assert: 'structural',
    params: {
      width: 1,
      depth: 1,
      compartments: { cols: 2, rows: 2, cells: [0, 1, 2, 3], thickness: 0.8 },
    },
  }),

  // Inserts
  defineScenario('edge cases', '2x2 with circle insert', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      inserts: [
        makeInsert({
          shape: 'circle',
          width: 20,
          depth: 20,
          cutDepth: 5,
          x: 0,
          y: 0,
          cornerRadius: 0,
        }),
      ],
    },
  }),
  defineScenario('edge cases', '2x2 with rectangle insert', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      inserts: [
        makeInsert({
          shape: 'rounded-rect',
          width: 30,
          depth: 20,
          cutDepth: 5,
          x: 0,
          y: 0,
          cornerRadius: 3,
        }),
      ],
    },
  }),

  // Extreme heights
  defineScenario('edge cases', '2x2x20 tall bin', {
    assert: 'structural',
    params: { width: 2, depth: 2, height: 20 },
  }),

  // Stress: many compartments
  defineScenario('edge cases', '4x4 with 8x8 compartments', {
    assert: 'structural',
    params: {
      width: 4,
      depth: 4,
      compartments: {
        cols: 8,
        rows: 8,
        cells: Array.from({ length: 64 }, (_, i) => i),
        thickness: 0.8,
      },
    },
    timeout: 60_000,
  }),
  defineScenario('edge cases', '2x2 with 8x8 compartments (tiny cells)', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      compartments: {
        cols: 8,
        rows: 8,
        cells: Array.from({ length: 64 }, (_, i) => i),
        thickness: 0.4,
      },
    },
    timeout: 60_000,
  }),

  // Stress: multiple inserts
  defineScenario('edge cases', '4x4 with 4 inserts', {
    assert: 'structural',
    params: {
      width: 4,
      depth: 4,
      inserts: [
        makeInsert({
          id: 'i1',
          shape: 'circle',
          width: 20,
          depth: 20,
          cutDepth: 5,
          x: -30,
          y: -30,
        }),
        makeInsert({ id: 'i2', shape: 'circle', width: 20, depth: 20, cutDepth: 5, x: 30, y: -30 }),
        makeInsert({ id: 'i3', shape: 'circle', width: 20, depth: 20, cutDepth: 5, x: -30, y: 30 }),
        makeInsert({ id: 'i4', shape: 'circle', width: 20, depth: 20, cutDepth: 5, x: 30, y: 30 }),
      ],
    },
  }),

  // Flat floor
  defineScenario('edge cases', '2x2x3 flat floor', {
    assert: 'structural',
    params: { base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat' } },
  }),
  defineScenario('edge cases', '1x1x2 flat floor', {
    assert: 'structural',
    params: {
      width: 1,
      depth: 1,
      height: 2,
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat' },
    },
  }),
  defineScenario('edge cases', '2x2x3 flat floor with stacking lip', {
    assert: 'structural',
    params: { base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat', stackingLip: true } },
  }),
  defineScenario('edge cases', '2x2x3 flat floor without stacking lip', {
    assert: 'structural',
    params: { base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat', stackingLip: false } },
  }),
  defineScenario('edge cases', '2x2x3 flat floor with compartments', {
    assert: 'structural',
    params: {
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat' },
      compartments: { cols: 2, rows: 2, cells: [0, 1, 2, 3], thickness: 0.8 },
    },
  }),
  defineScenario('edge cases', '0.5x0.5x2 flat floor (half-bin)', {
    assert: 'structural',
    params: {
      width: 0.5,
      depth: 0.5,
      height: 2,
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat' },
    },
  }),

  // Stress: all features combined
  defineScenario('edge cases', '4x4 with everything enabled', {
    assert: 'structural',
    params: {
      width: 4,
      depth: 4,
      height: 6,
      compartments: { cols: 2, rows: 2, cells: [0, 1, 2, 3], thickness: 0.8 },
      inserts: [makeInsert({ shape: 'circle', width: 15, depth: 15, cutDepth: 3, x: 0, y: 0 })],
    },
    timeout: 60_000,
  }),

  // Cutout edge-finding robustness
  defineScenario('edge cases', '2x2 with minimum cutout and scoop', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 4,
      cutouts: [makeCutout({ id: 'min-cutout', width: 2, depth: 2, cutDepth: 2, scoopRadius: 2 })],
    },
  }),
  defineScenario('edge cases', '2x2 with grouped cutouts at 45° rotation and scoop', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 4,
      cutouts: [
        makeCutout({
          id: 'group-1',
          width: 10,
          depth: 10,
          cutDepth: 3,
          x: -5,
          y: -5,
          rotation: 45,
          groupId: 'g1',
          scoopRadius: 2,
        }),
        makeCutout({
          id: 'group-2',
          width: 10,
          depth: 10,
          cutDepth: 3,
          x: 5,
          y: 5,
          rotation: 45,
          groupId: 'g1',
          scoopRadius: 2,
        }),
      ],
    },
  }),
  defineScenario('edge cases', '2x2 with grouped cutouts at mixed rotations and scoop', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 4,
      cutouts: [
        makeCutout({
          id: 'group-1',
          width: 12,
          depth: 8,
          cutDepth: 3,
          x: -6,
          groupId: 'g1',
          scoopRadius: 2,
        }),
        makeCutout({
          id: 'group-2',
          width: 12,
          depth: 8,
          cutDepth: 3,
          x: 6,
          rotation: 90,
          groupId: 'g1',
          scoopRadius: 2,
        }),
      ],
    },
  }),
  defineScenario('edge cases', '2x2 with ungrouped cutout at 135° rotation and scoop', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 4,
      cutouts: [
        makeCutout({
          id: 'solo',
          width: 15,
          depth: 10,
          cutDepth: 3,
          rotation: 135,
          scoopRadius: 2,
        }),
      ],
    },
  }),
  defineScenario('edge cases', '2x2 with cutout and excessive scoop radius', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 4,
      cutouts: [
        makeCutout({ id: 'excessive', width: 20, depth: 20, cutDepth: 3, scoopRadius: 10 }),
      ],
    },
  }),
  defineScenario('edge cases', '2x2 with stacking lip and cutouts with scoop', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 4,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
      cutouts: [makeCutout({ id: 'with-lip', shape: 'circle', cutDepth: 3, scoopRadius: 2 })],
    },
  }),

  // Half sockets
  defineScenario('edge cases', '2x2 with half sockets', {
    assert: 'structural',
    params: { base: { ...DEFAULT_BIN_PARAMS.base, halfSockets: true } },
  }),
  defineScenario('edge cases', '1x1 with half sockets', {
    assert: 'structural',
    params: {
      width: 1,
      depth: 1,
      height: 3,
      base: { ...DEFAULT_BIN_PARAMS.base, halfSockets: true },
    },
  }),
  defineScenario('edge cases', '1.5x1.5 with half sockets', {
    assert: 'structural',
    params: {
      width: 1.5,
      depth: 1.5,
      height: 3,
      base: { ...DEFAULT_BIN_PARAMS.base, halfSockets: true },
    },
  }),
  defineScenario('edge cases', '2x2 with half sockets and magnet style (holes on original cells)', {
    assert: 'structural',
    params: { base: { ...DEFAULT_BIN_PARAMS.base, halfSockets: true, style: 'magnet' } },
  }),
  defineScenario('edge cases', '2x2 with half sockets and stacking lip', {
    assert: 'structural',
    params: { base: { ...DEFAULT_BIN_PARAMS.base, halfSockets: true, stackingLip: true } },
  }),

  // WASM degenerate geometry guards
  defineScenario('edge cases', 'solid mode with cutoutTopOffset >= wallHeight (zero fillHeight)', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 3,
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true, stackingLip: false },
      cutoutConfig: { topOffset: 100 },
    },
  }),
  defineScenario('edge cases', 'solid mode with solidSurfaceZ <= 0 and cutouts present', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 3,
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true, stackingLip: false },
      cutoutConfig: { topOffset: 100 },
      cutouts: [makeCutout({ id: 'unreachable', width: 20, depth: 20 })],
    },
  }),
  defineScenario('edge cases', 'solid mode with cutout cutDepth > solidSurfaceZ', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 3,
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true, stackingLip: false },
      cutoutConfig: { topOffset: 10 },
      cutouts: [makeCutout({ id: 'deep', width: 20, depth: 20, cutDepth: 50 })],
    },
  }),
  defineScenario('edge cases', 'insert with excessive cornerRadius (clamped gracefully)', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      inserts: [
        makeInsert({
          shape: 'rounded-rect',
          width: 5,
          depth: 5,
          cutDepth: 3,
          x: 0,
          y: 0,
          cornerRadius: 100,
        }),
      ],
    },
  }),
  defineScenario('edge cases', 'insert with zero cutDepth (skipped gracefully)', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      inserts: [makeInsert({ shape: 'circle', width: 20, depth: 20, cutDepth: 0, x: 0, y: 0 })],
    },
  }),
  defineScenario('edge cases', 'solid mode with zero-width cutout (skipped gracefully)', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 3,
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true, stackingLip: false },
      cutouts: [makeCutout({ id: 'zero-w', width: 0, depth: 20 })],
    },
  }),
  defineScenario('edge cases', 'solid mode with zero-depth cutout (skipped gracefully)', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 3,
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true, stackingLip: false },
      cutouts: [makeCutout({ id: 'zero-d', width: 20, depth: 0 })],
    },
  }),
  defineScenario('edge cases', '0.5x0.5 with thick walls (near-zero inner dimensions)', {
    assert: 'structural',
    params: {
      width: 0.5,
      depth: 0.5,
      height: 2,
      wallThickness: 2.4,
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat', stackingLip: false },
    },
  }),
  defineScenario('edge cases', 'label tab with tabDepth >= wallHeight', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 2,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
      label: {
        enabled: true,
        support: 'bracket',
        depth: 20,
        width: 100,
        alignment: 'left',
      },
    },
  }),
  defineScenario(
    'edge cases',
    'label tab bracket with gussetLeg <= 0 (tabDepth <= wallThickness)',
    {
      assert: 'structural',
      params: {
        width: 2,
        depth: 2,
        height: 4,
        wallThickness: 2.4,
        base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
        label: {
          enabled: true,
          support: 'bracket',
          depth: 2,
          width: 100,
          alignment: 'left',
        },
      },
    }
  ),
  defineScenario('edge cases', 'label tab solid with gussetLeg <= 0 (tabDepth <= wallThickness)', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 4,
      wallThickness: 2.4,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
      label: {
        enabled: true,
        support: 'solid',
        depth: 2,
        width: 100,
        alignment: 'left',
      },
    },
  }),
  defineScenario('edge cases', 'solid mode with grouped cutouts including zero-width member', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 4,
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true, stackingLip: false },
      cutouts: [
        makeCutout({ id: 'good', groupId: 'g1' }),
        makeCutout({ id: 'bad', width: 0, x: 20, groupId: 'g1' }),
      ],
    },
  }),
];

// ─── 21. Solid mode (from solid:29-167) ─────────────────────────────────────

const solidMode: ScenarioCase[] = [
  defineScenario('solid mode', 'generates a valid mesh when solid=true', {
    assert: 'structural',
    params: {
      width: 1,
      depth: 1,
      height: 3,
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true, stackingLip: false },
    },
    forExport: true,
  }),
  defineScenario(
    'solid mode',
    'solid bin has fewer triangles than hollow bin (no interior cavity)',
    {
      assert: 'structural',
      params: {
        width: 1,
        depth: 1,
        height: 3,
        base: { ...DEFAULT_BIN_PARAMS.base, solid: true, stackingLip: false },
      },
      forExport: true,
      timeout: 60_000,
      compareWith: {
        params: {
          width: 1,
          depth: 1,
          height: 3,
          base: { ...DEFAULT_BIN_PARAMS.base, solid: false, stackingLip: false },
        },
        forExport: true,
        assert: (solidResult, hollowResult) => {
          expect(solidResult.triangleCount).toBeLessThan(hollowResult.triangleCount);
          expect(solidResult.triangleCount).toBeGreaterThan(10);
        },
      },
    }
  ),
  defineScenario('solid mode', 'solid bin with stacking lip produces valid mesh', {
    assert: 'structural',
    params: {
      width: 1,
      depth: 1,
      height: 3,
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true, stackingLip: true },
    },
    forExport: true,
  }),
  defineScenario(
    'solid mode',
    'solid bin with cutout at corner (0,0) produces valid mesh within bin bounds',
    {
      assert: 'structural',
      params: {
        width: 2,
        depth: 2,
        height: 3,
        style: 'solid',
        base: { ...DEFAULT_BIN_PARAMS.base, solid: true, stackingLip: false },
        cutouts: [makeCutout({ id: 'corner-cutout', width: 10, depth: 10 })],
      },
      forExport: true,
      customAssert: (result) => {
        const outerW = 2 * 42 - 0.5;
        const outerD = outerW;
        const halfW = outerW / 2;
        const halfD = outerD / 2;
        const vertices = result.vertices;
        for (let i = 0; i < vertices.length; i += 3) {
          const x = vertices[i];
          const y = vertices[i + 1];
          expect(x).toBeGreaterThanOrEqual(-halfW - 0.1);
          expect(x).toBeLessThanOrEqual(halfW + 0.1);
          expect(y).toBeGreaterThanOrEqual(-halfD - 0.1);
          expect(y).toBeLessThanOrEqual(halfD + 0.1);
        }
      },
    }
  ),
  defineScenario('solid mode', 'solid bin with centered cutout has more triangles than without', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 3,
      style: 'solid',
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true, stackingLip: false },
      cutouts: [makeCutout({ id: 'center-cutout', x: 20, y: 20 })],
    },
    forExport: true,
    timeout: 60_000,
    compareWith: {
      params: {
        width: 2,
        depth: 2,
        height: 3,
        style: 'solid',
        base: { ...DEFAULT_BIN_PARAMS.base, solid: true, stackingLip: false },
      },
      forExport: true,
      assert: (cutoutResult, plainResult) => {
        expect(cutoutResult.triangleCount).toBeGreaterThan(plainResult.triangleCount);
      },
    },
  }),
];

// ─── 22. Wall cutouts (from wall-cutouts:32-96) ─────────────────────────────

const wallCutouts: ScenarioCase[] = [
  defineScenario('wall cutouts', 'standard bin with global wall cutouts', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 5,
      walls: {
        ...DEFAULT_BIN_PARAMS.walls,
        enabled: true,
        width: 70,
        depth: 50,
      },
    },
    timeout: 60_000,
  }),
  defineScenario('wall cutouts', 'slotted bin with per-side wall cutouts', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 5,
      style: 'slotted',
      walls: {
        enabled: true,
        shape: 'u-shape',
        width: 0,
        depth: 0,
        front: { enabled: true, width: 80, depth: 60 },
        back: { enabled: false, width: 0, depth: 0 },
        left: { enabled: true, width: 50, depth: 40 },
        right: { enabled: false, width: 0, depth: 0 },
        interior: { enabled: false, width: 0, depth: 0 },
      },
    },
    timeout: 60_000,
  }),
  defineScenario('wall cutouts', 'standard bin with interior wall cutouts and compartments', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 5,
      compartments: { cols: 2, rows: 2, cells: [0, 1, 2, 3], thickness: 1.2 },
      walls: {
        enabled: true,
        shape: 'u-shape',
        width: 70,
        depth: 50,
        front: { enabled: false, width: 0, depth: 0 },
        back: { enabled: false, width: 0, depth: 0 },
        left: { enabled: false, width: 0, depth: 0 },
        right: { enabled: false, width: 0, depth: 0 },
        interior: { enabled: true, width: 70, depth: 50 },
      },
    },
    timeout: 60_000,
  }),
];

// ─── 23. Cutout offset (from cutout-offset:32-129) ──────────────────────────

const cutoutOffset: ScenarioCase[] = [
  defineScenario('cutout offset', 'positions cutout with zero offset flush with rim', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 5,
      style: 'solid',
      cutoutConfig: { topOffset: 0 },
      cutouts: [makeCutout({ id: 'test-1', x: 10, y: 10, width: 20, cutDepth: 10 })],
    },
  }),
  defineScenario('cutout offset', 'positions cutout with 5mm offset below rim', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 5,
      style: 'solid',
      cutoutConfig: { topOffset: 5 },
      cutouts: [
        makeCutout({
          id: 'test-2',
          shape: 'circle',
          x: 10,
          y: 10,
          width: 25,
          depth: 25,
          cutDepth: 10,
        }),
      ],
    },
  }),
  defineScenario('cutout offset', 'handles maximum offset (near floor)', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 5,
      style: 'solid',
      cutoutConfig: { topOffset: 34.5 },
      cutouts: [makeCutout({ id: 'test-3', x: 5, y: 5, cutDepth: 0.5, cornerRadius: 2 })],
    },
  }),
];

// ─── 24. Grouped scoop (from grouped-scoop:39-246) ──────────────────────────

const solidBase: Partial<BinParams> = {
  width: 2,
  depth: 2,
  height: 3,
  style: 'solid',
  base: { ...DEFAULT_BIN_PARAMS.base, solid: true, stackingLip: false },
};

const groupedScoop: ScenarioCase[] = [
  defineScenario('grouped scoop', 'circle + rectangle group with scoop generates valid mesh', {
    assert: 'structural',
    params: {
      ...solidBase,
      cutouts: [
        makeCutout({ id: 'rect-1', x: 10, y: 20, width: 20, groupId: 'g1', scoopRadius: 2 }),
        makeCutout({
          id: 'circle-1',
          shape: 'circle',
          x: 25,
          y: 20,
          width: 16,
          depth: 16,
          groupId: 'g1',
          scoopRadius: 2,
        }),
      ],
    },
    forExport: true,
  }),
  defineScenario('grouped scoop', 'two overlapping rectangles with scoop generates valid mesh', {
    assert: 'structural',
    params: {
      ...solidBase,
      cutouts: [
        makeCutout({
          id: 'rect-a',
          x: 10,
          y: 15,
          width: 25,
          depth: 12,
          groupId: 'g2',
          scoopRadius: 2,
        }),
        makeCutout({
          id: 'rect-b',
          x: 20,
          y: 10,
          width: 12,
          depth: 25,
          groupId: 'g2',
          scoopRadius: 2,
        }),
      ],
    },
    forExport: true,
  }),
  defineScenario('grouped scoop', 'group with different cut depths and scoop', {
    assert: 'structural',
    params: {
      ...solidBase,
      cutouts: [
        makeCutout({
          id: 'shallow',
          x: 10,
          y: 15,
          width: 20,
          cutDepth: 3,
          groupId: 'g3',
          scoopRadius: 1.5,
        }),
        makeCutout({
          id: 'deep',
          shape: 'circle',
          x: 25,
          y: 15,
          width: 14,
          depth: 14,
          cutDepth: 6,
          groupId: 'g3',
          scoopRadius: 1.5,
        }),
      ],
    },
    forExport: true,
  }),
  defineScenario(
    'grouped scoop',
    'aggressive scoop radius near maximum tests progressive fallback',
    {
      assert: 'structural',
      params: {
        ...solidBase,
        cutouts: [
          makeCutout({
            id: 'rect-big',
            x: 10,
            y: 15,
            width: 20,
            depth: 12,
            groupId: 'g4',
            scoopRadius: 5.5,
          }),
          makeCutout({
            id: 'circle-big',
            shape: 'circle',
            x: 25,
            y: 15,
            width: 12,
            depth: 12,
            groupId: 'g4',
            scoopRadius: 5.5,
          }),
        ],
      },
      forExport: true,
    }
  ),
  defineScenario('grouped scoop', 'rotated shapes in group with scoop', {
    assert: 'structural',
    params: {
      ...solidBase,
      cutouts: [
        makeCutout({
          id: 'rotated-rect',
          x: 20,
          y: 20,
          width: 25,
          depth: 10,
          rotation: 45,
          groupId: 'g5',
          scoopRadius: 2,
        }),
        makeCutout({
          id: 'circle-overlap',
          shape: 'circle',
          x: 30,
          y: 20,
          width: 14,
          depth: 14,
          groupId: 'g5',
          scoopRadius: 2,
        }),
      ],
    },
    forExport: true,
  }),
];

// ─── 25. Lip-wall #781 (from lip-wall:43-117) ──────────────────────────────

const HEIGHT_781 = 10;
const meshWallHeight781 = HEIGHT_781 * GRIDFINITY.HEIGHT_UNIT;

const lipWallCases = [
  { width: 6, depth: 2, label: '6x2 (reported in #781, small bin)' },
  { width: 4, depth: 4, label: '4x4 (threshold)' },
  { width: 5, depth: 4, label: '5x4 (above threshold)' },
  { width: 8, depth: 2, label: '8x2 (large, elongated)' },
];

const lipWall: ScenarioCase[] = lipWallCases.map(({ width, depth, label }) => {
  const outerW = width * SIZE - GRIDFINITY.TOLERANCE;
  const outerD = depth * SIZE - GRIDFINITY.TOLERANCE;

  return defineScenario('lip-wall #781', `${label} slotted + stacking lip preview`, {
    assert: 'structural',
    params: {
      width,
      depth,
      height: HEIGHT_781,
      style: 'slotted',
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
    },
    timeout: 120_000,
    customAssert: (result) => {
      const zMin = meshWallHeight781 - 2.0;
      const zMax = meshWallHeight781 + 1.0;
      const stats = countWallVerticesInZone(result, outerW, outerD, zMin, zMax, 1.5);

      // Lip must exist (maxZ above wallHeight)
      expect(stats.maxZ).toBeGreaterThan(meshWallHeight781);

      // Each outer wall must have vertices in the lip junction zone
      expect(stats.left).toBeGreaterThanOrEqual(2);
      expect(stats.right).toBeGreaterThanOrEqual(2);
      expect(stats.front).toBeGreaterThanOrEqual(2);
      expect(stats.back).toBeGreaterThanOrEqual(2);
    },
  });
});

// ─── All scenarios ──────────────────────────────────────────────────────────

export const ALL_SCENARIOS: readonly ScenarioCase[] = [
  ...dimensions,
  ...baseStyles,
  ...binStyles,
  ...heightVariations,
  ...wallThickness,
  ...compartments,
  ...scoop,
  ...scoopLipInteraction,
  ...labelTabs,
  ...inserts,
  ...multipleInserts,
  ...solidCutouts,
  ...halfSockets,
  ...slottedVariations,
  ...exportMode,
  ...largeBin,
  ...asymmetric,
  ...combinedFeatures,
  ...integration,
  ...edgeCases,
  ...solidMode,
  ...wallCutouts,
  ...cutoutOffset,
  ...groupedScoop,
  ...lipWall,
];

/** Get unique category names in definition order. */
export function getCategories(): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const s of ALL_SCENARIOS) {
    if (!seen.has(s.category)) {
      seen.add(s.category);
      result.push(s.category);
    }
  }
  return result;
}

/** Get all scenarios for a given category. */
export function getScenariosByCategory(category: string): ScenarioCase[] {
  return ALL_SCENARIOS.filter((s) => s.category === category);
}

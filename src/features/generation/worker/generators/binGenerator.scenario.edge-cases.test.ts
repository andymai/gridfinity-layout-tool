/**
 * Edge case tests to find generation failures.
 * These test various parameter combinations that might cause issues.
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';
import type { MeshData } from '@/features/generation/bridge/types';

type GenerateFn = (
  params: BinParams,
  onProgress?: (stage: string, progress: number) => void
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

function testParams(name: string, overrides: Partial<BinParams>, timeout = 30000) {
  const params: BinParams = { ...DEFAULT_BIN_PARAMS, ...overrides };
  it(
    name,
    () => {
      const result = generateBin(params);
      expect(result.vertices).toBeDefined();
      expect(result.vertices.length).toBeGreaterThan(0);
      expect(result.triangleCount).toBeGreaterThan(0);
    },
    timeout
  );
}

describe('edge case generation', () => {
  describe('small bins', () => {
    testParams('0.5x0.5x2 minimal bin', { width: 0.5, depth: 0.5, height: 2 });
    testParams('1x1x2 small bin', { width: 1, depth: 1, height: 2 });
    testParams('0.5x1x2 half-width bin', { width: 0.5, depth: 1, height: 2 });
  });

  describe('complex compartments', () => {
    testParams('2x2 with 2x2 compartments', {
      width: 2,
      depth: 2,
      compartments: { cols: 2, rows: 2, cells: [0, 1, 2, 3], thickness: 0.8 },
    });
    testParams('2x2 with 4x4 compartments', {
      width: 2,
      depth: 2,
      compartments: {
        cols: 4,
        rows: 4,
        cells: Array.from({ length: 16 }, (_, i) => i),
        thickness: 0.8,
      },
    });
    testParams('1x1 with 2x2 compartments', {
      width: 1,
      depth: 1,
      compartments: { cols: 2, rows: 2, cells: [0, 1, 2, 3], thickness: 0.8 },
    });
  });

  describe('inserts', () => {
    testParams('2x2 with circle insert', {
      width: 2,
      depth: 2,
      inserts: [
        { shape: 'circle', width: 20, depth: 20, cutDepth: 5, x: 0, y: 0, cornerRadius: 0 },
      ],
    });
    testParams('2x2 with rectangle insert', {
      width: 2,
      depth: 2,
      inserts: [
        { shape: 'rounded-rect', width: 30, depth: 20, cutDepth: 5, x: 0, y: 0, cornerRadius: 3 },
      ],
    });
  });

  describe('extreme heights', () => {
    testParams('2x2x20 tall bin', { width: 2, depth: 2, height: 20 });
  });

  describe('stress tests - many compartments', () => {
    testParams(
      '4x4 with 8x8 compartments',
      {
        width: 4,
        depth: 4,
        compartments: {
          cols: 8,
          rows: 8,
          cells: Array.from({ length: 64 }, (_, i) => i),
          thickness: 0.8,
        },
      },
      60000
    );
    testParams(
      '2x2 with 8x8 compartments (tiny cells)',
      {
        width: 2,
        depth: 2,
        compartments: {
          cols: 8,
          rows: 8,
          cells: Array.from({ length: 64 }, (_, i) => i),
          thickness: 0.4,
        },
      },
      60000
    );
  });

  describe('stress tests - multiple inserts', () => {
    testParams('4x4 with 4 inserts', {
      width: 4,
      depth: 4,
      inserts: [
        { shape: 'circle', width: 20, depth: 20, cutDepth: 5, x: -30, y: -30, cornerRadius: 0 },
        { shape: 'circle', width: 20, depth: 20, cutDepth: 5, x: 30, y: -30, cornerRadius: 0 },
        { shape: 'circle', width: 20, depth: 20, cutDepth: 5, x: -30, y: 30, cornerRadius: 0 },
        { shape: 'circle', width: 20, depth: 20, cutDepth: 5, x: 30, y: 30, cornerRadius: 0 },
      ],
    });
  });

  describe('flat floor (no socket)', () => {
    testParams('2x2x3 flat floor', {
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat' },
    });
    testParams('1x1x2 flat floor', {
      width: 1,
      depth: 1,
      height: 2,
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat' },
    });
    testParams('2x2x3 flat floor with stacking lip', {
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat', stackingLip: true },
    });
    testParams('2x2x3 flat floor without stacking lip', {
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat', stackingLip: false },
    });
    testParams('2x2x3 flat floor with compartments', {
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat' },
      compartments: { cols: 2, rows: 2, cells: [0, 1, 2, 3], thickness: 0.8 },
    });
    testParams('0.5x0.5x2 flat floor (half-bin)', {
      width: 0.5,
      depth: 0.5,
      height: 2,
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat' },
    });
  });

  describe('stress tests - all features combined', () => {
    testParams(
      '4x4 with everything enabled',
      {
        width: 4,
        depth: 4,
        height: 6,
        compartments: { cols: 2, rows: 2, cells: [0, 1, 2, 3], thickness: 0.8 },
        inserts: [
          { shape: 'circle', width: 15, depth: 15, cutDepth: 3, x: 0, y: 0, cornerRadius: 0 },
        ],
      },
      60000
    );
  });

  describe('cutout edge-finding robustness', () => {
    // Test minimum-size cutout with scoop (edge-finding may find fewer edges)
    testParams('2x2 with minimum cutout and scoop', {
      width: 2,
      depth: 2,
      height: 4,
      cutouts: [
        {
          id: 'min-cutout',
          shape: 'rectangle',
          width: 2,
          depth: 2,
          cutDepth: 2,
          x: 0,
          y: 0,
          rotation: 0,
          cornerRadius: 0,
          label: '',
          groupId: null,
          scoopRadius: 2,
        },
      ],
    });

    // Test grouped cutouts with extreme rotation and scoop
    testParams('2x2 with grouped cutouts at 45° rotation and scoop', {
      width: 2,
      depth: 2,
      height: 4,
      cutouts: [
        {
          id: 'group-1',
          shape: 'rectangle',
          width: 10,
          depth: 10,
          cutDepth: 3,
          x: -5,
          y: -5,
          rotation: 45,
          cornerRadius: 0,
          label: '',
          groupId: 'g1',
          scoopRadius: 2,
        },
        {
          id: 'group-2',
          shape: 'rectangle',
          width: 10,
          depth: 10,
          cutDepth: 3,
          x: 5,
          y: 5,
          rotation: 45,
          cornerRadius: 0,
          label: '',
          groupId: 'g1',
          scoopRadius: 2,
        },
      ],
    });

    // Test grouped cutouts with multiple rotations
    testParams('2x2 with grouped cutouts at mixed rotations and scoop', {
      width: 2,
      depth: 2,
      height: 4,
      cutouts: [
        {
          id: 'group-1',
          shape: 'rectangle',
          width: 12,
          depth: 8,
          cutDepth: 3,
          x: -6,
          y: 0,
          rotation: 0,
          cornerRadius: 0,
          label: '',
          groupId: 'g1',
          scoopRadius: 2,
        },
        {
          id: 'group-2',
          shape: 'rectangle',
          width: 12,
          depth: 8,
          cutDepth: 3,
          x: 6,
          y: 0,
          rotation: 90,
          cornerRadius: 0,
          label: '',
          groupId: 'g1',
          scoopRadius: 2,
        },
      ],
    });

    // Test ungrouped cutout with scoop at extreme rotation
    testParams('2x2 with ungrouped cutout at 135° rotation and scoop', {
      width: 2,
      depth: 2,
      height: 4,
      cutouts: [
        {
          id: 'solo',
          shape: 'rectangle',
          width: 15,
          depth: 10,
          cutDepth: 3,
          x: 0,
          y: 0,
          rotation: 135,
          cornerRadius: 0,
          label: '',
          groupId: null,
          scoopRadius: 2,
        },
      ],
    });

    // Test cutout with scoop larger than cutDepth (should clamp)
    testParams('2x2 with cutout and excessive scoop radius', {
      width: 2,
      depth: 2,
      height: 4,
      cutouts: [
        {
          id: 'excessive',
          shape: 'rectangle',
          width: 20,
          depth: 20,
          cutDepth: 3,
          x: 0,
          y: 0,
          rotation: 0,
          cornerRadius: 0,
          label: '',
          groupId: null,
          scoopRadius: 10, // Much larger than cutDepth
        },
      ],
    });

    // Test stacking lip with cutouts (both features enabled)
    testParams('2x2 with stacking lip and cutouts with scoop', {
      width: 2,
      depth: 2,
      height: 4,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
      cutouts: [
        {
          id: 'with-lip',
          shape: 'circle',
          width: 15,
          depth: 15,
          cutDepth: 3,
          x: 0,
          y: 0,
          rotation: 0,
          cornerRadius: 0,
          label: '',
          groupId: null,
          scoopRadius: 2,
        },
      ],
    });
  });

  describe('half sockets', () => {
    testParams('2x2 with half sockets', {
      base: { ...DEFAULT_BIN_PARAMS.base, halfSockets: true },
    });
    testParams('1x1 with half sockets', {
      width: 1,
      depth: 1,
      height: 3,
      base: { ...DEFAULT_BIN_PARAMS.base, halfSockets: true },
    });
    testParams('1.5x1.5 with half sockets', {
      width: 1.5,
      depth: 1.5,
      height: 3,
      base: { ...DEFAULT_BIN_PARAMS.base, halfSockets: true },
    });
    testParams('2x2 with half sockets and magnet style (holes on original cells)', {
      base: { ...DEFAULT_BIN_PARAMS.base, halfSockets: true, style: 'magnet' },
    });
    testParams('2x2 with half sockets and stacking lip', {
      base: { ...DEFAULT_BIN_PARAMS.base, halfSockets: true, stackingLip: true },
    });
  });

  describe('WASM degenerate geometry guards', () => {
    // Solid mode: cutoutTopOffset >= wallHeight → fillHeight <= 0
    testParams('solid mode with cutoutTopOffset >= wallHeight (zero fillHeight)', {
      width: 2,
      depth: 2,
      height: 3,
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true, stackingLip: false },
      cutoutConfig: { topOffset: 100 }, // Exceeds wallHeight (~16mm)
    });

    // Solid mode: solidSurfaceZ <= 0 with cutouts present (exercises the guard in buildCutoutCuts)
    testParams('solid mode with solidSurfaceZ <= 0 and cutouts present', {
      width: 2,
      depth: 2,
      height: 3,
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true, stackingLip: false },
      cutoutConfig: { topOffset: 100 },
      cutouts: [
        {
          id: 'unreachable',
          shape: 'rectangle',
          width: 20,
          depth: 20,
          cutDepth: 5,
          x: 0,
          y: 0,
          rotation: 0,
          cornerRadius: 0,
          label: '',
          groupId: null,
          scoopRadius: 0,
        },
      ],
    });

    // Solid mode: cutout cutDepth exceeds solidSurfaceZ (extends below floor)
    testParams('solid mode with cutout cutDepth > solidSurfaceZ', {
      width: 2,
      depth: 2,
      height: 3,
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true, stackingLip: false },
      cutoutConfig: { topOffset: 10 },
      cutouts: [
        {
          id: 'deep',
          shape: 'rectangle',
          width: 20,
          depth: 20,
          cutDepth: 50, // Much deeper than solidSurfaceZ
          x: 0,
          y: 0,
          rotation: 0,
          cornerRadius: 0,
          label: '',
          groupId: null,
          scoopRadius: 0,
        },
      ],
    });

    // Insert with corner radius exceeding half min dimension (clamped to valid range)
    testParams('insert with excessive cornerRadius (clamped gracefully)', {
      width: 2,
      depth: 2,
      inserts: [
        {
          shape: 'rounded-rect',
          width: 5,
          depth: 5,
          cutDepth: 3,
          x: 0,
          y: 0,
          cornerRadius: 100, // Far exceeds min(5,5)/2 = 2.5
        },
      ],
    });

    // Insert with zero cutDepth
    testParams('insert with zero cutDepth (skipped gracefully)', {
      width: 2,
      depth: 2,
      inserts: [
        { shape: 'circle', width: 20, depth: 20, cutDepth: 0, x: 0, y: 0, cornerRadius: 0 },
      ],
    });

    // Cutout with zero width
    testParams('solid mode with zero-width cutout (skipped gracefully)', {
      width: 2,
      depth: 2,
      height: 3,
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true, stackingLip: false },
      cutouts: [
        {
          id: 'zero-w',
          shape: 'rectangle',
          width: 0,
          depth: 20,
          cutDepth: 5,
          x: 0,
          y: 0,
          rotation: 0,
          cornerRadius: 0,
          label: '',
          groupId: null,
          scoopRadius: 0,
        },
      ],
    });

    // Cutout with zero depth
    testParams('solid mode with zero-depth cutout (skipped gracefully)', {
      width: 2,
      depth: 2,
      height: 3,
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true, stackingLip: false },
      cutouts: [
        {
          id: 'zero-d',
          shape: 'rectangle',
          width: 20,
          depth: 0,
          cutDepth: 5,
          x: 0,
          y: 0,
          rotation: 0,
          cornerRadius: 0,
          label: '',
          groupId: null,
          scoopRadius: 0,
        },
      ],
    });

    // Small bin with thick walls → near-zero inner dimensions
    testParams('0.5x0.5 with thick walls (near-zero inner dimensions)', {
      width: 0.5,
      depth: 0.5,
      height: 2,
      wallThickness: 2.4,
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat', stackingLip: false },
    });

    // Label tab where tabDepth >= wallHeight (hits pre-existing early return)
    testParams('label tab with tabDepth >= wallHeight', {
      width: 2,
      depth: 2,
      height: 2, // wallHeight ~9mm
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
      label: {
        enabled: true,
        support: 'bracket',
        depth: 20, // Exceeds wallHeight
        width: 100,
        alignment: 'left',
      },
    });

    // Label tab where tabDepth <= wallThickness → gussetLeg <= 0 (exercises bracket guard)
    testParams('label tab bracket with gussetLeg <= 0 (tabDepth <= wallThickness)', {
      width: 2,
      depth: 2,
      height: 4, // wallHeight ~23mm, plenty of room
      wallThickness: 2.4,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
      label: {
        enabled: true,
        support: 'bracket',
        depth: 2, // tabHeight = 2 < wt = 2.4, so gussetLeg = -0.4
        width: 100,
        alignment: 'left',
      },
    });

    // Label tab solid support where tabDepth <= wallThickness → gussetLeg <= 0
    testParams('label tab solid with gussetLeg <= 0 (tabDepth <= wallThickness)', {
      width: 2,
      depth: 2,
      height: 4,
      wallThickness: 2.4,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
      label: {
        enabled: true,
        support: 'solid',
        depth: 2, // tabHeight = 2 < wt = 2.4
        width: 100,
        alignment: 'left',
      },
    });

    // Grouped cutouts with some zero-dimension members
    testParams('solid mode with grouped cutouts including zero-width member', {
      width: 2,
      depth: 2,
      height: 4,
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true, stackingLip: false },
      cutouts: [
        {
          id: 'good',
          shape: 'rectangle',
          width: 15,
          depth: 15,
          cutDepth: 5,
          x: 0,
          y: 0,
          rotation: 0,
          cornerRadius: 0,
          label: '',
          groupId: 'g1',
          scoopRadius: 0,
        },
        {
          id: 'bad',
          shape: 'rectangle',
          width: 0,
          depth: 15,
          cutDepth: 5,
          x: 20,
          y: 0,
          rotation: 0,
          cornerRadius: 0,
          label: '',
          groupId: 'g1',
          scoopRadius: 0,
        },
      ],
    });
  });
});

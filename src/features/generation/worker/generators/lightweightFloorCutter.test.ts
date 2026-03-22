// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs } from './__dual-kernel__/wasmInit';

beforeAll(async () => {
  await initBrepjs();
}, 30_000);

const cellOpts = () => ({
  gridUnitMm: 42,
  fractionalEdgeX: 'end' as const,
  fractionalEdgeY: 'end' as const,
});

describe('buildLightweightFloorCutters', () => {
  it('returns [] when lightweight is false', async () => {
    const { buildLightweightFloorCutters } = await import('./lightweightFloorCutter');
    const result = buildLightweightFloorCutters(2, 2, 3.25, 2, cellOpts(), false);
    expect(result).toEqual([]);
  });

  it('returns 4 cutters for 2x2 grid (1 per full cell)', async () => {
    const { buildLightweightFloorCutters } = await import('./lightweightFloorCutter');
    const result = buildLightweightFloorCutters(2, 2, 3.25, 2, cellOpts());
    expect(result).toHaveLength(4);
  });

  it('includes fractional cells with full floor cutout', async () => {
    const { buildLightweightFloorCutters } = await import('./lightweightFloorCutter');
    // 1.5×1.5 = 1 full cell (cross cutout) + fractional cells (full rectangular cutout)
    const result = buildLightweightFloorCutters(1.5, 1.5, 3.25, 2, cellOpts());
    expect(result.length).toBeGreaterThan(1);
  });

  it('each cutter is a valid Shape3D with geometry', async () => {
    const { buildLightweightFloorCutters } = await import('./lightweightFloorCutter');
    const { mesh } = await import('brepjs');
    const result = buildLightweightFloorCutters(2, 2, 3.25, 2, cellOpts());
    for (const cutter of result) {
      expect(cutter).toBeDefined();
      const tessellated = mesh(cutter, { tolerance: 0.5, angularTolerance: 15 });
      expect(tessellated.vertices.length).toBeGreaterThan(0);
    }
  });

  it('returns [] when pad exceeds half cell (arms too narrow)', async () => {
    const { buildLightweightFloorCutters } = await import('./lightweightFloorCutter');
    // magnetRadius=19 -> padHalf=21, hw=42/2=21, arm=21-21=0 < MIN_ARM_WIDTH
    const result = buildLightweightFloorCutters(1, 1, 19, 2, cellOpts());
    expect(result).toEqual([]);
  });
});

// @vitest-environment node
/**
 * The end support must carry the leaning wall without touching it: every
 * point of the support stays at least the gap away from the wall's outer plane,
 * measured square to the slope, and the slope comes back to exactly that gap so
 * the wall actually rests on it. A support that is merely watertight and the
 * right size can still sit clear of the wall, or cut into it.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import { boundingBox, meshTopologyStats } from './__kernel-tests__/meshAssertions';
import { exportSlantSupport, generateSlantSupport } from './slantSupportBuilder';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import { planSlantSupport, SLANT_SUPPORT_GAP_MM } from '@/shared/utils/slantPlan';
import type { BinParams } from '@/shared/types/bin';
import type { MeshData } from '../../bridge/types';
import type { SlantSide } from '@/core/types';

beforeAll(async () => {
  await initBrepjs();
}, 120_000);

function params(side: SlantSide, angleDeg = 45, overrides: Partial<BinParams> = {}): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: 1,
    depth: 2,
    height: 6,
    base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
    ...overrides,
    slant: { angleDeg, side, endSupport: true },
  };
}

/**
 * Each vertex's horizontal clearance past the wall plane, rotated so the lean
 * points along +u. Socket vertices below the pivot are measured against the
 * footprint edge instead, since the wall only leans above it.
 */
function clearances(support: MeshData, p: BinParams): number[] {
  const plan = planSlantSupport(p);
  if (!plan) throw new Error('expected a support plan');
  const { axis, sign, k } = plan.slant;
  const pitch = axis === 'x' ? p.gridUnitMm : (p.gridUnitMmY ?? p.gridUnitMm);
  const binHalf = ((axis === 'x' ? p.width : p.depth) * pitch - 0.5) / 2;
  const out: number[] = [];
  const v = support.vertices;
  for (let i = 0; i < v.length; i += 3) {
    const u = sign * v[i + (axis === 'x' ? 0 : 1)];
    const z = v[i + 2];
    const wall = binHalf + k * Math.max(0, z - plan.pivotZ);
    out.push(u - wall);
  }
  return out;
}

describe('slant end support', () => {
  it.each(['front', 'back', 'left', 'right'] as const)(
    'stands on the %s side, the gap away from the wall and touching it',
    (side) => {
      const p = params(side);
      const plan = planSlantSupport(p);
      const support = generateSlantSupport(p, undefined, true);
      expect(plan && support).toBeTruthy();
      if (!plan || !support) return;
      const topo = meshTopologyStats(support);
      expect(topo.boundaryEdges).toBe(0);
      expect(topo.nonManifoldEdges).toBe(0);

      const gapHorizontal = SLANT_SUPPORT_GAP_MM * Math.hypot(1, plan.slant.k);
      const c = clearances(support, p);
      expect(Math.min(...c)).toBeGreaterThan(Math.min(0.5, gapHorizontal) - 1e-3);
      // The slope sits exactly the gap off the wall above the socket.
      const v = support.vertices;
      const onSlope = c.filter(
        (_, i) => v[i * 3 + 2] > plan.pivotZ + 1 && v[i * 3 + 2] < plan.topZ - 1
      );
      expect(Math.min(...onSlope)).toBeCloseTo(gapHorizontal, 2);

      const box = boundingBox(support.vertices);
      expect(box.minZ).toBeCloseTo(0, 3);
      expect(box.maxZ).toBeCloseTo(plan.topZ, 2);
    },
    120_000
  );

  it('is long enough that the leaning top edge still lands on it', () => {
    for (const angle of [20, 45, 60]) {
      const p = params('back', angle);
      const plan = planSlantSupport(p);
      if (!plan) throw new Error('expected a support plan');
      const binHalf = (p.depth * p.gridUnitMm - 0.5) / 2;
      const farEdge = binHalf + plan.lengthU * p.gridUnitMm;
      const topEdge =
        binHalf + plan.topOffsetMm + SLANT_SUPPORT_GAP_MM * Math.hypot(1, plan.slant.k);
      expect(farEdge).toBeGreaterThanOrEqual(topEdge);
      expect(farEdge - p.gridUnitMm / 2).toBeLessThan(topEdge);
    }
  });

  it('never overlaps the slanted bin beside it', () => {
    const p = params('right', 50);
    const bin = getGenerateBin()(p, undefined, true);
    // The bin stays inside its own leaning wall plane, and the first test keeps
    // the support the gap beyond it, so the two cannot meet.
    expect(Math.max(...clearances(bin, p))).toBeLessThan(1e-3);
  }, 120_000);

  it('builds on a flat base and on a low-profile socket', () => {
    for (const base of [
      { ...DEFAULT_BIN_PARAMS.base, stackingLip: false, style: 'flat' as const },
      { ...DEFAULT_BIN_PARAMS.base, stackingLip: false, lowProfile: true },
    ]) {
      const p = params('back', 40, { base });
      const support = generateSlantSupport(p, undefined, true);
      if (!support) throw new Error('expected a support');
      expect(meshTopologyStats(support).boundaryEdges).toBe(0);
      expect(boundingBox(support.vertices).minZ).toBeCloseTo(0, 3);
    }
  }, 120_000);

  it('exports centred on itself', async () => {
    const result = await exportSlantSupport(params('left'), 'stl');
    expect(result?.fileName).toBe('gridfinity-1x2-slant-support.stl');
    expect(result?.data.byteLength).toBeGreaterThan(84);
  }, 120_000);

  it('is absent without the end support', () => {
    const p = { ...params('back'), slant: { angleDeg: 45, side: 'back' as const } };
    expect(planSlantSupport(p)).toBeNull();
    expect(generateSlantSupport(p)).toBeNull();
  });
});

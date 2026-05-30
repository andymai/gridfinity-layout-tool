// @vitest-environment node
/**
 * Geometry validation for fractional socket feet (issue #1641).
 *
 * A non-0.5 trailing dimension gives the bin a clipped edge foot matching its
 * true footprint instead of snapping to a half cell. A sub-threshold strip
 * (< MIN_FOOT_TILE_MM) drops the foot entirely, leaving a flat bottom there.
 *
 * Asserted at the socket level (meshing `buildBaseSocket` directly) so the foot
 * extent is isolated from the bin body, plus full-bin structural validity.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { mesh } from 'brepjs';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import { buildParams } from './__kernel-tests__/scenarioTypes';
import { assertStructurallyValid, boundingBox } from './__kernel-tests__/meshAssertions';
import { MIN_FOOT_TILE_MM } from './socketBuilder';

beforeAll(async () => {
  await initBrepjs();
}, 30_000);

/** Mesh a socket grid and return its AABB width (X span). */
async function socketWidth(gridW: number): Promise<number> {
  const { buildBaseSocket } = await import('./socketBuilder');
  const socket = buildBaseSocket(gridW, 1, false, false, 0, 0, 0, true, false, 42);
  try {
    const m = mesh(socket, { tolerance: 0.1, angularTolerance: 10 });
    const verts = m.vertices instanceof Float32Array ? m.vertices : new Float32Array(m.vertices);
    const bb = boundingBox(verts);
    return bb.maxX - bb.minX;
  } finally {
    socket.delete();
  }
}

describe('fractional socket feet', () => {
  it('emits a clipped edge foot for an above-threshold fractional width', async () => {
    const w1 = await socketWidth(1.0);
    const w13 = await socketWidth(1.3); // 0.3u = 12.6mm foot, above the 8mm floor
    // The 0.3u foot extends the socket footprint well past a single full foot.
    expect(w13).toBeGreaterThan(w1 + 8);
  });

  it('drops a sub-threshold sliver foot (flat bottom there)', async () => {
    const w1 = await socketWidth(1.0);
    // 0.05u = 2.1mm strip is below MIN_FOOT_TILE_MM → no foot, socket == 1u footprint.
    expect(0.05 * 42).toBeLessThan(MIN_FOOT_TILE_MM);
    const w105 = await socketWidth(1.05);
    expect(Math.abs(w105 - w1)).toBeLessThan(1);
  });

  it('matches the half-cell footing for exact 0.5 multiples (backward-safe)', async () => {
    const w15 = await socketWidth(1.5); // 0.5u foot — identical under old + new decomposition
    const w1 = await socketWidth(1.0);
    expect(w15).toBeGreaterThan(w1 + 15); // ~0.5u (21mm) wider footprint
  });

  it('generates a structurally valid bin at an arbitrary fractional size', () => {
    const gen = getGenerateBin();
    const result = gen(buildParams({ width: 1.7, depth: 2.3 }), undefined, true);
    assertStructurallyValid(result, 'fractional 1.7 x 2.3');
  });
});

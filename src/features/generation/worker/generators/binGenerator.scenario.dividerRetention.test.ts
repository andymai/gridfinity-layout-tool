/**
 * Scenario test: removable divider tabs carry the retention neck relief.
 *
 * The wall slot narrows to a throat a short way above the floor
 * (getDividerLockPlan). For that throat to retain the divider instead of being
 * plowed open by it, the tab must be relieved to the neck width across the
 * throat band, leaving the full-thickness head captured below it. This probes
 * the real kernel mesh to assert the relief lands on the throat band above the
 * floor (not flipped to the rim) and only recesses the outer faces, the exact
 * shape that makes the shipped throat actually grip.
 *
 * Cross-kernel:
 *   BREPJS_KERNEL=brepkit pnpm exec vitest run --project=generators dividerRetention
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';
import { getDividerLockPlan } from '@/shared/utils/slotMath';

const INNER_W = 80;
const INNER_D = 80;
const WALL_HEIGHT = 30;

beforeAll(async () => {
  await initBrepjs();
}, 120_000);

describe('divider retention neck relief through the real kernel', () => {
  it('relieves the outer face across the throat band above the floor, not at the rim', async () => {
    const { mesh, box, intersect, unwrap } = await import('brepjs');
    const { buildUniqueDividerPieces } = await import('./dividerBuilder');

    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      style: 'slotted',
      slotConfig: {
        ...DEFAULT_BIN_PARAMS.slotConfig,
        x: { enabled: true, pitch: 40 },
        y: { enabled: false, pitch: 40 },
      },
      dividerPieces: { height: 'auto', thickness: 1.6, clearance: 0.25, floorGroove: true },
    };
    const { thickness, clearance } = params.dividerPieces;
    const lock = getDividerLockPlan(thickness, clearance);
    const depthPerFace = (thickness - lock.neckWidth) / 2;
    expect(depthPerFace).toBeGreaterThan(0);

    const pieces = buildUniqueDividerPieces(params, INNER_W, INNER_D, WALL_HEIGHT, false);
    expect(pieces).toHaveLength(1);
    const piece = pieces[0].shape;

    // Bounds from the mesh: X = length, Y = installed height, Z = thickness.
    const bm = mesh(piece, { tolerance: 0.02, angularTolerance: 8, cache: false });
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < bm.vertices.length; i += 3) {
      for (let a = 0; a < 3; a++) {
        min[a] = Math.min(min[a], bm.vertices[i + a]);
        max[a] = Math.max(max[a], bm.vertices[i + a]);
      }
    }
    const bottomY = min[1];
    const pieceHeight = max[1] - min[1];
    const topFaceZ = max[2];

    // Z-extent of solid found in a thin sliver just inside one thickness face at
    // the tab tip, over an installed-height band. ~0 means the face is relieved.
    // The relief cuts BOTH faces, so probe each: 'top' near Z=thickness, 'bottom'
    // near Z=0.
    const faceProbe = (hLow: number, hHigh: number, face: 'top' | 'bottom'): number => {
      const sliverH = depthPerFace * 0.6;
      const z = face === 'top' ? topFaceZ - sliverH / 2 + 0.02 : sliverH / 2 - 0.02;
      const probe = box(0.4, hHigh - hLow, sliverH, {
        at: [max[0] - 0.5, bottomY + (hLow + hHigh) / 2, z],
      });
      try {
        const s = unwrap(intersect(piece, probe, { optimisation: 'none' }));
        try {
          const m = mesh(s, { tolerance: 0.02, angularTolerance: 8, cache: false });
          let zmin = Infinity;
          let zmax = -Infinity;
          for (let i = 2; i < m.vertices.length; i += 3) {
            zmin = Math.min(zmin, m.vertices[i]);
            zmax = Math.max(zmax, m.vertices[i]);
          }
          return Number.isFinite(zmin) ? zmax - zmin : 0;
        } finally {
          s.delete();
        }
      } catch {
        return 0; // empty intersection
      } finally {
        probe.delete();
      }
    };

    for (const face of ['top', 'bottom'] as const) {
      const headHit = faceProbe(0.1, lock.headHeight - 0.35, face); // below the throat
      const throatHit = faceProbe(
        lock.headHeight + 0.1,
        lock.headHeight + lock.throatHeight - 0.1,
        face
      );
      const topHit = faceProbe(pieceHeight - 1.0, pieceHeight - 0.4, face); // near the rim

      // Face solid at the head and rim, relieved only across the throat band.
      expect(headHit).toBeGreaterThan(depthPerFace * 0.4);
      expect(topHit).toBeGreaterThan(depthPerFace * 0.4);
      expect(throatHit).toBeLessThan(depthPerFace * 0.2);
    }

    for (const p of pieces) p.shape.delete();
  }, 120_000);
});

// @vitest-environment node
/**
 * Regression: geometry must not protrude past its intended footprint.
 *
 *  1. Finger scoop ramps are full-width straight prisms with SQUARE corners,
 *     but the bin cavity has ROUNDED corners (radius BOX_CORNER_RADIUS − wt).
 *     On thin walls (wt < BOX_CORNER_RADIUS·(1 − 1/√2) ≈ 1.1mm) the scoop's
 *     square front-outer corner pokes through the rounded outer wall and sticks
 *     out of the bin. (Mirror of the cavity-cut fix in #1968.)
 *
 *  2. A centered, partial-width label tab rounds BOTH free-end front corners of
 *     the shelf plate, but the gusset/solid/fillet support beneath still runs to
 *     the full square corner — leaving support "points" poking past the rounded
 *     shelf on both edges.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import { assertStructurallyValid } from './__kernel-tests__/meshAssertions';
import { buildParams } from './__kernel-tests__/scenarioTypes';
import { GRIDFINITY } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';
import type { MeshData } from '@/features/generation/bridge/types';

const { GRID_SIZE, HEIGHT_UNIT, TOLERANCE, BOX_CORNER_RADIUS, SOCKET_HEIGHT } = GRIDFINITY;

function gen(over: Partial<BinParams>): MeshData {
  return getGenerateBin()(buildParams(over), undefined, true);
}

/** Signed outside-distance of (x,y) from a rounded rectangle centered at origin. <=0 means inside. */
function outsideRoundedRect(x: number, y: number, w: number, d: number, r: number): number {
  const ax = Math.abs(x) - (w / 2 - r);
  const ay = Math.abs(y) - (d / 2 - r);
  // Both negative → within the straight band; clamp gives the corner distance.
  const cx = Math.max(ax, 0);
  const cy = Math.max(ay, 0);
  return Math.hypot(cx, cy) - r;
}

describe('corner protrusion regressions', () => {
  beforeAll(async () => {
    await initBrepjs();
  }, 30_000);

  it('thin-wall scoop stays inside the rounded outer footprint', () => {
    const wt = 0.8; // below the ~1.1mm threshold
    const m = gen({
      width: 2,
      depth: 2,
      height: 3,
      wallThickness: wt,
      scoop: { enabled: true, radius: 'auto' },
      base: { ...buildParams({}).base, stackingLip: true },
    });
    assertStructurallyValid(m, 'thin-wall scoop');

    const outerW = 2 * GRID_SIZE - TOLERANCE;
    const outerD = 2 * GRID_SIZE - TOLERANCE;
    const v = m.vertices;
    let worst = -Infinity;
    let worstPt: [number, number] | null = null;
    for (let i = 0; i < v.length; i += 3) {
      const out = outsideRoundedRect(v[i], v[i + 1], outerW, outerD, BOX_CORNER_RADIUS);
      if (out > worst) {
        worst = out;
        worstPt = [v[i], v[i + 1]];
      }
    }
    // Allow a small tessellation/precision epsilon.
    expect(
      worst,
      `max protrusion ${worst.toFixed(3)}mm past outer footprint at ${JSON.stringify(worstPt)}`
    ).toBeLessThan(0.05);
  });

  for (const support of ['bracket', 'solid'] as const) {
    it(`centered partial-width label (${support}) has no support spikes past rounded shelf`, () => {
      const wt = 1.2;
      const widthPct = 50;
      const tabDepth = 12;
      const cornerR = 1; // labelTabBuilder shelf corner radius

      const m = gen({
        width: 1,
        depth: 1,
        height: 3,
        wallThickness: wt,
        scoop: { enabled: false, radius: 'auto' },
        base: { ...buildParams({}).base, stackingLip: true },
        label: {
          ...buildParams({}).label,
          enabled: true,
          support,
          alignment: 'center',
          width: widthPct,
          depth: tabDepth,
        },
      });
      assertStructurallyValid(m, `centered label ${support}`);

      const innerW = GRID_SIZE - TOLERANCE - 2 * wt;
      const innerD = GRID_SIZE - TOLERANCE - 2 * wt;
      const tabWidth = (innerW * widthPct) / 100;
      const tabXStart = -tabWidth / 2; // centered
      const backY = innerD / 2; // outer back wall (single 1x1 compartment)
      const frontY = backY - tabDepth; // shelf body extends toward -Y
      const wallHeight = 3 * HEIGHT_UNIT - SOCKET_HEIGHT;
      const tabBaseZ = wallHeight - tabDepth + SOCKET_HEIGHT; // gusset bottom (world Z)
      const tabTopZ = wallHeight + SOCKET_HEIGHT;

      // The two front corners that get rounded. Material in the clipped corner
      // wedge (inside the square corner box, outside the fillet arc) is a spike.
      const corners: Array<{ cx: number; cy: number; arcX: number; arcY: number }> = [
        { cx: tabXStart, cy: frontY, arcX: tabXStart + cornerR, arcY: frontY + cornerR },
        {
          cx: tabXStart + tabWidth,
          cy: frontY,
          arcX: tabXStart + tabWidth - cornerR,
          arcY: frontY + cornerR,
        },
      ];

      const v = m.vertices;
      const spikes: Array<[number, number, number]> = [];
      for (let i = 0; i < v.length; i += 3) {
        const x = v[i];
        const y = v[i + 1];
        const z = v[i + 2];
        if (z < tabBaseZ + 1 || z > tabTopZ + 0.1) continue; // only within the tab
        for (const c of corners) {
          const insideBox =
            Math.abs(x - c.arcX) <= cornerR + 0.01 &&
            Math.abs(y - c.arcY) <= cornerR + 0.01 &&
            // in the square-corner quadrant beyond the arc center
            (c.cx < c.arcX ? x <= c.arcX : x >= c.arcX) &&
            y <= c.arcY;
          if (!insideBox) continue;
          const distFromArc = Math.hypot(x - c.arcX, y - c.arcY);
          if (distFromArc > cornerR + 0.1) spikes.push([x, y, z]);
        }
      }

      expect(
        spikes.length,
        `found ${spikes.length} support-spike vertices, e.g. ${JSON.stringify(spikes[0])}`
      ).toBe(0);
    });
  }
});

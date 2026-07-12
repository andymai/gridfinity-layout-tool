// @vitest-environment node
/**
 * Pins the brepjs `sagittaArcTo` sign convention that `baseplateOutline.ts`
 * depends on — the API is otherwise unused in this repo, so nothing else
 * would catch a behavior change in a brepjs bump.
 *
 * Two facts are pinned:
 *  1. Raw brepjs: positive sagitta bows LEFT of the travel direction.
 *  2. buildOutlineDrawing therefore negates DXF bulges (positive bulge bows
 *     RIGHT of travel), verified end-to-end by extruded volume — an inverted
 *     sign would ADD the circular segment instead of biting it out, which the
 *     volume assertion separates by ~30%.
 *
 * Run per kernel:
 *   pnpm exec vitest run --config vitest.profile.config.ts sagittaArcConvention
 *   BREPJS_KERNEL=manifold pnpm exec vitest run --config vitest.profile.config.ts sagittaArcConvention
 */
import { beforeAll, describe, expect, it } from 'vitest';

import type { DrawerOutline } from '@/core/types';
import { buildOutlineDrawing } from '../baseplateOutline';
import { getKernelName, initBrepjs } from './wasmInit';

beforeAll(async () => {
  await initBrepjs();
}, 120_000);

interface Extrudable {
  extrude: (h: number) => unknown;
}

describe(`sagittaArcTo convention on ${getKernelName()}`, () => {
  it('positive sagitta bows left of the travel direction', async () => {
    const { draw, measureVolume, unwrap } = await import('brepjs');
    // 10×10 square whose top edge (traveled −x) arcs with sagitta +2.5 —
    // left of travel is −y, so the arc bites INTO the square. A multi-edge
    // loop deliberately: a bare arc+chord two-edge drawing hits unrelated
    // brepkit face bugs (bounds spanning the whole circle), while this
    // mirrors how buildOutlineDrawing actually emits arcs.
    const drawing = draw([0, 0])
      .lineTo([10, 0])
      .lineTo([10, 10])
      .sagittaArcTo([0, 10], 2.5)
      .close();
    const solid = (drawing.sketchOnPlane('XY') as unknown as Extrudable).extrude(5);
    // Volume is the convention pin: a right-bowing arc would ADD the segment
    // (+17.47mm² instead of −17.47mm²), a major-arc interpretation would be
    // off by far more. getBounds is deliberately NOT asserted — brepkit
    // reports untrimmed full-circle bounds for arc edges (volume is exact).
    const sweep = 4 * Math.atan(0.5);
    const segmentArea = ((6.25 * 6.25) / 2) * (sweep - Math.sin(sweep));
    const expected = (100 - segmentArea) * 5;
    const volume = unwrap(measureVolume(solid as never));
    expect(volume).toBeGreaterThan(expected * 0.99);
    expect(volume).toBeLessThan(expected * 1.01);
  });

  it('handles semicircle bulges via the arc split', async () => {
    const { measureVolume, unwrap } = await import('brepjs');
    // Full semicircular bite out of the back edge: bulge -1 traveling −x
    // bows left of travel = downward, sagitta 25 = chord/2.
    const outline: DrawerOutline = {
      vertices: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 75, y: 100, bulge: -1 },
        { x: 25, y: 100 },
        { x: 0, y: 100 },
      ],
    };
    const drawing = buildOutlineDrawing(outline, { totalW: 100, totalD: 100, gridUnitMm: 50 });
    const solid = (drawing.sketchOnPlane('XY') as unknown as Extrudable).extrude(5);
    const volume = unwrap(measureVolume(solid as never));
    const expected = (100 * 100 - (Math.PI * 25 * 25) / 2) * 5;
    expect(volume).toBeGreaterThan(expected * 0.99);
    expect(volume).toBeLessThan(expected * 1.01);
  });

  it('buildOutlineDrawing maps DXF bulges onto the correct side', async () => {
    const { measureVolume, unwrap } = await import('brepjs');
    // 100×100 plate whose back edge bows into the plate: traveling −x with
    // DXF bulge −0.5 (bows left of travel = downward). Sagitta 25, chord 100.
    const outline: DrawerOutline = {
      vertices: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100, bulge: -0.5 },
        { x: 0, y: 100 },
      ],
    };
    const drawing = buildOutlineDrawing(outline, { totalW: 100, totalD: 100, gridUnitMm: 50 });
    const solid = (drawing.sketchOnPlane('XY') as unknown as Extrudable).extrude(5);
    const volume = unwrap(measureVolume(solid as never));

    // Circular segment: r = 62.5, sweep = 4·atan(0.5) → area ≈ 1747.6mm².
    const bulge = 0.5;
    const sweep = 4 * Math.atan(bulge);
    const r = (100 * (1 + bulge * bulge)) / (4 * bulge);
    const segmentArea = ((r * r) / 2) * (sweep - Math.sin(sweep));
    const expected = (100 * 100 - segmentArea) * 5;
    expect(volume).toBeGreaterThan(expected * 0.99);
    expect(volume).toBeLessThan(expected * 1.01);
  });
});

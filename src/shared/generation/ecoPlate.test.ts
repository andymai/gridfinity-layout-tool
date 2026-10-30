import { describe, expect, it } from 'vitest';
import { mm } from '@/core/types';
import type { ScrewHoleParams } from '@/core/types/baseplate';
import type { ResolvedBaseplateParams } from '@/shared/types/bin';
import { frameCells } from './cellDecomposition';
import {
  ecoJointCutouts,
  ecoMagnetKeepOuts,
  ecoScrewKeepOuts,
  type EcoJointCutout,
  type EcoKeepOut,
} from './ecoPlate';
import { MAGNET_CHAMFER_MM } from './magnetHoleStyle';
import { planBaseplateScrewHoles, screwPlacementFor } from './screwHolePlacement';
import { SCREW_MARGIN_MIN_WALL_MM } from './screwHolePlan';

const plate = (overrides: Partial<ResolvedBaseplateParams> = {}): ResolvedBaseplateParams => ({
  width: 2,
  depth: 2,
  gridUnitMm: 42,
  magnetHoles: false,
  magnetDiameter: 6.5,
  magnetDepth: 2,
  paddingLeft: 0,
  paddingRight: 0,
  paddingFront: 0,
  paddingBack: 0,
  fractionalEdgeX: 'end',
  fractionalEdgeY: 'end',
  ...overrides,
});

describe('ecoJointCutouts', () => {
  it('relieves internal and exterior joints while leaving their corner ends intact', () => {
    const cutouts = ecoJointCutouts(plate());
    expect(cutouts).toHaveLength(12);
    expect(cutouts).toContainEqual({ x: 0, y: -21, width: 7, depth: 25.2 });
    expect(cutouts).toContainEqual({ x: -42, y: 21, width: 7, depth: 25.2 });
    expect(cutouts).toContainEqual({ x: 21, y: 42, width: 25.2, depth: 7 });
  });

  it('relieves the cell edges beside wide padding and leaves a solid strip outside', () => {
    const cutouts = ecoJointCutouts(plate({ paddingLeft: 10, paddingBack: 10 }));
    expect(cutouts).toHaveLength(12);
    expect(cutouts).toContainEqual({ x: -42, y: 21, width: 7, depth: 25.2 });
    expect(cutouts).toContainEqual({ x: 21, y: 42, width: 25.2, depth: 7 });
  });

  it('runs the relief out through padding too narrow to stand beside it', () => {
    const cutouts = ecoJointCutouts(plate({ paddingLeft: 3, paddingBack: 5.4 }));
    expect(cutouts).toContainEqual({ x: -43.5, y: 21, width: 10, depth: 25.2 });
    const back = cutouts.find((slot) => slot.x === 21 && slot.y > 42);
    expect(back?.y).toBeCloseTo(44.7);
    expect(back?.depth).toBeCloseTo(12.4);
  });

  const screwPlate = (padding: number, screwHoles: ScrewHoleParams): ResolvedBaseplateParams =>
    plate({
      width: 1,
      depth: 1,
      paddingLeft: padding,
      paddingRight: padding,
      paddingFront: padding,
      paddingBack: padding,
      screwHoles,
    });
  const expectClear = (cutouts: EcoJointCutout[], keepOuts: EcoKeepOut[]): void => {
    for (const slot of cutouts) {
      for (const keepOut of keepOuts) {
        const dx = Math.max(Math.abs(keepOut.x - slot.x) - slot.width / 2, 0);
        const dy = Math.max(Math.abs(keepOut.y - slot.y) - slot.depth / 2, 0);
        expect(Math.hypot(dx, dy)).toBeGreaterThanOrEqual(keepOut.radius - 1e-9);
      }
    }
  };

  it('keeps a padding notch out of the wall around a margin screw seat', () => {
    const screwHoles: ScrewHoleParams = {
      enabled: true,
      diameter: mm(3.4),
      headStyle: 'countersink',
      headDiameter: mm(6),
      screwsPerPiece: 8,
    };
    const params = screwPlate(10, screwHoles);
    const holes = planBaseplateScrewHoles(
      screwHoles,
      params,
      screwPlacementFor(screwHoles, params)
    );
    expect(holes.some((hole) => hole.site === 'margin' && hole.x === 0)).toBe(true);
    const keepOuts = ecoScrewKeepOuts(holes, screwHoles);
    const cutouts = ecoJointCutouts(params, [], keepOuts);

    expectClear(cutouts, keepOuts);
    const back = cutouts.find((slot) => slot.x === 0 && slot.y > 0);
    expect(back).toEqual({ x: 0, y: 19.25, width: 25.2, depth: 3.5 });
  });

  it('sizes a screw keep-out from its shaft when the shaft is wider than the head', () => {
    const screwHoles: ScrewHoleParams = {
      enabled: true,
      diameter: mm(8),
      headStyle: 'countersink',
      headDiameter: mm(3),
      screwsPerPiece: 8,
    };
    const params = screwPlate(14, screwHoles);
    const holes = planBaseplateScrewHoles(
      screwHoles,
      params,
      screwPlacementFor(screwHoles, params)
    );
    const keepOuts = ecoScrewKeepOuts(holes, screwHoles);
    expect(keepOuts[0]?.radius).toBeCloseTo(4 + SCREW_MARGIN_MIN_WALL_MM);
    expectClear(ecoJointCutouts(params, [], keepOuts), keepOuts);
  });

  it('widens a chamfered magnet keep-out to the mouth of its pocket', () => {
    const keepOuts = ecoMagnetKeepOuts({ chamfered: [[1, 2]], plain: [[3, 4]] }, 6.5);
    expect(keepOuts).toEqual([
      { x: 3, y: 4, radius: 3.25 + SCREW_MARGIN_MIN_WALL_MM },
      { x: 1, y: 2, radius: 3.25 + MAGNET_CHAMFER_MM + SCREW_MARGIN_MIN_WALL_MM },
    ]);
  });

  it('shortens a joint relief from both ends until a keep-out near its end clears', () => {
    const cutouts = ecoJointCutouts(plate(), [], [{ x: 0, y: -12, radius: 4 }]);
    expect(cutouts).toHaveLength(12);
    expect(cutouts).toContainEqual({ x: 0, y: -21, width: 7, depth: 10 });
  });

  it('drops a joint relief that a keep-out sits in the middle of', () => {
    const cutouts = ecoJointCutouts(plate(), [], [{ x: 0, y: -21, radius: 4 }]);
    expect(cutouts).toHaveLength(11);
    expect(cutouts.some((slot) => slot.x === 0 && slot.y === -21)).toBe(false);
  });

  it('relieves a single cell frame including split join edges', () => {
    expect(ecoJointCutouts(plate({ width: 1, depth: 1 }))).toHaveLength(4);
    expect(
      ecoJointCutouts(
        plate({
          width: 1,
          depth: 1,
          edges: { left: 'join', right: 'join', front: 'join', back: 'join' },
        })
      )
    ).toHaveLength(4);
    expect(
      ecoJointCutouts(
        plate({
          width: 1,
          depth: 1,
          connectorNubs: true,
          connectorSlotsAllEdges: true,
          edges: { left: 'join', right: 'join', front: 'join', back: 'join' },
        })
      )
    ).toHaveLength(4);
  });

  it('relieves half-width cells while keeping a post at each end', () => {
    const cutouts = ecoJointCutouts(plate({ width: 2, depth: 0.5 }));
    expect(cutouts.find((slot) => slot.x === 0 && slot.y === 0)?.width).toBeCloseTo(3.57);
    expect(cutouts).toContainEqual({ x: -21, y: -10.5, width: 25.2, depth: 7 });
  });

  it('relieves tiled margin walls and the join with the nominal grid only once', () => {
    const params = plate({ paddingLeft: 21, overTile: true, overTileHalfGrid: true });
    const margin = frameCells(
      params.width,
      params.depth,
      { left: 21, right: 0, front: 0, back: 0 },
      42,
      8,
      true
    );
    const cutouts = ecoJointCutouts(params, margin);
    expect(cutouts.find((slot) => slot.x === -42 && slot.y === -21)?.width).toBeCloseTo(3.57);
    expect(cutouts.find((slot) => slot.x === -63 && slot.y === 21)?.width).toBeCloseTo(3.57);
    expect(cutouts.find((slot) => slot.x === -52.5 && slot.y === 0)?.depth).toBeCloseTo(3.57);
    expect(cutouts.filter((slot) => slot.x === -42 && slot.y === -21)).toHaveLength(1);
  });

  it('keeps material at tiled margin corners and narrows shared cuts beside small cells', () => {
    const cornerMargin = frameCells(1, 1, { left: 21, right: 0, front: 21, back: 0 }, 42, 8, true);
    const cornerCuts = ecoJointCutouts(
      plate({ width: 1, depth: 1, paddingLeft: 21, paddingFront: 21 }),
      cornerMargin
    );
    const outerVertical = cornerCuts.find((slot) => slot.x === -42 && slot.y === -31.5);
    const outerHorizontal = cornerCuts.find((slot) => slot.x === -31.5 && slot.y === -42);
    expect(outerVertical?.width).toBeCloseTo(3.57);
    expect(outerHorizontal?.depth).toBeCloseTo(3.57);
    const cornerReserve = (21 - (outerVertical?.depth ?? 21) - (outerHorizontal?.depth ?? 21)) / 2;
    expect(cornerReserve).toBeGreaterThan(2);

    const unevenMargin = frameCells(1, 1, { left: 30, right: 0, front: 0, back: 0 }, 42, 8, true);
    const shared = ecoJointCutouts(
      plate({ width: 1, depth: 1, paddingLeft: 30 }),
      unevenMargin
    ).filter((slot) => slot.x === -42 && slot.y === 0 && slot.width < slot.depth);
    expect(shared).toHaveLength(1);
    expect(shared[0].width).toBe(2);
  });

  it('places the relieved joint on the selected side of a fractional column', () => {
    const atStart = ecoJointCutouts(plate({ width: 1.5, depth: 1, fractionalEdgeX: 'start' }));
    const atEnd = ecoJointCutouts(plate({ width: 1.5, depth: 1, fractionalEdgeX: 'end' }));
    expect(atStart.some((slot) => slot.x === -10.5 && slot.width === 7)).toBe(true);
    expect(atEnd.some((slot) => slot.x === 10.5 && slot.width === 7)).toBe(true);
  });
});

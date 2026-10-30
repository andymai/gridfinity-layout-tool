import { describe, expect, it } from 'vitest';
import type { ResolvedBaseplateParams } from '@/shared/types/bin';
import { frameCells } from './cellDecomposition';
import { ecoJointCutouts } from './ecoPlate';

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

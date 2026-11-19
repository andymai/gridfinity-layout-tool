// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { BinParams, WallCutout } from '@/features/bin-designer/types';
import { lipInnerReachMm } from '@/shared/utils/lipNotchPlan';
import {
  pathWallClearance,
  planDividerPathCuts,
  wallCutoutPathsActive,
  type CutoutFrame,
  type DividerPathCut,
} from './wallCutoutPaths';

const INNER_W = 123.1;
const INNER_D = 207.1;
const CELL_W = INNER_W / 3;
const CELL_D = INNER_D / 3;
const FRAME: CutoutFrame = {
  innerW: INNER_W,
  innerD: INNER_D,
  wallHeight: 37.25,
  collarHeight: 0,
  hasLip: true,
  dividerTopZ: 37.25,
  depthPadding: 0,
};

const cut = (enabled: boolean, over: Partial<WallCutout> = {}): WallCutout => ({
  enabled,
  width: 40,
  depth: 50,
  alignment: 'center',
  offset: 0,
  widthMm: null,
  ...over,
});

function bin(
  sides: Partial<Record<'front' | 'back' | 'left' | 'right', WallCutout>>,
  over: Partial<BinParams> = {},
  cells = [0, 1, 2, 3, 4, 5, 6, 7, 8]
): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: 3,
    depth: 5,
    walls: {
      ...DEFAULT_BIN_PARAMS.walls,
      enabled: true,
      shape: 'u-shape',
      front: cut(false),
      back: cut(false),
      left: cut(false),
      right: cut(false),
      ...sides,
      interior: cut(true),
    },
    compartments: { ...DEFAULT_BIN_PARAMS.compartments, cols: 3, rows: 3, cells },
    ...over,
  };
}

/** The cut a side makes in the divider whose midpoint is at (x, y). */
const cutAt = (
  cuts: readonly DividerPathCut[],
  side: string,
  x: number,
  y: number
): DividerPathCut | undefined =>
  cuts.find(
    (c) =>
      c.outer.side === side && Math.abs(c.segment.x - x) < 1e-6 && Math.abs(c.segment.y - y) < 1e-6
  );

describe('wallCutoutPathsActive', () => {
  it('needs the interior toggle and an outer side', () => {
    expect(wallCutoutPathsActive(bin({ front: cut(true) }))).toBe(true);
    expect(wallCutoutPathsActive(bin({}))).toBe(false);
    const noInterior = bin({ front: cut(true) });
    expect(
      wallCutoutPathsActive({
        ...noInterior,
        walls: { ...noInterior.walls, interior: cut(false) },
      })
    ).toBe(false);
  });

  it('leaves removable divider pieces to their own window', () => {
    expect(wallCutoutPathsActive(bin({ front: cut(true) }, { style: 'slotted' }))).toBe(false);
  });
});

describe('planDividerPathCuts', () => {
  const colX = -INNER_W / 2 + CELL_W;
  const rowY = -INNER_D / 2 + CELL_D;

  it('lowers a divider along the path and opens a window in one across it', () => {
    const params = bin({ front: cut(true) });
    const cuts = planDividerPathCuts(params, FRAME);
    const along = cutAt(cuts, 'front', colX, 0);
    const across = cutAt(cuts, 'front', 0, rowY);
    expect(along?.kind).toBe('lowered');
    expect(across?.kind).toBe('window');
    // The window's profile floor is the outer opening's own.
    const floor = FRAME.wallHeight - 0.5 * (FRAME.wallHeight - params.wallThickness);
    expect(across?.zMin).toBeCloseTo(floor, 6);
    // A fillet barely lifts a divider standing just inside its corner.
    expect(along?.loweredTopZ).toBeGreaterThanOrEqual(floor);
    expect(along?.loweredTopZ).toBeLessThan(floor + 0.1);
  });

  it('runs the lowered divider from wall to wall', () => {
    const cuts = planDividerPathCuts(bin({ front: cut(true) }), FRAME);
    const along = cutAt(cuts, 'front', colX, 0);
    expect(along?.wallAtMin && along.wallAtMax).toBe(true);
    expect(along?.uMin).toBeCloseTo(-INNER_D / 2, 6);
    expect(along?.uMax).toBeCloseTo(INNER_D / 2, 6);
  });

  it('keeps the window inside the opening span', () => {
    const cuts = planDividerPathCuts(bin({ front: cut(true) }), FRAME);
    const across = cutAt(cuts, 'front', 0, rowY);
    const half = (0.4 * INNER_W) / 2;
    expect(across?.uMin).toBeCloseTo(-half, 6);
    expect(across?.uMax).toBeCloseTo(half, 6);
  });

  it('leaves a divider centred outside the span standing', () => {
    // A 25% opening ends inside the middle column, short of both dividers.
    const cuts = planDividerPathCuts(bin({ front: cut(true, { width: 25 }) }), FRAME);
    expect(cutAt(cuts, 'front', colX, 0)).toBeUndefined();
    expect(cutAt(cuts, 'front', -colX, 0)).toBeUndefined();
    expect(cutAt(cuts, 'front', 0, rowY)?.kind).toBe('window');
  });

  it('never cuts below a raised floor beside the divider', () => {
    const params = bin({ front: cut(true, { depth: 100 }) });
    const raised: BinParams = {
      ...params,
      compartments: { ...params.compartments, floorRaises: [0, 12] },
    };
    const cuts = planDividerPathCuts(raised, FRAME);
    const along = cutAt(cuts, 'front', colX, 0);
    const plain = cutAt(planDividerPathCuts(params, FRAME), 'front', colX, 0);
    expect(along?.loweredTopZ ?? 0).toBeGreaterThan((plain?.loweredTopZ ?? 0) + 11);
  });

  it('takes a label tab hanging on a cut divider with it', () => {
    const tabs = bin(
      { front: cut(true) },
      { label: { ...DEFAULT_BIN_PARAMS.label, enabled: true } }
    );
    const across = cutAt(planDividerPathCuts(tabs, FRAME), 'front', 0, rowY);
    const bare = cutAt(planDividerPathCuts(bin({ front: cut(true) }), FRAME), 'front', 0, rowY);
    // The tab hangs into the compartment in front of its back wall: -Y.
    expect(across?.vMin ?? 0).toBeLessThan((bare?.vMin ?? 0) - tabs.label.depth + 1);
    expect(across?.vMax).toBeCloseTo(bare?.vMax ?? NaN, 6);
  });

  it('cuts an angled divider where the path crosses it', () => {
    const params = bin({ front: cut(true) });
    const angled: BinParams = {
      ...params,
      compartments: {
        ...params.compartments,
        dividerOverrides: [{ compartmentA: 3, compartmentB: 4, offsetStart: -8, offsetEnd: 8 }],
      },
    };
    const cuts = planDividerPathCuts(angled, FRAME);
    expect(cuts.some((c) => c.kind === 'oblique')).toBe(true);
  });

  it('is empty with no outer side cut', () => {
    expect(planDividerPathCuts(bin({}), FRAME)).toEqual([]);
  });
});

describe('pathWallClearance', () => {
  it('stays a hair off the walls without a lip', () => {
    const sections = pathWallClearance(bin({ front: cut(true) }), { ...FRAME, hasLip: false });
    expect(sections.every((s) => s.front === sections[0].front && s.front < 0.05)).toBe(true);
  });

  it('steps clear of the lip where it stands', () => {
    const params = bin({ front: cut(true) });
    const sections = pathWallClearance(params, FRAME);
    const top = sections[sections.length - 1];
    expect(top.back).toBeGreaterThan(lipInnerReachMm(params) - params.wallThickness);
    expect(sections[0].back).toBeLessThan(0.05);
    // The step starts no higher than the lip's foot.
    const stepped = sections.find((s) => s.back > 0.05);
    expect(stepped?.z ?? Infinity).toBeLessThanOrEqual(FRAME.wallHeight);
  });
});

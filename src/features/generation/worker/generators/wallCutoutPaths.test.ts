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
    expect(wallCutoutPathsActive(bin({ front: cut(true) }), FRAME)).toBe(true);
    expect(wallCutoutPathsActive(bin({}), FRAME)).toBe(false);
    const noInterior = bin({ front: cut(true) });
    expect(
      wallCutoutPathsActive(
        { ...noInterior, walls: { ...noInterior.walls, interior: cut(false) } },
        FRAME
      )
    ).toBe(false);
  });

  it('leaves removable divider pieces to their own window', () => {
    expect(wallCutoutPathsActive(bin({ front: cut(true) }, { style: 'slotted' }), FRAME)).toBe(
      false
    );
  });

  it('needs an outer side that opens, not one set to nothing', () => {
    expect(wallCutoutPathsActive(bin({ front: cut(true, { width: 0 }) }), FRAME)).toBe(false);
    expect(wallCutoutPathsActive(bin({ front: cut(true, { depth: 0 }) }), FRAME)).toBe(false);
    expect(wallCutoutPathsActive(bin({ front: cut(true, { widthMm: 0 }) }), FRAME)).toBe(false);
    const oneOpens = bin({ front: cut(true, { width: 0 }), left: cut(true) });
    expect(wallCutoutPathsActive(oneOpens, FRAME)).toBe(true);
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

  /** Every cut a side makes in the divider whose midpoint is at (x, y), along its run. */
  const cutsAt = (
    cuts: readonly DividerPathCut[],
    side: string,
    x: number,
    y: number
  ): DividerPathCut[] =>
    cuts
      .filter(
        (c) =>
          c.outer.side === side &&
          Math.abs(c.segment.x - x) < 1e-6 &&
          Math.abs(c.segment.y - y) < 1e-6
      )
      .sort((a, b) => a.uMin - b.uMin);

  const raise = (params: BinParams, floorRaises: number[]): BinParams => ({
    ...params,
    compartments: { ...params.compartments, floorRaises },
  });

  it('never cuts below a raised floor beside the divider', () => {
    const params = bin({ front: cut(true, { depth: 100 }) });
    const cuts = planDividerPathCuts(raise(params, [0, 12]), FRAME);
    // Compartment 1 is the front cell of the middle column.
    const [besideRaised] = cutsAt(cuts, 'front', colX, 0);
    const plain = cutAt(planDividerPathCuts(params, FRAME), 'front', colX, 0);
    expect(besideRaised.loweredTopZ ?? 0).toBeGreaterThan((plain?.loweredTopZ ?? 0) + 11);
  });

  it('holds a lowered divider up only beside the raised floor', () => {
    const params = bin({ front: cut(true, { depth: 100 }) });
    const plain = cutAt(planDividerPathCuts(params, FRAME), 'front', colX, 0);
    const runs = cutsAt(planDividerPathCuts(raise(params, [12]), FRAME), 'front', colX, 0);
    expect(runs).toHaveLength(2);
    const [front, rest] = runs;
    expect(front.loweredTopZ ?? 0).toBeGreaterThan((plain?.loweredTopZ ?? 0) + 11);
    expect(rest.loweredTopZ).toBeCloseTo(plain?.loweredTopZ ?? NaN, 6);
    // The two runs meet inside the row divider, a little into the lower one,
    // so the lower cut stays off the raised slab's edge.
    expect(front.uMax).toBeCloseTo(rest.uMin, 9);
    expect(front.uMax).toBeGreaterThan(rowY);
    expect(front.uMax - rowY).toBeLessThan(params.compartments.thickness / 2);
    expect(rest.uMax).toBeCloseTo(INNER_D / 2, 6);
  });

  it('opens a window down to the path floor where no raised floor stands beside it', () => {
    // A 25% opening crosses the row divider in the middle column only. The
    // raised compartment is the front-left one, outside that span.
    const params = bin({ front: cut(true, { width: 25, depth: 90 }) });
    const plain = cutAt(planDividerPathCuts(params, FRAME), 'front', 0, rowY);
    const windows = cutsAt(planDividerPathCuts(raise(params, [12]), FRAME), 'front', 0, rowY);
    expect(windows).toHaveLength(1);
    expect(windows[0].kind).toBe('window');
    expect(windows[0].floorZ).toBeCloseTo(plain?.floorZ ?? NaN, 6);
    expect(windows[0].zMin).toBeCloseTo(plain?.zMin ?? NaN, 6);
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

import type {
  BinParams,
  PullTabCenterAxis,
  PullTabConfig,
  PullTabOuterWall,
  PullTabWall,
} from '@/shared/types/bin';
import { isPartialMask } from './cellMask';
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';
import { effectiveRimFilletRadius } from './rimFillet';
import {
  PULL_TAB_CENTER_MARGIN_MM,
  pullTabCenterDivider,
  resolvePullTabCenter,
} from './pullTabCenterPlan';

export const DEFAULT_PULL_TAB: PullTabConfig = {
  enabled: false,
  wall: 'width',
  backRecess: false,
  thickness: 3,
  width: 50,
  widthMode: 'mm',
  widthPercent: 75,
  height: 12,
  topRadius: 4,
  rootRadius: 4,
  recessHeight: 7,
  recessBorder: 1.2,
  recessDepth: 1,
  recessRadius: 2,
  recessEdgeRadius: 0.4,
  recessInsideRadius: 0.4,
};
export const PULL_TAB_LIMITS = {
  thickness: [0.4, 4],
  width: [12, 500],
  widthPercent: [1, 100],
  height: [3, 40],
  topRadius: [0, 20],
  rootRadius: [0, 20],
  recessHeight: [1, 80],
  recessBorder: [0.8, 20],
  recessDepth: [0, 3.2],
  recessRadius: [0, 20],
  recessEdgeRadius: [0, 6],
  recessInsideRadius: [0, 6],
} as const;

/** Canonical wall order. The picker renders in it and `resolvePullTabWalls` sorts to it. */
export const PULL_TAB_WALLS: readonly PullTabWall[] = ['front', 'back', 'left', 'right', 'center'];
export const PULL_TAB_OUTER_WALLS: readonly PullTabOuterWall[] = ['front', 'back', 'left', 'right'];

function isPullTabWall(value: unknown): value is PullTabWall {
  return typeof value === 'string' && (PULL_TAB_WALLS as readonly string[]).includes(value);
}

/**
 * Every wall this tab stands on, in a stable order. A tab on the front or the
 * right alone stores `wall` and reaches here through the fallback, so geometry
 * never has to know which field a design uses.
 *
 * Filtered and de-duplicated because a repeat would build one tab twice in the
 * same place, a coincident pair the fuse turns into a sliver.
 */
export function resolvePullTabWalls(
  tab: Pick<PullTabConfig, 'wall' | 'walls'>
): readonly PullTabWall[] {
  const raw: unknown = tab.walls;
  if (Array.isArray(raw)) {
    const seen = new Set(raw.filter(isPullTabWall));
    if (seen.size > 0) return PULL_TAB_WALLS.filter((wall) => seen.has(wall));
  }
  return [tab.wall === 'depth' ? 'right' : 'front'];
}

function pullTabWallAxis(wall: PullTabOuterWall): PullTabConfig['wall'] {
  return wall === 'left' || wall === 'right' ? 'depth' : 'width';
}

/**
 * The stored form of a wall selection. Picking the walls in a different
 * sequence, or coming back to the front or right alone, must hash the same.
 */
export function pullTabWallFields(
  walls: readonly PullTabWall[]
): Pick<PullTabConfig, 'wall' | 'walls'> {
  const picked = PULL_TAB_WALLS.filter((wall) => walls.includes(wall));
  if (picked.length === 0 || (picked.length === 1 && picked[0] === 'front'))
    return { wall: 'width' };
  if (picked.length === 1 && picked[0] === 'right') return { wall: 'depth' };
  return { wall: picked[0] === 'center' ? 'width' : pullTabWallAxis(picked[0]), walls: picked };
}

export function resolvePullTab(value: unknown): PullTabConfig {
  const v = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const n = (key: keyof typeof PULL_TAB_LIMITS): number => {
    const number = v[key];
    const [min, max] = PULL_TAB_LIMITS[key];
    return typeof number === 'number' && Number.isFinite(number)
      ? Math.min(max, Math.max(min, number))
      : DEFAULT_PULL_TAB[key];
  };
  const walls = resolvePullTabWalls({
    wall: v.wall === 'depth' ? 'depth' : 'width',
    walls: v.walls as PullTabConfig['walls'],
  });
  // 'width' is what an absent axis means, so only 'depth' is stored.
  const centerAxis: PullTabCenterAxis | undefined =
    walls.includes('center') && v.centerAxis === 'depth' ? 'depth' : undefined;
  return {
    enabled: v.enabled === true,
    ...pullTabWallFields(walls),
    ...(centerAxis ? { centerAxis } : {}),
    backRecess: v.backRecess === true,
    thickness: n('thickness'),
    width: n('width'),
    widthMode: v.widthMode === 'percent' ? 'percent' : 'mm',
    widthPercent: n('widthPercent'),
    height: n('height'),
    topRadius: n('topRadius'),
    rootRadius: n('rootRadius'),
    recessHeight: n('recessHeight'),
    recessBorder: n('recessBorder'),
    recessDepth: n('recessDepth'),
    recessRadius: n('recessRadius'),
    recessEdgeRadius: n('recessEdgeRadius'),
    recessInsideRadius: n('recessInsideRadius'),
  };
}

export type PullTabHost = Partial<
  Pick<
    BinParams,
    | 'style'
    | 'cellMask'
    | 'overhang'
    | 'walls'
    | 'handles'
    | 'wallPattern'
    | 'wallLabelSlots'
    | 'surfaceText'
    | 'pullTab'
    | 'width'
    | 'depth'
    | 'gridUnitMm'
    | 'gridUnitMmY'
    | 'wallThickness'
    | 'compartments'
    | 'label'
    | 'extraWallHeightMm'
  >
> & {
  base: Pick<BinParams['base'], 'style'> & Partial<BinParams['base']>;
  lid: Pick<BinParams['lid'], 'enabled'>;
};

/** Raised tabs require an uninterrupted, straight host wall and clearance above it. */
export function pullTabUnavailableReason(p: PullTabHost): string | undefined {
  if (isPartialMask(p.cellMask)) return 'binDesigner.pullTab.rectangularOnly';
  if (
    (p.style !== undefined && p.style !== 'standard') ||
    p.base.solid ||
    p.base.tile ||
    p.base.spacer
  )
    return 'binDesigner.pullTab.hollowOnly';
  if (p.lid.enabled) return 'binDesigner.pullTab.noLid';
  if (
    p.overhang?.enabled !== false &&
    p.overhang &&
    (p.overhang.left || p.overhang.right || p.overhang.front || p.overhang.back)
  )
    return 'binDesigner.pullTab.noOverhang';
  if (
    p.walls?.enabled ||
    p.handles?.enabled ||
    p.wallPattern?.enabled ||
    p.wallLabelSlots?.enabled ||
    Object.values(p.surfaceText?.walls ?? {}).some((text) => text.trim())
  )
    return 'binDesigner.pullTab.needsPlainWall';
  if (thickenedCavityMm(p) <= 0) return 'binDesigner.pullTab.noRoom';
  return undefined;
}

/**
 * The cavity's smaller side once every chosen wall grows inward, or infinity
 * when the bin's size is not known. Tabs on opposite walls of a narrow bin can
 * otherwise close the cavity up entirely.
 */
function thickenedCavityMm(p: PullTabHost): number {
  const { width, depth, gridUnitMm, wallThickness } = p;
  if (
    width === undefined ||
    depth === undefined ||
    gridUnitMm === undefined ||
    wallThickness === undefined
  )
    return Infinity;
  const tab = resolvePullTab(p.pullTab);
  const extra = Math.max(0, tab.thickness - wallThickness);
  const walls = resolvePullTabWalls(tab);
  const grown = (a: PullTabWall, b: PullTabWall): number =>
    extra * ((walls.includes(a) ? 1 : 0) + (walls.includes(b) ? 1 : 0));
  const inner = (span: number, a: PullTabWall, b: PullTabWall): number =>
    span - GRIDFINITY_SPEC.TOLERANCE - 2 * wallThickness - grown(a, b);
  return Math.min(
    inner(width * gridUnitMm, 'left', 'right'),
    inner(depth * (p.gridUnitMmY ?? gridUnitMm), 'front', 'back')
  );
}

/**
 * Whether an enabled tab builds anything: a center tab alone builds nothing
 * while no divider can carry it. Without the interior height a lowered divider
 * cannot be told apart, and counting the tab is the safe side of a clearance.
 */
export function pullTabBuildsAny(p: PullTabHost): boolean {
  const walls = resolvePullTabWalls(resolvePullTab(p.pullTab));
  if (walls.some((wall) => wall !== 'center')) return true;
  if (!p.compartments || !p.label) return true;
  return !resolvePullTabCenter(
    {
      compartments: p.compartments,
      label: p.label,
      pullTab: p.pullTab,
      extraWallHeightMm: p.extraWallHeightMm,
    },
    null
  ).reason;
}

export function activePullTab(p: BinParams): PullTabConfig | null {
  const tab = resolvePullTab(p.pullTab);
  return tab.enabled && !pullTabUnavailableReason(p) ? tab : null;
}

/** The rounded-rim shell carries the outer-wall tabs; a center tab is never in it. */
export function pullTabInRimShell(p: BinParams): boolean {
  const tab = activePullTab(p);
  return (
    tab !== null &&
    effectiveRimFilletRadius(p) > 0 &&
    resolvePullTabWalls(tab).some((wall) => wall !== 'center')
  );
}

/**
 * Inward growth of each selected wall. A selected wall too short for a tab is
 * still thickened, so a saved one-wall design keeps its geometry.
 */
export function pullTabWallInset(p: BinParams): Readonly<Record<PullTabOuterWall, number>> {
  const tab = activePullTab(p);
  const extra = tab ? Math.max(0, tab.thickness - p.wallThickness) : 0;
  const on = tab ? resolvePullTabWalls(tab) : [];
  const at = (wall: PullTabOuterWall): number => (on.includes(wall) ? extra : 0);
  return { front: at('front'), back: at('back'), left: at('left'), right: at('right') };
}

function firstWall(p: BinParams): PullTabWall {
  return resolvePullTabWalls(resolvePullTab(p.pullTab))[0];
}

/**
 * The axis a tab's width runs along. A center tab runs along its divider,
 * which spans the bin like the walls parallel to it.
 */
function pullTabAxis(p: BinParams, wall: PullTabWall): PullTabCenterAxis {
  if (wall !== 'center') return pullTabWallAxis(wall);
  return pullTabCenterDivider(p)?.axis ?? (p.pullTab?.centerAxis === 'depth' ? 'depth' : 'width');
}

/** Wall length a tab leaves clear, split between its two ends. */
export const PULL_TAB_END_CLEARANCE_MM = 10;

export function availablePullTabWidth(p: BinParams, wall: PullTabWall = firstWall(p)): number {
  return (
    (pullTabAxis(p, wall) === 'width'
      ? p.width * p.gridUnitMm
      : p.depth * (p.gridUnitMmY ?? p.gridUnitMm)) - PULL_TAB_END_CLEARANCE_MM
  );
}

/** Narrowest tab a wall can carry; a shorter wall builds none. */
export const MIN_PULL_TAB_WIDTH = 12;

/** The tab width a wall with `available` mm of room gets, before checking it fits. */
export function pullTabWidth(
  tab: Pick<PullTabConfig, 'width' | 'widthMode' | 'widthPercent'>,
  available: number
): number {
  return Math.min(
    available,
    Math.max(
      MIN_PULL_TAB_WIDTH,
      tab.widthMode === 'percent' ? (available * tab.widthPercent) / 100 : tab.width
    )
  );
}

/** Opposite circular arcs can meet tangentially before either turns 90 degrees. */
function fitRounds(first: number, second: number, rise: number, maxRun: number) {
  if (rise <= 0) return { first: 0, second: 0, angle: Math.PI / 2, run: 0 };
  const sum = first + second;
  const maxSum = maxRun <= rise ? maxRun : (maxRun * maxRun + rise * rise) / (2 * rise);
  const scale = sum > 0 ? Math.min(1, maxSum / sum) : 1;
  const fitted = sum * scale;
  const angle = fitted > rise ? Math.acos(1 - rise / fitted) : Math.PI / 2;
  return { first: first * scale, second: second * scale, angle, run: fitted * Math.sin(angle) };
}

export function planPullTab(
  p: BinParams,
  rimZ: number,
  floorZ: number,
  wall: PullTabWall = firstWall(p)
) {
  const active = activePullTab(p);
  if (!active) return null;
  // Which walls carry a tab is the selection's business, not one tab's: kept
  // out so a change elsewhere in the selection leaves this plan, and the
  // cache keys built from it, unchanged.
  const { wall: _wall, walls: _walls, centerAxis: _centerAxis, ...tab } = active;
  // The rim stands a collar above the wall top, and a lip's taper starts
  // below it: what is left is the height a full divider reaches.
  const interiorHeightMm =
    rimZ -
    Math.max(0, p.extraWallHeightMm ?? 0) -
    (p.base.stackingLip ? GRIDFINITY_SPEC.LIP_SMALL_TAPER : 0);
  const center = wall === 'center' ? resolvePullTabCenter(p, interiorHeightMm) : null;
  if (center && !center.divider) return null;
  const available = availablePullTabWidth(p, wall);
  const width = pullTabWidth(tab, available);
  if (width < MIN_PULL_TAB_WIDTH || rimZ <= floorZ + 1) return null;
  const thickness = Math.max(center ? p.compartments.thickness : p.wallThickness, tab.thickness);
  // Compartments beside a divider can carry shelves and scoops up to the rim,
  // so a center tab's recesses stay clear above it.
  const recessFloorZ = center ? rimZ : floorZ;
  const outline = fitRounds(tab.rootRadius, tab.topRadius, tab.height, width / 2 - 3);
  const topRadius = outline.second;
  const rootRadius = outline.first;
  const tabCornerRise = topRadius * (1 - Math.cos(outline.angle));
  // An inscribed corner stays inside the broad top arc even when its center
  // lies below the rim. At 90 degrees this is the original vertical-side plan.
  const recessSideHalf = width / 2 - outline.run + tabCornerRise;
  const heightBudget = rimZ + tab.height - recessFloorZ - 0.8;
  // A short recess needs a wider border for its rounded top corners to stay
  // inside the tab. Include the floor limit before deriving all three margins.
  const recessBorder = Math.min(
    Math.max(
      tab.recessBorder,
      effectiveRimFilletRadius(p) + 0.2,
      tabCornerRise - tab.recessHeight / 2 + 0.01,
      2 * tabCornerRise - heightBudget + 0.02
    ),
    recessSideHalf - 1,
    heightBudget - 0.2
  );
  const recessTop = rimZ + tab.height - recessBorder;
  const recessHeight = Math.min(tab.recessHeight, recessTop - recessFloorZ - 0.8);
  const recessWidth = 2 * (recessSideHalf - recessBorder);
  const recessDepth = Math.max(
    0,
    Math.min(tab.recessDepth, (thickness - 0.8) / (tab.backRecess ? 2 : 1))
  );
  const recessRadius = Math.min(
    Math.max(tab.recessRadius, tabCornerRise - recessBorder),
    recessHeight / 2 - 0.01,
    recessWidth / 2 - 0.01
  );
  const blend = fitRounds(
    tab.recessEdgeRadius,
    tab.recessInsideRadius,
    recessDepth,
    Math.min(recessHeight, recessWidth) / 2 - 0.05
  );
  const recessEdgeRadius = blend.first;
  const recessInsideRadius = blend.second;
  return {
    ...tab,
    side: wall,
    axis: center?.divider.axis ?? pullTabAxis(p, wall),
    centerAt: center?.divider.at,
    width,
    widthPercent: (width / available) * 100,
    thickness,
    topRadius,
    rootRadius,
    tabCurveAngle: outline.angle,
    tabShoulderRun: outline.run,
    tabCornerRise,
    rimZ,
    // A center tab's body is the thickened divider, so it starts where the
    // dividers do: at the bottom of the floor slab.
    embed: center ? rimZ : Math.min(2, rimZ - floorZ),
    margin: center ? PULL_TAB_CENTER_MARGIN_MM : 0,
    recessTop,
    recessBorder,
    recessHeight,
    recessWidth,
    recessDepth,
    recessRadius,
    recessEdgeRadius,
    recessInsideRadius,
    recessBlendAngle: blend.angle,
    recessBlendWidth: blend.run,
  };
}

export type PullTabPlan = NonNullable<ReturnType<typeof planPullTab>>;

export function planPullTabs(p: BinParams, rimZ: number, floorZ: number): PullTabPlan[] {
  const tab = activePullTab(p);
  if (!tab) return [];
  return resolvePullTabWalls(tab).flatMap((wall) => {
    const plan = planPullTab(p, rimZ, floorZ, wall);
    return plan ? [plan] : [];
  });
}

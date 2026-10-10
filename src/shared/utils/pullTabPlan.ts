import type { BinParams, PullTabConfig } from '@/shared/types/bin';
import { isPartialMask } from './cellMask';
import { effectiveRimFilletRadius } from './rimFillet';

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

export function resolvePullTab(value: unknown): PullTabConfig {
  const v = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const n = (key: keyof typeof PULL_TAB_LIMITS): number => {
    const number = v[key];
    const [min, max] = PULL_TAB_LIMITS[key];
    return typeof number === 'number' && Number.isFinite(number)
      ? Math.min(max, Math.max(min, number))
      : DEFAULT_PULL_TAB[key];
  };
  return {
    enabled: v.enabled === true,
    wall: v.wall === 'depth' ? 'depth' : 'width',
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
    return 'binDesigner.pullTab.solidWall';
  return undefined;
}

export function activePullTab(p: BinParams): PullTabConfig | null {
  const tab = resolvePullTab(p.pullTab);
  return tab.enabled && !pullTabUnavailableReason(p) ? tab : null;
}

export function pullTabInRimShell(p: BinParams): boolean {
  return activePullTab(p) !== null && effectiveRimFilletRadius(p) > 0;
}

/** Front (-Y) for the width wall; right (+X) for the depth wall. */
export function pullTabWallInset(p: BinParams) {
  const tab = activePullTab(p);
  const extra = tab ? Math.max(0, tab.thickness - p.wallThickness) : 0;
  return { x: tab?.wall === 'depth' ? extra : 0, y: tab?.wall === 'width' ? extra : 0 };
}

export function availablePullTabWidth(p: BinParams): number {
  const wall = resolvePullTab(p.pullTab).wall;
  return (
    (wall === 'width' ? p.width * p.gridUnitMm : p.depth * (p.gridUnitMmY ?? p.gridUnitMm)) - 10
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

export function planPullTab(p: BinParams, rimZ: number, floorZ: number) {
  const tab = activePullTab(p);
  if (!tab) return null;
  const available = availablePullTabWidth(p);
  const width = Math.min(
    available,
    Math.max(12, tab.widthMode === 'percent' ? (available * tab.widthPercent) / 100 : tab.width)
  );
  if (width < 12 || rimZ <= floorZ + 1) return null;
  const thickness = Math.max(p.wallThickness, tab.thickness);
  const outline = fitRounds(tab.rootRadius, tab.topRadius, tab.height, width / 2 - 3);
  const topRadius = outline.second;
  const rootRadius = outline.first;
  const tabCornerRise = topRadius * (1 - Math.cos(outline.angle));
  // An inscribed corner stays inside the broad top arc even when its center
  // lies below the rim. At 90 degrees this is the original vertical-side plan.
  const recessSideHalf = width / 2 - outline.run + tabCornerRise;
  const heightBudget = rimZ + tab.height - floorZ - 0.8;
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
  const recessHeight = Math.min(tab.recessHeight, recessTop - floorZ - 0.8);
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
    width,
    widthPercent: (width / available) * 100,
    thickness,
    topRadius,
    rootRadius,
    tabCurveAngle: outline.angle,
    tabShoulderRun: outline.run,
    tabCornerRise,
    rimZ,
    embed: Math.min(2, rimZ - floorZ),
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

import type { BinParams, CompartmentConfig, PullTabCenterAxis } from '@/shared/types/bin';

export const PULL_TAB_CENTER_AXES: readonly PullTabCenterAxis[] = ['width', 'depth'];

/** Lengthwise reach of the thickened divider past each side of the tab's root. */
export const PULL_TAB_CENTER_MARGIN_MM = 2;

/**
 * The divider a center tab stands on: `at` is its line as a fraction of the
 * cavity across it, from the front (a width divider) or the left (a depth
 * divider).
 */
export interface PullTabCenterDivider {
  readonly axis: PullTabCenterAxis;
  readonly at: number;
}

export type PullTabCenterResolution =
  | { readonly divider: PullTabCenterDivider; readonly reason?: undefined }
  | { readonly divider?: undefined; readonly reason: string };

type CenterHost = Pick<BinParams, 'compartments' | 'label' | 'pullTab' | 'extraWallHeightMm'>;

/**
 * Grid lines carrying one straight divider from wall to wall, nearest the
 * cavity's middle first (the front or left one wins a tie).
 *
 * A divider shared by merged cells stops short of a wall, and a tilted or
 * shifted one leaves its grid line, so neither can carry a tab placed on it.
 */
export function wallToWallDividers(c: CompartmentConfig, axis: PullTabCenterAxis): number[] {
  const { cols, rows, cells } = c;
  if (cols < 1 || rows < 1 || cells.length !== cols * rows) return [];
  const at = (col: number, row: number): number | undefined => cells[row * cols + col];
  const overridden = new Set(
    (c.dividerOverrides ?? []).map((o) => `${o.compartmentA}|${o.compartmentB}`)
  );
  const splits = (a: number | undefined, b: number | undefined): boolean =>
    a !== undefined &&
    b !== undefined &&
    a !== b &&
    !overridden.has(a < b ? `${a}|${b}` : `${b}|${a}`);
  const lines = axis === 'width' ? rows : cols;
  const along = axis === 'width' ? cols : rows;
  const found: number[] = [];
  // Integer line indices keep the tie between two lines equally off-center exact.
  const offCenter = (line: number): number => Math.abs(2 * line - lines);
  for (let line = 1; line < lines; line++) {
    let whole = true;
    for (let i = 0; i < along && whole; i++) {
      whole =
        axis === 'width'
          ? splits(at(i, line - 1), at(i, line))
          : splits(at(line - 1, i), at(line, i));
    }
    if (whole) found.push(line);
  }
  return found.sort((a, b) => offCenter(a) - offCenter(b) || a - b).map((line) => line / lines);
}

/**
 * Which divider a center tab stands on, or why none can.
 *
 * The picked axis wins while it has a qualifying divider; otherwise the only
 * axis that has one is used, so a grid edit never leaves a tab on a divider
 * that is gone.
 */
export function resolvePullTabCenter(p: CenterHost): PullTabCenterResolution {
  const picked = p.pullTab?.centerAxis === 'depth' ? 'depth' : 'width';
  const axis = ([picked, picked === 'width' ? 'depth' : 'width'] as const).find(
    (a) => wallToWallDividers(p.compartments, a).length > 0
  );
  if (!axis) return { reason: 'binDesigner.pullTab.center.noDivider' };
  const divider: PullTabCenterDivider = { axis, at: wallToWallDividers(p.compartments, axis)[0] };
  if (typeof p.compartments.dividerHeight === 'number')
    return { reason: 'binDesigner.pullTab.center.lowDivider' };
  // Dividers stop at the nominal height under a collar, so the tab would
  // stand on a fin of its own above them.
  if ((p.extraWallHeightMm ?? 0) > 0) return { reason: 'binDesigner.pullTab.center.collar' };
  // Label shelves hang off the same divider tops, and a spanning one crosses
  // them, so a tab there would stand on a label or split a shelf in two.
  if (p.label.enabled) return { reason: 'binDesigner.pullTab.center.labelTabs' };
  return { divider };
}

/** Axes with a divider a center tab could stand on, in picker order. */
export function pullTabCenterAxes(c: CompartmentConfig): PullTabCenterAxis[] {
  return PULL_TAB_CENTER_AXES.filter((axis) => wallToWallDividers(c, axis).length > 0);
}

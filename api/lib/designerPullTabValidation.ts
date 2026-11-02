/** Pull tab validation for shared bin designs. */

import { isObject } from './validationUtils.js';

export const VALID_PULL_TAB_WALLS: readonly string[] = ['front', 'back', 'left', 'right', 'center'];
export const VALID_PULL_TAB_CENTER_AXES: readonly string[] = ['width', 'depth'];

export const PULL_TAB_RANGES: Record<string, readonly [number, number]> = {
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
};

/** Settings older designs were saved without. */
const OPTIONAL_RANGES = new Set(['recessBorder', 'recessInsideRadius', 'widthPercent']);

const OTHER_KEYS = new Set(['enabled', 'wall', 'walls', 'centerAxis', 'backRecess', 'widthMode']);

function validWalls(walls: unknown): boolean {
  return (
    Array.isArray(walls) &&
    walls.length > 0 &&
    new Set(walls).size === walls.length &&
    walls.every((wall) => typeof wall === 'string' && VALID_PULL_TAB_WALLS.includes(wall))
  );
}

export function validatePullTab(tab: unknown): string | null {
  if (
    !isObject(tab) ||
    typeof tab.enabled !== 'boolean' ||
    (tab.backRecess !== undefined && typeof tab.backRecess !== 'boolean') ||
    (tab.widthMode !== undefined && tab.widthMode !== 'mm' && tab.widthMode !== 'percent') ||
    (tab.wall !== 'width' && tab.wall !== 'depth') ||
    (tab.walls !== undefined && !validWalls(tab.walls)) ||
    (tab.centerAxis !== undefined &&
      !(typeof tab.centerAxis === 'string' && VALID_PULL_TAB_CENTER_AXES.includes(tab.centerAxis)))
  )
    return 'Invalid pull tab configuration';
  for (const key of Object.keys(tab)) {
    if (!OTHER_KEYS.has(key) && !Object.hasOwn(PULL_TAB_RANGES, key))
      return `Unknown pull tab setting: ${key}`;
  }
  for (const [key, [min, max]] of Object.entries(PULL_TAB_RANGES)) {
    const value = tab[key];
    if (OPTIONAL_RANGES.has(key) && value === undefined) continue;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max)
      return `Invalid pull tab ${key}`;
  }
  return null;
}

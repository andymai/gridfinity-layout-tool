import { CONSTRAINTS } from '@/core/constants';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/baseplateDefaults';
import { baseplateFloorDepth } from '@/shared/printSettings/baseplateHeight';
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';
import { fitAxisUnits, halfUnitUpgrade } from '@/shared/utils/drawerFit';
import type { AxisFit } from '@/shared/utils/drawerFit';
import { solveUnitsUnderCeiling, stackedTotalMm } from '@/shared/utils/heightUnits';
import { APP_URL } from '../navigation';

export const MM_PER_INCH = 25.4;

// A drawer link opens a new layout, so it gets the new layout's pitch and its
// default baseplate. The app's height readout charges that plate's floor too.
const GRID_MM = GRIDFINITY_SPEC.GRID_SIZE;
const HEIGHT_UNIT_MM = GRIDFINITY_SPEC.HEIGHT_UNIT;
const PLATE_RISE_MM = baseplateFloorDepth(DEFAULT_BASEPLATE_PARAMS);
const STACK_COUNTS = [1, 2, 3] as const;

export const MIN_DRAWER_MM = GRID_MM;
export const MAX_DRAWER_MM = CONSTRAINTS.GRID_MAX * GRID_MM;

export interface DrawerSize {
  readonly widthMm: number;
  readonly depthMm: number;
  readonly heightMm?: number;
}

export interface GridFit {
  readonly width: number;
  readonly depth: number;
  readonly gridWidthMm: number;
  readonly gridDepthMm: number;
  readonly freeWidthMm: number;
  readonly freeDepthMm: number;
}

function gridFit(width: AxisFit, depth: AxisFit): GridFit {
  return {
    width: width.units,
    depth: depth.units,
    gridWidthMm: width.units * GRID_MM,
    gridDepthMm: depth.units * GRID_MM,
    freeWidthMm: width.slackMm,
    freeDepthMm: depth.slackMm,
  };
}

export interface StackFit {
  readonly count: number;
  readonly units: number;
  readonly totalMm: number;
}

export interface DrawerPlan {
  /** The grid the drawer link opens: whole units, as `buildDrawerLinkLayout` fits them. */
  readonly grid: GridFit;
  /** A tighter fit with half units, or null when whole units are as tight. */
  readonly half: GridFit | null;
  /** The tallest bins for each stack count, empty without a height. */
  readonly stacks: readonly StackFit[];
}

function roundMm(value: number): number {
  return Math.round(value * 10) / 10;
}

export function formatMm(value: number): string {
  return String(roundMm(value));
}

export function toMm(value: number, unit: 'mm' | 'in'): number {
  return roundMm(unit === 'in' ? value * MM_PER_INCH : value);
}

function fitsGrid(sizeMm: number): boolean {
  return Number.isFinite(sizeMm) && sizeMm >= MIN_DRAWER_MM && sizeMm <= MAX_DRAWER_MM;
}

function measurable(sizeMm: number | undefined): sizeMm is number {
  return (
    sizeMm !== undefined &&
    Number.isFinite(sizeMm) &&
    sizeMm >= CONSTRAINTS.MEASURED_MM_MIN &&
    sizeMm <= CONSTRAINTS.MEASURED_MM_MAX
  );
}

/** Null when the app would refuse a drawer link of this size. */
export function planDrawer(size: DrawerSize): DrawerPlan | null {
  if (!fitsGrid(size.widthMm) || !fitsGrid(size.depthMm)) return null;

  const width = fitAxisUnits(size.widthMm, GRID_MM, false);
  const depth = fitAxisUnits(size.depthMm, GRID_MM, false);
  const grid = gridFit(width, depth);

  const halfWidth = halfUnitUpgrade(size.widthMm, GRID_MM, width.units);
  const halfDepth = halfUnitUpgrade(size.depthMm, GRID_MM, depth.units);
  const half =
    halfWidth === null && halfDepth === null
      ? null
      : gridFit(halfWidth ?? width, halfDepth ?? depth);

  const stacks: StackFit[] = [];
  if (measurable(size.heightMm)) {
    for (const count of STACK_COUNTS) {
      const units = solveUnitsUnderCeiling(size.heightMm - PLATE_RISE_MM, HEIGHT_UNIT_MM, count);
      if (units === null) continue;
      stacks.push({ count, units, totalMm: stackedTotalMm(units, HEIGHT_UNIT_MM, count) });
    }
  }

  return { grid, half, stacks };
}

/**
 * The `?drawer=` link that `parseDrawerLink` reads. A link with any query is
 * not a bare `/`, so it always opens the planner it names.
 */
export function drawerLink(
  size: DrawerSize,
  options: { readonly name?: string; readonly tool?: 'planner' | 'baseplate' } = {}
): string {
  let value = `${formatMm(size.widthMm)}x${formatMm(size.depthMm)}`;
  if (measurable(size.heightMm)) value += `x${formatMm(size.heightMm)}`;
  const params = new URLSearchParams({ drawer: value });
  if (options.name) params.set('name', options.name);
  const path = options.tool === 'baseplate' ? '/baseplate' : '/';
  return `${APP_URL}${path}?${params.toString()}`;
}

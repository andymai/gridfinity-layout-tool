/**
 * The drawer calculator for Ask AI, hand-copied from the docs' drawerPlan.ts
 * and the app's drawerFit.ts and heightUnits.ts, since api/ cannot import
 * src/. drawerPlan.crossBoundary.test.ts holds both to the same answers.
 */

const APP_URL = 'https://gridfinitylayouttool.com';
export const GRID_MM = 42;
export const HEIGHT_UNIT_MM = 7;
export const GRID_MIN = 0.5;
export const GRID_MAX = 50;
export const MIN_BIN_HEIGHT = 2;
export const MEASURED_MM_MIN = 1;
export const MEASURED_MM_MAX = 5000;
export const LIP_PROTRUSION_MM = 4.4;
export const STACK_JUNCTION_MM = 4.75;
/** How far the default baseplate lifts a seated bin. */
export const PLATE_RISE_MM = 0;
export const MIN_DRAWER_MM = GRID_MM;
export const MAX_DRAWER_MM = GRID_MAX * GRID_MM;

const FLOAT_EPSILON = 1e-9;
const STACK_COUNTS = [1, 2, 3] as const;

export interface DrawerSize {
  readonly widthMm: number;
  readonly depthMm: number;
  readonly heightMm?: number;
}

interface AxisFit {
  units: number;
  slackMm: number;
}

export interface GridFit {
  readonly width: number;
  readonly depth: number;
  readonly gridWidthMm: number;
  readonly gridDepthMm: number;
  readonly freeWidthMm: number;
  readonly freeDepthMm: number;
}

export interface StackFit {
  readonly count: number;
  readonly units: number;
  readonly totalMm: number;
}

export interface DrawerPlan {
  readonly grid: GridFit;
  readonly half: GridFit | null;
  readonly stacks: readonly StackFit[];
}

function fitAxisUnits(measuredMm: number, gridUnitMm: number, allowHalf: boolean): AxisFit {
  const step = allowHalf ? 0.5 : 1;
  const minUnits = allowHalf ? GRID_MIN : 1;
  const raw = Math.floor(measuredMm / gridUnitMm / step + FLOAT_EPSILON) * step;
  const units = Math.min(GRID_MAX, Math.max(minUnits, raw));
  return { units, slackMm: measuredMm - units * gridUnitMm };
}

function halfUnitUpgrade(
  measuredMm: number,
  gridUnitMm: number,
  wholeUnits: number
): AxisFit | null {
  const half = fitAxisUnits(measuredMm, gridUnitMm, true);
  if (half.units > wholeUnits) return half;
  const wholeOverflows = measuredMm - wholeUnits * gridUnitMm < -FLOAT_EPSILON;
  return wholeOverflows && half.slackMm >= -FLOAT_EPSILON ? half : null;
}

function stackedTotalMm(heightUnits: number, heightUnitMm: number, count: number): number {
  if (count <= 0) return 0;
  const pitch = heightUnits * heightUnitMm + LIP_PROTRUSION_MM - STACK_JUNCTION_MM;
  return count * pitch + STACK_JUNCTION_MM;
}

function solveUnitsUnderCeiling(
  ceilingMm: number,
  heightUnitMm: number,
  count: number
): number | null {
  if (count <= 0 || heightUnitMm <= 0 || !Number.isFinite(ceilingMm)) return null;
  const bodyMm = (ceilingMm - STACK_JUNCTION_MM) / count - LIP_PROTRUSION_MM + STACK_JUNCTION_MM;
  const units = Math.floor(bodyMm / heightUnitMm + 1e-9);
  return units >= MIN_BIN_HEIGHT ? units : null;
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

function roundMm(value: number): number {
  return Math.round(value * 10) / 10;
}

export function formatMm(value: number): string {
  return String(roundMm(value));
}

function fitsGrid(sizeMm: number): boolean {
  return Number.isFinite(sizeMm) && sizeMm >= MIN_DRAWER_MM && sizeMm <= MAX_DRAWER_MM;
}

function measurable(sizeMm: number | undefined): sizeMm is number {
  return (
    sizeMm !== undefined &&
    Number.isFinite(sizeMm) &&
    sizeMm >= MEASURED_MM_MIN &&
    sizeMm <= MEASURED_MM_MAX
  );
}

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

export function drawerLink(size: DrawerSize, options: { readonly name?: string } = {}): string {
  let value = `${formatMm(size.widthMm)}x${formatMm(size.depthMm)}`;
  if (measurable(size.heightMm)) value += `x${formatMm(size.heightMm)}`;
  const params = new URLSearchParams({ drawer: value });
  if (options.name) params.set('name', options.name);
  return `${APP_URL}/?${params.toString()}`;
}

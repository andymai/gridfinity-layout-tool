export interface YearBounds {
  readonly start: number;
  readonly end: number;
}

/** Local-time bounds, so a change at 23:30 on 31 December counts for that year. */
export function yearBounds(year: number): YearBounds {
  return { start: new Date(year, 0, 1).getTime(), end: new Date(year + 1, 0, 1).getTime() };
}

export function toTime(value: number | string): number {
  return typeof value === 'number' ? value : Date.parse(value);
}

export function inYear(value: number | string, bounds: YearBounds): boolean {
  const time = toTime(value);
  return Number.isFinite(time) && time >= bounds.start && time < bounds.end;
}

/**
 * `modifiedAt` is no evidence of work: switching away from a layout re-saves it.
 * The library also seeds an empty layout on a first visit, so a drawer needs a bin.
 */
export function layoutCountsForYear(
  layout: { readonly createdAt: number; readonly gridBinCount: number },
  bounds: YearBounds
): boolean {
  return layout.gridBinCount > 0 && inYear(layout.createdAt, bounds);
}

/**
 * `updatedAt` is no evidence of work either: the background thumbnail pass and
 * publishing both rewrite it. A first designer visit saves an untouched default
 * design, which never counts.
 */
export function designCountsForYear(
  design: {
    readonly createdAt: string;
    readonly versionDates: readonly string[];
    readonly untouched: boolean;
  },
  bounds: YearBounds
): boolean {
  if (design.untouched) return false;
  return (
    inYear(design.createdAt, bounds) || design.versionDates.some((date) => inYear(date, bounds))
  );
}

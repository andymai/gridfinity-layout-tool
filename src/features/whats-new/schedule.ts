/**
 * Today's date in the user's own time zone, in the `YYYY-MM-DD` form that
 * `showFrom` uses, so a scheduled entry appears at local midnight.
 */
export function localDay(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function isShown(showFrom: string | undefined, day: string = localDay()): boolean {
  return showFrom === undefined || day >= showFrom;
}

export function shownEntries<T extends { readonly showFrom?: string }>(
  entries: readonly T[],
  day: string = localDay()
): T[] {
  return entries.filter((entry) => isShown(entry.showFrom, day));
}

/** Milliseconds until the next local midnight, when `localDay` next changes. */
export function msUntilNextDay(now: Date = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next.getTime() - now.getTime();
}

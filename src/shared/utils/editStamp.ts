/**
 * The `modifiedAt` for an edit of a copy stamped `previous`: the time now, or
 * 1 ms after `previous` when that is later. Sync keeps the copy with the later
 * stamp, and a device whose clock runs fast can stamp a copy ahead of this
 * clock. An edit must still sort after the copy it changes.
 */
export function stampAfter(previous: number | undefined, now: number = Date.now()): number {
  return previous !== undefined && Number.isFinite(previous) ? Math.max(now, previous + 1) : now;
}

/** {@link stampAfter} for a stamp stored as an ISO string. */
export function isoStampAfter(previous: string | undefined, now: number = Date.now()): string {
  return new Date(
    stampAfter(previous === undefined ? undefined : Date.parse(previous), now)
  ).toISOString();
}

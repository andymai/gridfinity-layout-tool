/**
 * The newest entry's id, duplicated as a literal so the badge can answer
 * "is there anything unseen" without pulling `entries.ts` into the eager
 * bundle: the full list is ~10kB gzipped and most sessions never open it.
 *
 * `latest.test.ts` asserts this matches `WHATS_NEW_ENTRIES[0]`, so the
 * duplication cannot drift past CI or the pre-commit check.
 */
export const LATEST_ENTRY_ID = 'two-line-label-captions';

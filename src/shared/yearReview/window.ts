export const YEAR_REVIEW_YEAR = 2026;

/** Local midnight, so the review opens on 1 December wherever the user is. */
function opensAt(): number {
  return new Date(YEAR_REVIEW_YEAR, 11, 1).getTime();
}

/** Exclusive: the review stays open through the whole of 15 January. */
function closesAt(): number {
  return new Date(YEAR_REVIEW_YEAR + 1, 0, 16).getTime();
}

export function isYearReviewOpen(now: number = Date.now()): boolean {
  return now >= opensAt() && now < closesAt();
}

/** When `isYearReviewOpen` next changes, or null once the window has closed. */
export function nextYearReviewChange(now: number = Date.now()): number | null {
  if (now < opensAt()) return opensAt();
  if (now < closesAt()) return closesAt();
  return null;
}

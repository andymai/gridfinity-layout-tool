const SEEN_KEY = 'gridfinity-supporters-credits-seen';

/** Whether this browser has watched (or skipped) the credits before. False if storage is blocked. */
export function hasSeenCredits(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function markCreditsSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    // Private mode or blocked storage: the credits simply roll again next time.
  }
}

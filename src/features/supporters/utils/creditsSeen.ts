const SEEN_KEY = 'gridfinity-supporters-credits-seen';

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

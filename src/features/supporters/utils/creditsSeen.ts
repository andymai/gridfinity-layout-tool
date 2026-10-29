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

const STAMP_KEY = 'gridfinity-supporters-stamped';

/** The department stamp slams down once per browser, then just sits there. */
export function hasSeenStamp(): boolean {
  try {
    return localStorage.getItem(STAMP_KEY) === '1';
  } catch {
    return false;
  }
}

export function markStampSeen(): void {
  try {
    localStorage.setItem(STAMP_KEY, '1');
  } catch {
    // Blocked storage: the stamp animates again next time, which is harmless.
  }
}

/** Persist and load the cutout workspace split ratio from localStorage. */

const STORAGE_KEY = 'gridfinity-cutout-split';
const DEFAULT_RATIO = 0.5;
const MIN_RATIO = 0.25;
const MAX_RATIO = 0.75;

export function loadSplitRatio(): number {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = parseFloat(stored);
      if (!isNaN(parsed) && parsed >= MIN_RATIO && parsed <= MAX_RATIO) return parsed;
    }
  } catch {
    // best-effort
  }
  return DEFAULT_RATIO;
}

export function saveSplitRatio(ratio: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(ratio));
  } catch {
    // best-effort
  }
}

/** Persist and load the pull radius for grabbing an edge, so it outlives one editing session. */

import { DEFAULT_FALLOFF_MM, FALLOFF_MAX_MM, FALLOFF_MIN_MM } from './falloffDrag';

const STORAGE_KEY = 'gridfinity-cutout-falloff-mm';

export function loadFalloffMm(): number {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = parseFloat(stored);
      if (!isNaN(parsed) && parsed >= FALLOFF_MIN_MM && parsed <= FALLOFF_MAX_MM) return parsed;
    }
  } catch {
    // best-effort
  }
  return DEFAULT_FALLOFF_MM;
}

export function saveFalloffMm(mm: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(mm));
  } catch {
    // best-effort
  }
}

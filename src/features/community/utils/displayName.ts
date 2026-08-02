const DISPLAY_NAME_STORAGE_KEY = 'gridfinity-community-display-name-v1';

/** Mirrors COMMUNITY_AUTHOR_NAME_MAX_LENGTH in api/lib/communityValidation.ts. */
export const DISPLAY_NAME_MAX_LENGTH = 32;

export function loadDisplayName(): string {
  try {
    const stored = localStorage.getItem(DISPLAY_NAME_STORAGE_KEY);
    if (stored === null) return '';
    return stored.trim().slice(0, DISPLAY_NAME_MAX_LENGTH);
  } catch {
    return '';
  }
}

export function saveDisplayName(name: string): void {
  try {
    const trimmed = name.trim().slice(0, DISPLAY_NAME_MAX_LENGTH);
    if (trimmed === '') {
      localStorage.removeItem(DISPLAY_NAME_STORAGE_KEY);
      return;
    }
    localStorage.setItem(DISPLAY_NAME_STORAGE_KEY, trimmed);
  } catch {
    // Private browsing or quota: the identity step just re-asks next time.
  }
}

export function clearDisplayName(): void {
  try {
    localStorage.removeItem(DISPLAY_NAME_STORAGE_KEY);
  } catch {
    // best-effort
  }
}

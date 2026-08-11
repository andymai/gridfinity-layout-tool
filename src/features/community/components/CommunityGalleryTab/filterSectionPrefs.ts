const STORAGE_KEY = 'gridfinity-community-filter-sections-v1';

/** The panel sections that can be folded away. */
export type FilterSectionId = 'size' | 'technique';

export type FilterSectionState = Readonly<Record<FilterSectionId, boolean>>;

/**
 * Both closed on a first visit. Show and Category answer most of the narrowing
 * anyone does here and stay open; the size sliders and the technique pills are
 * what pushed the rail past the fold, and each states its current value on its
 * own header while closed, so nothing is hidden, only folded.
 */
export const DEFAULT_FILTER_SECTIONS: FilterSectionState = { size: false, technique: false };

function isSectionState(value: unknown): value is FilterSectionState {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.size === 'boolean' && typeof record.technique === 'boolean';
}

export function loadFilterSections(): FilterSectionState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return DEFAULT_FILTER_SECTIONS;
    const parsed: unknown = JSON.parse(raw);
    // A shape from an older build is a preference, never a crash: the default
    // is always a usable panel.
    return isSectionState(parsed) ? parsed : DEFAULT_FILTER_SECTIONS;
  } catch {
    return DEFAULT_FILTER_SECTIONS;
  }
}

export function saveFilterSections(state: FilterSectionState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // A full or blocked store costs the preference, never the session.
  }
}

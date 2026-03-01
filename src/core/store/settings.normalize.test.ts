import { describe, it, expect } from 'vitest';
import {
  normalizeSortOrder,
  normalizeCategories,
  normalizeSTLSearchSites,
  normalizeSlicerSites,
  normalizeViewMode,
} from './settings.normalize';
import {
  DEFAULT_BIN_LIST_SORT_ORDER,
  DEFAULT_STL_SEARCH_SITES,
  DEFAULT_SLICER_SITES,
} from './settings.types';

describe('normalizeSortOrder', () => {
  it('returns defaults when stored is undefined', () => {
    expect(normalizeSortOrder(undefined)).toEqual(DEFAULT_BIN_LIST_SORT_ORDER);
  });

  it('returns defaults when stored is not an array', () => {
    expect(normalizeSortOrder('invalid' as never)).toEqual(DEFAULT_BIN_LIST_SORT_ORDER);
  });

  it('preserves valid stored sort order', () => {
    const stored = [{ field: 'label' as const, enabled: true }];
    const result = normalizeSortOrder(stored);
    expect(result[0]).toEqual({ field: 'label', enabled: true });
  });

  it('adds missing fields as disabled', () => {
    const stored = [{ field: 'label' as const, enabled: true }];
    const result = normalizeSortOrder(stored);
    const storedFields = new Set(stored.map((s) => s.field));
    const addedFields = result.filter((s) => !storedFields.has(s.field));
    for (const added of addedFields) {
      expect(added.enabled).toBe(false);
    }
  });

  it('removes unknown fields', () => {
    const stored = [
      { field: 'label' as const, enabled: true },
      { field: 'unknown_field' as never, enabled: true },
    ];
    const result = normalizeSortOrder(stored);
    const fields = result.map((s) => s.field);
    expect(fields).not.toContain('unknown_field');
  });
});

describe('normalizeCategories', () => {
  it('returns null for null input', () => {
    expect(normalizeCategories(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(normalizeCategories(undefined)).toBeNull();
  });

  it('returns null for empty array', () => {
    expect(normalizeCategories([])).toBeNull();
  });

  it('returns null for non-array', () => {
    expect(normalizeCategories('invalid' as never)).toBeNull();
  });

  it('returns valid categories', () => {
    const categories = [{ id: 'cat-1', name: 'Tools', color: '#ff0000' }];
    expect(normalizeCategories(categories)).toEqual(categories);
  });

  it('filters out categories with missing fields', () => {
    const categories = [
      { id: 'cat-1', name: 'Tools', color: '#ff0000' },
      { id: 'cat-2', name: 'Bad' } as never, // missing color
    ];
    const result = normalizeCategories(categories);
    expect(result).toHaveLength(1);
    expect(result![0].id).toBe('cat-1');
  });

  it('returns null if all categories are invalid', () => {
    const categories = [{ id: 123 } as never]; // invalid id type
    expect(normalizeCategories(categories)).toBeNull();
  });
});

describe('normalizeSTLSearchSites', () => {
  it('returns defaults when stored is undefined', () => {
    expect(normalizeSTLSearchSites(undefined)).toEqual(DEFAULT_STL_SEARCH_SITES);
  });

  it('adds missing default sites as disabled', () => {
    // Provide only the first default site
    const stored = [{ ...DEFAULT_STL_SEARCH_SITES[0] }];
    const result = normalizeSTLSearchSites(stored);
    // Should have all default sites
    const resultIds = new Set(result.map((s) => s.id));
    for (const defaultSite of DEFAULT_STL_SEARCH_SITES) {
      expect(resultIds.has(defaultSite.id)).toBe(true);
    }
  });

  it('preserves custom sites', () => {
    const stored = [
      ...DEFAULT_STL_SEARCH_SITES,
      { id: 'custom-1', name: 'Custom', urlTemplate: 'https://custom.com/{query}', enabled: true },
    ];
    const result = normalizeSTLSearchSites(stored);
    expect(result.some((s) => s.id === 'custom-1')).toBe(true);
  });

  it('removes stale default sites that are no longer in defaults', () => {
    const stored = [
      { id: 'removed-default', name: 'Old', urlTemplate: '', enabled: true, isDefault: true },
      ...DEFAULT_STL_SEARCH_SITES,
    ];
    const result = normalizeSTLSearchSites(stored);
    expect(result.some((s) => s.id === 'removed-default')).toBe(false);
  });
});

describe('normalizeSlicerSites', () => {
  it('returns defaults when stored is undefined', () => {
    expect(normalizeSlicerSites(undefined)).toEqual(DEFAULT_SLICER_SITES);
  });

  it('drops non-default sites', () => {
    const stored = [
      ...DEFAULT_SLICER_SITES,
      { id: 'custom-slicer', name: 'Custom', protocol: 'custom://', enabled: true } as never,
    ];
    const result = normalizeSlicerSites(stored);
    expect(result.some((s) => s.id === 'custom-slicer')).toBe(false);
  });

  it('adds missing defaults as disabled', () => {
    const stored = [DEFAULT_SLICER_SITES[0]];
    const result = normalizeSlicerSites(stored);
    const resultIds = new Set(result.map((s) => s.id));
    for (const defaultSite of DEFAULT_SLICER_SITES) {
      expect(resultIds.has(defaultSite.id)).toBe(true);
    }
  });
});

describe('normalizeViewMode', () => {
  it('returns grid for grid', () => {
    expect(normalizeViewMode('grid', 'list')).toBe('grid');
  });

  it('returns list for list', () => {
    expect(normalizeViewMode('list', 'grid')).toBe('list');
  });

  it('returns fallback for invalid value', () => {
    expect(normalizeViewMode('invalid', 'grid')).toBe('grid');
  });

  it('returns fallback for null', () => {
    expect(normalizeViewMode(null, 'list')).toBe('list');
  });

  it('returns fallback for undefined', () => {
    expect(normalizeViewMode(undefined, 'grid')).toBe('grid');
  });
});

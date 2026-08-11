import { describe, it, expect, beforeEach } from 'vitest';
import {
  DEFAULT_FILTER_SECTIONS,
  loadFilterSections,
  saveFilterSections,
} from './filterSectionPrefs';

const STORAGE_KEY = 'gridfinity-community-filter-sections-v1';

beforeEach(() => {
  localStorage.clear();
});

describe('filterSectionPrefs', () => {
  it('starts both sections folded', () => {
    expect(loadFilterSections()).toEqual({ size: false, technique: false });
  });

  it('round-trips a preference', () => {
    saveFilterSections({ size: true, technique: false });
    expect(loadFilterSections()).toEqual({ size: true, technique: false });
  });

  it('falls back to the default on a shape from an older build', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ size: 'open' }));
    expect(loadFilterSections()).toEqual(DEFAULT_FILTER_SECTIONS);
  });

  it('falls back to the default on unparseable storage', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    expect(loadFilterSections()).toEqual(DEFAULT_FILTER_SECTIONS);
  });

  it('survives a store that refuses to write', () => {
    const original = localStorage.setItem;
    localStorage.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    expect(() => saveFilterSections({ size: true, technique: true })).not.toThrow();
    localStorage.setItem = original;
  });
});

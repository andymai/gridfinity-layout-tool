import { describe, it, expect } from 'vitest';
import { designId } from '@/core/types';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import type { SavedDesign } from '@/features/bin-designer/types';
import { filterAndSortDesigns, SORT_OPTIONS, SORT_OPTION_KEYS } from './designListSort';

function makeDesign(overrides: {
  id: string;
  name?: string;
  params?: SavedDesign['params'];
  updatedAt?: string;
  tags?: readonly string[];
}): SavedDesign {
  return {
    id: designId(overrides.id),
    name: overrides.name ?? 'Design',
    params: overrides.params ?? { ...DEFAULT_BIN_PARAMS },
    thumbnail: null,
    exportFileNameConfig: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-01-01T00:00:00.000Z',
    tags: overrides.tags,
  };
}

const noFilter = { activeTags: [] as string[], searchQuery: '', currentDesignId: null };

describe('designListSort constants', () => {
  it('exposes the three sort options with i18n keys', () => {
    expect(SORT_OPTIONS).toEqual(['recent', 'name', 'size']);
    for (const option of SORT_OPTIONS) {
      expect(SORT_OPTION_KEYS[option]).toMatch(/^binDesigner\.sort/);
    }
  });
});

describe('filterAndSortDesigns', () => {
  const alpha = makeDesign({ id: 'a', name: 'Alpha', updatedAt: '2026-01-01T00:00:00.000Z' });
  const bravo = makeDesign({ id: 'b', name: 'Bravo', updatedAt: '2026-03-01T00:00:00.000Z' });
  const charlie = makeDesign({ id: 'c', name: 'Charlie', updatedAt: '2026-02-01T00:00:00.000Z' });

  it('sorts by most-recently updated by default', () => {
    const result = filterAndSortDesigns([alpha, bravo, charlie], { ...noFilter, sortBy: 'recent' });
    expect(result.map((d) => d.id)).toEqual([bravo.id, charlie.id, alpha.id]);
  });

  it('sorts by name A-Z', () => {
    const result = filterAndSortDesigns([charlie, alpha, bravo], { ...noFilter, sortBy: 'name' });
    expect(result.map((d) => d.name)).toEqual(['Alpha', 'Bravo', 'Charlie']);
  });

  it('sorts by size largest-first', () => {
    const small = makeDesign({
      id: 's',
      name: 'Small',
      params: { ...DEFAULT_BIN_PARAMS, width: 1, depth: 1, height: 1 },
    });
    const large = makeDesign({
      id: 'l',
      name: 'Large',
      params: { ...DEFAULT_BIN_PARAMS, width: 5, depth: 4, height: 3 },
    });
    const result = filterAndSortDesigns([small, large], { ...noFilter, sortBy: 'size' });
    expect(result.map((d) => d.id)).toEqual([large.id, small.id]);
  });

  it('pins the active design first regardless of sort', () => {
    const result = filterAndSortDesigns([bravo, charlie, alpha], {
      ...noFilter,
      sortBy: 'name',
      currentDesignId: charlie.id,
    });
    expect(result[0].id).toBe(charlie.id);
  });

  it('filters by search query (case-insensitive substring on name)', () => {
    const result = filterAndSortDesigns([alpha, bravo, charlie], {
      activeTags: [],
      searchQuery: 'RaV',
      sortBy: 'name',
      currentDesignId: null,
    });
    expect(result.map((d) => d.name)).toEqual(['Bravo']);
  });

  it('filters by active tags', () => {
    const tagged = makeDesign({ id: 't', name: 'Tagged', tags: ['kitchen'] });
    const untagged = makeDesign({ id: 'u', name: 'Untagged' });
    const result = filterAndSortDesigns([tagged, untagged], {
      activeTags: ['kitchen'],
      searchQuery: '',
      sortBy: 'name',
      currentDesignId: null,
    });
    expect(result.map((d) => d.id)).toEqual([tagged.id]);
  });

  it('does not mutate the input array', () => {
    const input = [bravo, alpha, charlie];
    const snapshot = [...input];
    filterAndSortDesigns(input, { ...noFilter, sortBy: 'name' });
    expect(input).toEqual(snapshot);
  });
});

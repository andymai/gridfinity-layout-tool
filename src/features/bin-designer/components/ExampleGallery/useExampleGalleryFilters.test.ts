import { describe, it, expect } from 'vitest';
import { filterExamples } from './useExampleGalleryFilters';
import { EXAMPLE_DESIGNS } from '@/features/bin-designer/data/examples';

describe('filterExamples', () => {
  it('returns all when no filters', () => {
    const out = filterExamples(EXAMPLE_DESIGNS, { search: '', technique: null });
    expect(out.length).toBe(EXAMPLE_DESIGNS.length);
  });

  it('filters by technique', () => {
    const out = filterExamples(EXAMPLE_DESIGNS, { search: '', technique: 'compartments' });
    expect(out.every((e) => e.techniques.includes('compartments'))).toBe(true);
    expect(out.length).toBeGreaterThan(0);
  });

  it('search matches tags/id case-insensitively', () => {
    const tag = EXAMPLE_DESIGNS[0].tags[0];
    const out = filterExamples(EXAMPLE_DESIGNS, { search: tag.toUpperCase(), technique: null });
    expect(out.length).toBeGreaterThan(0);
  });

  it('does not mutate the input array', () => {
    const before = [...EXAMPLE_DESIGNS];
    filterExamples(EXAMPLE_DESIGNS, { search: '', technique: null });
    expect(EXAMPLE_DESIGNS).toEqual(before);
  });
});

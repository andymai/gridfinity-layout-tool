import { describe, it, expect } from 'vitest';
import { collectTags, filterByTags, toggleTag } from './tagFilter';
import type { SavedDesign } from '../types';

function design(id: string, tags?: string[]): SavedDesign {
  return {
    id: id as SavedDesign['id'],
    name: id,
    params: {} as SavedDesign['params'],
    thumbnail: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    exportFileNameConfig: null,
    ...(tags ? { tags } : {}),
  };
}

describe('collectTags', () => {
  it('returns the sorted unique union of all design tags', () => {
    const designs = [design('a', ['kitchen', 'screws']), design('b', ['kitchen']), design('c')];
    expect(collectTags(designs)).toEqual(['kitchen', 'screws']);
  });

  it('dedupes case-insensitively, keeping first-seen casing', () => {
    const designs = [design('a', ['Kitchen']), design('b', ['kitchen', 'Garage'])];
    expect(collectTags(designs)).toEqual(['Garage', 'Kitchen']);
  });

  it('returns [] when no design has tags', () => {
    expect(collectTags([design('a'), design('b')])).toEqual([]);
  });
});

describe('filterByTags', () => {
  const designs = [
    design('a', ['kitchen', 'screws']),
    design('b', ['kitchen']),
    design('c', ['garage']),
    design('d'),
  ];

  it('returns all designs when no tags are active', () => {
    expect(filterByTags(designs, []).map((d) => d.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('AND-matches: a design must carry every active tag', () => {
    expect(filterByTags(designs, ['kitchen']).map((d) => d.id)).toEqual(['a', 'b']);
    expect(filterByTags(designs, ['kitchen', 'screws']).map((d) => d.id)).toEqual(['a']);
  });

  it('matches tags case-insensitively', () => {
    expect(filterByTags(designs, ['KITCHEN']).map((d) => d.id)).toEqual(['a', 'b']);
  });

  it('excludes untagged designs when any tag is active', () => {
    expect(filterByTags(designs, ['garage']).map((d) => d.id)).toEqual(['c']);
  });
});

describe('toggleTag', () => {
  it('adds a tag that is absent', () => {
    expect(toggleTag(['a'], 'b')).toEqual(['a', 'b']);
  });

  it('removes a tag that is present, case-insensitively', () => {
    expect(toggleTag(['Kitchen', 'screws'], 'kitchen')).toEqual(['screws']);
  });

  it('does not duplicate-add when a case variant is already present', () => {
    expect(toggleTag(['Kitchen'], 'kitchen')).toEqual([]);
  });
});

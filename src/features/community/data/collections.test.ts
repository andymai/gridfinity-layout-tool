import { describe, expect, it } from 'vitest';
import { COMMUNITY_COLLECTIONS } from './collections';

/**
 * Curation happens by hand-editing this file, so these guard the shape a
 * reviewer would otherwise have to eyeball. They pass vacuously while the
 * list is empty and start doing real work the moment someone curates.
 */
describe('COMMUNITY_COLLECTIONS', () => {
  it('has unique ids', () => {
    const ids = COMMUNITY_COLLECTIONS.map((collection) => collection.id);
    // Each id becomes a React key and part of a heading DOM id, so a duplicate
    // means reconciliation warnings and an ambiguous aria-labelledby.
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('uses lowercase hyphenated slugs for ids', () => {
    for (const collection of COMMUNITY_COLLECTIONS) {
      expect(collection.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
  });

  it('gives every collection a title and blurb key', () => {
    for (const collection of COMMUNITY_COLLECTIONS) {
      expect(collection.titleKey).not.toBe('');
      expect(collection.blurbKey).not.toBe('');
    }
  });

  it('never ships a collection with no designs', () => {
    for (const collection of COMMUNITY_COLLECTIONS) {
      // It would resolve to nothing and be dropped, so it is dead curation.
      expect(collection.designIds.length).toBeGreaterThan(0);
    }
  });

  it('has no duplicate design ids within a collection', () => {
    for (const collection of COMMUNITY_COLLECTIONS) {
      expect(new Set(collection.designIds).size).toBe(collection.designIds.length);
    }
  });
});

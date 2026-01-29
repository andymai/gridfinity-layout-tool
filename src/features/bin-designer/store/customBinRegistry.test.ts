import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadRegistry,
  upsertRegistryEntry,
  removeRegistryEntry,
  rebuildRegistry,
  type CustomBinRef,
} from './customBinRegistry';

function makeRef(id: string, name: string = 'Test Bin'): CustomBinRef {
  return {
    id,
    name,
    width: 2,
    depth: 2,
    height: 3,
    thumbnail: null,
    updatedAt: '2026-01-22T00:00:00.000Z',
  };
}

describe('customBinRegistry', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('loadRegistry', () => {
    it('returns empty array when no data stored', () => {
      expect(loadRegistry()).toEqual([]);
    });

    it('returns stored entries', () => {
      const refs = [makeRef('bin-1'), makeRef('bin-2')];
      localStorage.setItem('gridfinity-custom-bins-v1', JSON.stringify(refs));
      expect(loadRegistry()).toEqual(refs);
    });

    it('handles corrupted data gracefully', () => {
      localStorage.setItem('gridfinity-custom-bins-v1', 'not json');
      expect(loadRegistry()).toEqual([]);
    });

    it('handles non-array data gracefully', () => {
      localStorage.setItem('gridfinity-custom-bins-v1', JSON.stringify({ foo: 'bar' }));
      expect(loadRegistry()).toEqual([]);
    });
  });

  describe('upsertRegistryEntry', () => {
    it('adds new entry to empty registry', () => {
      upsertRegistryEntry(makeRef('bin-1'));
      expect(loadRegistry()).toHaveLength(1);
      expect(loadRegistry()[0].id).toBe('bin-1');
    });

    it('adds new entry alongside existing', () => {
      upsertRegistryEntry(makeRef('bin-1'));
      upsertRegistryEntry(makeRef('bin-2'));
      expect(loadRegistry()).toHaveLength(2);
    });

    it('updates existing entry by id', () => {
      upsertRegistryEntry(makeRef('bin-1', 'Original'));
      upsertRegistryEntry(makeRef('bin-1', 'Updated'));
      const registry = loadRegistry();
      expect(registry).toHaveLength(1);
      expect(registry[0].name).toBe('Updated');
    });

    it('preserves other entries when updating', () => {
      upsertRegistryEntry(makeRef('bin-1', 'First'));
      upsertRegistryEntry(makeRef('bin-2', 'Second'));
      upsertRegistryEntry(makeRef('bin-1', 'Updated First'));
      const registry = loadRegistry();
      expect(registry).toHaveLength(2);
      expect(registry[0].name).toBe('Updated First');
      expect(registry[1].name).toBe('Second');
    });
  });

  describe('removeRegistryEntry', () => {
    it('removes entry by id', () => {
      upsertRegistryEntry(makeRef('bin-1'));
      upsertRegistryEntry(makeRef('bin-2'));
      removeRegistryEntry('bin-1');
      const registry = loadRegistry();
      expect(registry).toHaveLength(1);
      expect(registry[0].id).toBe('bin-2');
    });

    it('no-ops for unknown id', () => {
      upsertRegistryEntry(makeRef('bin-1'));
      removeRegistryEntry('unknown');
      expect(loadRegistry()).toHaveLength(1);
    });

    it('handles empty registry gracefully', () => {
      removeRegistryEntry('anything');
      expect(loadRegistry()).toEqual([]);
    });
  });

  describe('rebuildRegistry', () => {
    it('replaces entire registry', () => {
      upsertRegistryEntry(makeRef('old-1'));
      upsertRegistryEntry(makeRef('old-2'));

      const newRefs = [makeRef('new-1'), makeRef('new-2'), makeRef('new-3')];
      rebuildRegistry(newRefs);

      const registry = loadRegistry();
      expect(registry).toHaveLength(3);
      expect(registry.map((r) => r.id)).toEqual(['new-1', 'new-2', 'new-3']);
    });

    it('can clear registry by passing empty array', () => {
      upsertRegistryEntry(makeRef('bin-1'));
      rebuildRegistry([]);
      expect(loadRegistry()).toEqual([]);
    });
  });

  describe('persistence', () => {
    it('uses correct localStorage key', () => {
      upsertRegistryEntry(makeRef('bin-1'));
      const raw = localStorage.getItem('gridfinity-custom-bins-v1');
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw ?? '[]') as Array<{ id: string }>;
      expect(parsed[0].id).toBe('bin-1');
    });
  });
});

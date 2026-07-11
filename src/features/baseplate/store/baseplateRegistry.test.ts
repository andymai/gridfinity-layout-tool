// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadRegistry,
  upsertRegistryEntry,
  removeRegistryEntry,
  rebuildRegistry,
  subscribeToRegistry,
  type BaseplateRef,
} from '@/features/baseplate/store/baseplateRegistry';
import { baseplateDesignId } from '@/core/types';

const REGISTRY_KEY = 'gridfinity-baseplate-registry-v1';

function makeRef(id: string, name: string, updatedAt = '2026-07-11T00:00:00.000Z'): BaseplateRef {
  return { id: baseplateDesignId(id), name, updatedAt };
}

describe('baseplateRegistry', () => {
  beforeEach(() => {
    localStorage.removeItem(REGISTRY_KEY);
  });

  it('returns an empty list when nothing is stored', () => {
    expect(loadRegistry()).toEqual([]);
  });

  it('upserts a new entry and reads it back', () => {
    upsertRegistryEntry(makeRef('bp-1', 'Plate A'));
    const refs = loadRegistry();
    expect(refs.length).toBe(1);
    expect(refs[0]).toEqual(makeRef('bp-1', 'Plate A'));
  });

  it('replaces an existing entry with the same id', () => {
    upsertRegistryEntry(makeRef('bp-1', 'Plate A', '2026-07-11T00:00:00.000Z'));
    upsertRegistryEntry(makeRef('bp-1', 'Plate A renamed', '2026-07-11T01:00:00.000Z'));
    const refs = loadRegistry();
    expect(refs.length).toBe(1);
    expect(refs[0].name).toBe('Plate A renamed');
    expect(refs[0].updatedAt).toBe('2026-07-11T01:00:00.000Z');
  });

  it('removes an entry by id', () => {
    upsertRegistryEntry(makeRef('bp-1', 'Plate A'));
    upsertRegistryEntry(makeRef('bp-2', 'Plate B'));
    removeRegistryEntry('bp-1');
    const refs = loadRegistry();
    expect(refs.map((r) => r.id)).toEqual(['bp-2']);
  });

  it('rebuilds the registry from a provided list', () => {
    upsertRegistryEntry(makeRef('bp-1', 'Plate A'));
    rebuildRegistry([makeRef('bp-9', 'Plate Z')]);
    const refs = loadRegistry();
    expect(refs.map((r) => r.id)).toEqual(['bp-9']);
  });

  it('drops malformed entries when loading', () => {
    localStorage.setItem(
      REGISTRY_KEY,
      JSON.stringify([
        { id: 'bp-good', name: 'Good', updatedAt: '2026-07-11T00:00:00.000Z' },
        { id: 'bp-bad', name: 42 },
        'not-an-object',
      ])
    );
    const refs = loadRegistry();
    expect(refs.length).toBe(1);
    expect(refs[0].id).toBe('bp-good');
  });

  describe('pub/sub', () => {
    it('notifies subscribers on upsert, remove, and rebuild', () => {
      const cb = vi.fn();
      const unsubscribe = subscribeToRegistry(cb);

      upsertRegistryEntry(makeRef('bp-1', 'Plate A'));
      removeRegistryEntry('bp-1');
      rebuildRegistry([]);

      expect(cb).toHaveBeenCalledTimes(3);
      unsubscribe();
    });

    it('stops notifying after unsubscribe', () => {
      const cb = vi.fn();
      const unsubscribe = subscribeToRegistry(cb);
      unsubscribe();

      upsertRegistryEntry(makeRef('bp-1', 'Plate A'));
      expect(cb).not.toHaveBeenCalled();
    });
  });
});

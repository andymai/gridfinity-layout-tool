// Real storage: IndexedDB (fake-indexeddb) and the localStorage registry, with
// no mock between the sync adapter and them.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/analytics/posthog', () => ({ trackDesignCreated: vi.fn() }));

import { designId } from '@/core/types';
import { isOk } from '@/core/result';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import { loadRegistry } from '@/features/bin-designer/store/customBinRegistry';
import { closeDesignerDb, loadDesign } from '@/features/bin-designer/storage/DesignerStorage';
import { designAdapter } from './designAdapter';

function deleteDb(name: string): Promise<void> {
  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

beforeEach(async () => {
  localStorage.clear();
  closeDesignerDb();
  await deleteDb('gridfinity-designer-v1');
});

describe('designAdapter.applyRemote with real storage', () => {
  // A design made on another device has no registry entry here yet, and the
  // layout reads its split switch from the registry.
  it('registers a parametric design it pulls for the first time, split switch included', async () => {
    await designAdapter.applyRemote({
      id: 'remote-long',
      payload: {
        name: 'Long tray',
        params: { ...DEFAULT_BIN_PARAMS, width: 8, depth: 1, splitToFitBed: false },
      },
      modifiedAt: Date.parse('2026-11-12T00:00:00.000Z'),
    });

    const stored = await loadDesign(designId('remote-long'));
    expect(isOk(stored) && stored.value.params?.splitToFitBed).toBe(false);
    expect(loadRegistry().find((r) => r.id === 'remote-long')).toMatchObject({
      name: 'Long tray',
      width: 8,
      depth: 1,
      splitToFitBed: false,
    });
  });

  it('turns the switch back on in the registry when a later pull does', async () => {
    const pull = (splitToFitBed?: false) =>
      designAdapter.applyRemote({
        id: 'remote-long',
        payload: {
          name: 'Long tray',
          params: {
            ...DEFAULT_BIN_PARAMS,
            width: 8,
            depth: 1,
            ...(splitToFitBed === false ? { splitToFitBed } : {}),
          },
        },
        modifiedAt: Date.now(),
      });
    await pull(false);
    await pull();

    expect(loadRegistry().find((r) => r.id === 'remote-long')?.splitToFitBed).toBeUndefined();
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ok, err, storageNotFound } from '@/core/result';
import { baseplateDesignId } from '@/core/types';
import type { StoredBaseplateParams } from '@/core/types';
import type { SavedBaseplateDesign } from '@/features/baseplate/types/library';
import type { BaseplateRef } from '@/features/baseplate/store/baseplateRegistry';

const loadDesignMock = vi.fn();
const loadRegistryMock = vi.fn<() => BaseplateRef[]>(() => []);
const upsertRegistryEntryMock = vi.fn();
const removeRegistryEntryMock = vi.fn();

vi.mock('@/features/baseplate/storage/BaseplateStorage', () => ({
  loadDesign: (id: string) => loadDesignMock(id),
}));

vi.mock('@/features/baseplate/store/baseplateRegistry', () => ({
  loadRegistry: () => loadRegistryMock(),
  upsertRegistryEntry: (ref: BaseplateRef) => upsertRegistryEntryMock(ref),
  removeRegistryEntry: (id: string) => removeRegistryEntryMock(id),
}));

import { startBaseplateRegistryBridge } from './baseplateRegistryBridge';
import { __resetForTests, emit } from './baseplateEvents';

function savedDesign(id: string, updatedAt: string, name = 'B'): SavedBaseplateDesign {
  return {
    id: baseplateDesignId(id),
    name,
    params: {} as StoredBaseplateParams,
    thumbnail: null,
    createdAt: updatedAt,
    updatedAt,
  };
}

// Let the bridge's `void loadDesign(...).then(...)` microtask settle.
async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(() => {
  vi.clearAllMocks();
  loadRegistryMock.mockReturnValue([]);
  __resetForTests();
});

describe('startBaseplateRegistryBridge', () => {
  it('upserts a registry entry when a put event fires for a new design', async () => {
    loadDesignMock.mockResolvedValueOnce(ok(savedDesign('bp1', '2026-05-01T00:00:00.000Z', 'One')));
    const off = startBaseplateRegistryBridge();

    emit({ type: 'put', id: baseplateDesignId('bp1'), updatedAt: '2026-05-01T00:00:00.000Z' });
    await flush();

    expect(upsertRegistryEntryMock).toHaveBeenCalledWith({
      id: 'bp1',
      name: 'One',
      updatedAt: '2026-05-01T00:00:00.000Z',
    });
    off();
  });

  it('no-ops on put when the registry entry already matches (feedback-loop guard)', async () => {
    loadDesignMock.mockResolvedValueOnce(ok(savedDesign('bp1', '2026-05-01T00:00:00.000Z', 'One')));
    loadRegistryMock.mockReturnValue([
      { id: baseplateDesignId('bp1'), name: 'One', updatedAt: '2026-05-01T00:00:00.000Z' },
    ]);
    const off = startBaseplateRegistryBridge();

    emit({ type: 'put', id: baseplateDesignId('bp1'), updatedAt: '2026-05-01T00:00:00.000Z' });
    await flush();

    expect(upsertRegistryEntryMock).not.toHaveBeenCalled();
    off();
  });

  it('skips the upsert when the design cannot be loaded', async () => {
    loadDesignMock.mockResolvedValueOnce(err(storageNotFound('bp1')));
    const off = startBaseplateRegistryBridge();

    emit({ type: 'put', id: baseplateDesignId('bp1'), updatedAt: '2026-05-01T00:00:00.000Z' });
    await flush();

    expect(upsertRegistryEntryMock).not.toHaveBeenCalled();
    off();
  });

  it('removes the registry entry on a delete event when it exists', () => {
    loadRegistryMock.mockReturnValue([
      { id: baseplateDesignId('bp1'), name: 'One', updatedAt: '2026-05-01T00:00:00.000Z' },
    ]);
    const off = startBaseplateRegistryBridge();

    emit({ type: 'delete', id: baseplateDesignId('bp1'), deletedAt: '2026-05-02T00:00:00.000Z' });

    expect(removeRegistryEntryMock).toHaveBeenCalledWith('bp1');
    off();
  });

  it('no-ops on delete when the entry is already gone', () => {
    loadRegistryMock.mockReturnValue([]);
    const off = startBaseplateRegistryBridge();

    emit({ type: 'delete', id: baseplateDesignId('bp1'), deletedAt: '2026-05-02T00:00:00.000Z' });

    expect(removeRegistryEntryMock).not.toHaveBeenCalled();
    off();
  });

  it('stops reacting after unsubscribe', async () => {
    const off = startBaseplateRegistryBridge();
    off();

    emit({ type: 'put', id: baseplateDesignId('bp1'), updatedAt: '2026-05-01T00:00:00.000Z' });
    await flush();

    expect(loadDesignMock).not.toHaveBeenCalled();
  });
});

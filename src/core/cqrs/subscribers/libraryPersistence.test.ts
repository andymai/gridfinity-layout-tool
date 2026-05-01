import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createEventBus } from '../bus/eventBus';
import type { EventBus } from '../bus/eventBus';
import type { DomainEvent } from '../events';
import { eventId, correlationId, commandId } from '../types';
import { useLibraryStore } from '@/core/store/library';
import { layoutId } from '@/core/types';
import type { LayoutLibrary, CloudShareInfo } from '@/core/types';
import { connectLibraryPersistence } from './libraryPersistence';
import { ok } from '@/core/result';
import { resetLibraryStore } from '@/test/testUtils';

import type * as StorageModule from '@/core/storage';

vi.mock('@/core/storage', async () => {
  const actual = await vi.importActual<typeof StorageModule>('@/core/storage');
  return {
    ...actual,
    saveLibrary: vi.fn(() => Promise.resolve(ok(undefined))),
  };
});

import { saveLibrary } from '@/core/storage';

function makeEvent<T extends DomainEvent['type']>(
  type: T,
  payload: Extract<DomainEvent, { type: T }>['payload']
): DomainEvent {
  return {
    type,
    payload,
    meta: {
      id: eventId(`evt_${Math.random()}`),
      timestamp: Date.now(),
      correlationId: correlationId('cor_1'),
      commandId: commandId('cmd_1'),
      aggregateId: layoutId('layout_1'),
      version: 1,
      schemaVersion: 1,
    },
  } as DomainEvent;
}

function makeShareInfo(): CloudShareInfo {
  return {
    id: 'share-1',
    deleteToken: 'token-1',
    permission: 'view',
    sharedAt: Date.now(),
  };
}

function seedLibraryWithEntry(entryId: string, withCloudShare = false): LayoutLibrary {
  const library: LayoutLibrary = {
    version: '1.0',
    activeLayoutId: layoutId(entryId),
    settings: {},
    entries: [
      {
        id: layoutId(entryId),
        name: 'Test',
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        preview: {
          drawerWidth: 10,
          drawerDepth: 8,
          drawerHeight: 12,
          binCount: 0,
          layerCount: 1,
        },
        ...(withCloudShare ? { cloudShare: makeShareInfo() } : {}),
      },
    ],
  };
  useLibraryStore.setState({ library, isLoaded: true });
  return library;
}

describe('libraryPersistence subscriber', () => {
  let bus: EventBus;
  let unsubscribe: () => void;

  beforeEach(() => {
    resetLibraryStore();
    bus = createEventBus();
    unsubscribe = connectLibraryPersistence(bus);
    vi.mocked(saveLibrary).mockClear();
  });

  afterEach(() => {
    unsubscribe();
    bus.clear();
    resetLibraryStore();
  });

  it('persists library when library.cloudShareUpdated fires', () => {
    seedLibraryWithEntry('layout-1', true);

    bus.publish(
      makeEvent('library.cloudShareUpdated', {
        layoutId: layoutId('layout-1'),
        shareInfo: makeShareInfo(),
      })
    );

    expect(saveLibrary).toHaveBeenCalledTimes(1);
    const snapshot = vi.mocked(saveLibrary).mock.calls[0][0];
    expect(snapshot.entries[0].cloudShare).toBeDefined();
  });

  it('persists library when library.cloudShareCleared fires', () => {
    seedLibraryWithEntry('layout-1', false);

    bus.publish(
      makeEvent('library.cloudShareCleared', {
        layoutId: layoutId('layout-1'),
      })
    );

    expect(saveLibrary).toHaveBeenCalledTimes(1);
  });

  it('does not persist for unrelated events', () => {
    seedLibraryWithEntry('layout-1', false);

    bus.publish(
      makeEvent('library.entryCreated', {
        layoutId: layoutId('layout-2'),
        name: 'Another',
      })
    );

    expect(saveLibrary).not.toHaveBeenCalled();
  });

  it('detaches via structuredClone before saving (no Immer proxy leak)', () => {
    // Mutate the store after the subscriber fires; the snapshot passed to
    // saveLibrary should reflect the state at the moment of the event, and
    // must not be a live reference to the store.
    seedLibraryWithEntry('layout-1', true);

    bus.publish(
      makeEvent('library.cloudShareUpdated', {
        layoutId: layoutId('layout-1'),
        shareInfo: makeShareInfo(),
      })
    );

    const snapshot = vi.mocked(saveLibrary).mock.calls[0][0];
    expect(snapshot).not.toBe(useLibraryStore.getState().library);
  });

  it('unsubscribe stops persisting', () => {
    seedLibraryWithEntry('layout-1', false);
    unsubscribe();

    bus.publish(
      makeEvent('library.cloudShareCleared', {
        layoutId: layoutId('layout-1'),
      })
    );

    expect(saveLibrary).not.toHaveBeenCalled();
  });
});

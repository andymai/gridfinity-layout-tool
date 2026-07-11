/**
 * Domain facade for the global baseplate design library.
 *
 * Mirrors useLayoutSwitcher: exposes a reactive `list` (from the lightweight
 * localStorage registry), the per-layout `activeBaseplateId`, and async
 * operations that talk to BaseplateStorage + the registry.
 */

import { useCallback, useSyncExternalStore } from 'react';
import { useLayoutStore } from '@/core/store/layout';
import { useMutations } from '@/shared/contexts';
import type { BaseplateDesignId, StoredBaseplateParams } from '@/core/types';
import type { Result, StorageError } from '@/core/result';
import { isErr, isOk } from '@/core/result';
import type { SavedBaseplateDesign } from '@/features/baseplate/types/library';
import {
  saveDesign,
  loadDesign,
  duplicateDesign as duplicateStorageDesign,
  deleteDesign as deleteStorageDesign,
  updateDesignName,
  setActiveDesignId,
} from '@/features/baseplate/storage/BaseplateStorage';
import {
  loadRegistry,
  subscribeToRegistry,
  upsertRegistryEntry,
  removeRegistryEntry,
  type BaseplateRef,
} from '@/features/baseplate/store/baseplateRegistry';

// useSyncExternalStore requires referentially stable snapshots between
// notifications. `cachedRegistry` is only reassigned inside `notifyAll` (or on
// the 0→1 subscriber transition, when no consumer can observe the change yet).
let cachedRegistry: BaseplateRef[] = loadRegistry();
const subscribers = new Set<() => void>();

function notifyAll(): void {
  cachedRegistry = loadRegistry();
  subscribers.forEach((cb) => cb());
}

subscribeToRegistry(notifyAll);

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === 'gridfinity-baseplate-registry-v1' || e.key === null) {
      notifyAll();
    }
  });
}

function subscribe(callback: () => void): () => void {
  // Catches registry writes that landed while nothing was subscribed.
  if (subscribers.size === 0) {
    cachedRegistry = loadRegistry();
  }
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}

function getSnapshot(): BaseplateRef[] {
  return cachedRegistry;
}

function refFromDesign(design: SavedBaseplateDesign): BaseplateRef {
  return { id: design.id, name: design.name, updatedAt: design.updatedAt };
}

// Monotonic token guarding `switchActive`. Rapidly selecting two designs kicks
// off two IndexedDB reads; without this the earlier read resolving last would
// clobber the newer selection. Module-scoped so it's shared across every hook
// instance (the selector can unmount/remount between clicks).
let switchSeq = 0;

export interface UseBaseplateLibrary {
  readonly list: BaseplateRef[];
  readonly activeBaseplateId: BaseplateDesignId | null;
  switchActive: (id: BaseplateDesignId) => Promise<Result<SavedBaseplateDesign, StorageError>>;
  saveCurrentAsNew: (
    name: string,
    params: StoredBaseplateParams
  ) => Promise<Result<SavedBaseplateDesign, StorageError>>;
  forkActive: () => void;
  renameDesign: (
    id: BaseplateDesignId,
    name: string
  ) => Promise<Result<SavedBaseplateDesign, StorageError>>;
  duplicateDesign: (id: BaseplateDesignId) => Promise<Result<SavedBaseplateDesign, StorageError>>;
  deleteDesign: (id: BaseplateDesignId) => Promise<Result<void, StorageError>>;
}

export function useBaseplateLibrary(): UseBaseplateLibrary {
  const list = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const activeBaseplateId = useLayoutStore((s) => s.layout.activeBaseplateId ?? null);
  const baseplateParams = useLayoutStore((s) => s.layout.baseplateParams);
  const mutations = useMutations();

  const saveCurrentAsNew = useCallback(
    async (
      name: string,
      params: StoredBaseplateParams
    ): Promise<Result<SavedBaseplateDesign, StorageError>> => {
      const result = await saveDesign({ name, params, thumbnail: null });
      if (isOk(result)) {
        upsertRegistryEntry(refFromDesign(result.value));
        setActiveDesignId(result.value.id);
      }
      return result;
    },
    []
  );

  const forkActive = useCallback((): void => {
    // Detach into an unsaved draft holding a copy of the current active design's
    // params (named only on Save, symmetric with New). Uses the undoable CQRS
    // path, matching how New resets the pointer to null.
    if (!baseplateParams) return;
    mutations.setActiveBaseplate(null, { ...baseplateParams });
  }, [baseplateParams, mutations]);

  const renameDesign = useCallback(
    async (
      id: BaseplateDesignId,
      name: string
    ): Promise<Result<SavedBaseplateDesign, StorageError>> => {
      const result = await updateDesignName(id, name);
      if (isOk(result)) {
        upsertRegistryEntry(refFromDesign(result.value));
      }
      return result;
    },
    []
  );

  const duplicateDesign = useCallback(
    async (id: BaseplateDesignId): Promise<Result<SavedBaseplateDesign, StorageError>> => {
      const result = await duplicateStorageDesign(id);
      if (isOk(result)) {
        upsertRegistryEntry(refFromDesign(result.value));
      }
      return result;
    },
    []
  );

  const deleteDesign = useCallback(
    async (id: BaseplateDesignId): Promise<Result<void, StorageError>> => {
      const result = await deleteStorageDesign(id);
      if (isOk(result)) {
        removeRegistryEntry(id);
      }
      return result;
    },
    []
  );

  const switchActive = useCallback(
    async (id: BaseplateDesignId): Promise<Result<SavedBaseplateDesign, StorageError>> => {
      // Materialize the design's params into the layout via the CQRS command,
      // which sets both `activeBaseplateId` and `baseplateParams` and captures
      // the previous state for undo. Synced fields resolve live downstream in
      // `buildFullParams`, so the design still adapts to this layout's drawer.
      const token = ++switchSeq;
      const result = await loadDesign(id);
      // A newer switch started while this read was in flight — drop this
      // result so the later selection wins regardless of resolve order.
      if (token !== switchSeq) return result;
      if (isErr(result)) {
        return result;
      }
      mutations.setActiveBaseplate(id, result.value.params);
      setActiveDesignId(id);
      return result;
    },
    [mutations]
  );

  return {
    list,
    activeBaseplateId,
    switchActive,
    saveCurrentAsNew,
    forkActive,
    renameDesign,
    duplicateDesign,
    deleteDesign,
  };
}

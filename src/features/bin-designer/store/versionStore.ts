/**
 * In-memory version list for the design currently open in the designer.
 *
 * A separate store rather than a designer-store slice, mirroring how layouts
 * keep `useSnapshotStore` out of the layout store: version history is loaded
 * per design, never participates in undo, and must not push a designer history
 * entry when it changes.
 */

import { create } from 'zustand';
import { isErr, isOk } from '@/core/result';
import { showErrorToast } from '@/shared/hooks/useResultToast';
import type { DesignId } from '@/core/types';
import type {
  DesignVersionContent,
  DesignVersionOrigin,
  DesignVersionSummary,
} from '@/features/bin-designer/types';
import {
  createDesignVersion,
  listDesignVersions,
  readDesignVersion,
  renameDesignVersion,
  setDesignVersionPinned,
  deleteDesignVersion,
} from '@/features/bin-designer/storage/DesignVersionService';

export interface DesignVersionState {
  /** Versions of the loaded design, newest first. */
  versions: DesignVersionSummary[];
  /** The design `versions` belongs to; guards against a stale list after a switch. */
  loadedDesignId: DesignId | null;
  isLoading: boolean;
  /**
   * Versions dropped by the most recent save, held until the UI has announced
   * them. Eviction of something the user deliberately named is never silent.
   */
  lastEvicted: DesignVersionSummary[];

  loadForDesign: (designId: DesignId) => Promise<void>;
  saveVersion: (
    designId: DesignId,
    name: string,
    content: DesignVersionContent,
    thumbnail: string | null,
    origin?: DesignVersionOrigin
  ) => Promise<DesignVersionSummary | null>;
  readVersion: (versionId: string) => Promise<DesignVersionContent | null>;
  rename: (versionId: string, name: string) => Promise<void>;
  setPinned: (versionId: string, pinned: boolean) => Promise<void>;
  remove: (versionId: string) => Promise<void>;
  clearEvicted: () => void;
  reset: () => void;
}

export const INITIAL_DESIGN_VERSION_STATE = {
  versions: [] as DesignVersionSummary[],
  loadedDesignId: null as DesignId | null,
  isLoading: false,
  lastEvicted: [] as DesignVersionSummary[],
} as const;

export const useDesignVersionStore = create<DesignVersionState>((set, get) => ({
  ...INITIAL_DESIGN_VERSION_STATE,

  loadForDesign: async (designId: DesignId) => {
    set({ isLoading: true });
    try {
      const result = await listDesignVersions(designId);
      if (isErr(result)) {
        showErrorToast(result.error);
        set({ versions: [], loadedDesignId: designId });
        return;
      }
      set({ versions: result.value, loadedDesignId: designId });
    } finally {
      set({ isLoading: false });
    }
  },

  saveVersion: async (designId, name, content, thumbnail, origin = 'manual') => {
    const result = await createDesignVersion(designId, name, content, thumbnail, origin);
    if (isErr(result)) {
      showErrorToast(result.error);
      return null;
    }
    const { version, evicted } = result.value;
    // Re-read rather than splicing the returned summary in: the service may have
    // evicted rows, and the list has to match what is actually stored.
    const listed = await listDesignVersions(designId);
    set({
      versions: isOk(listed) ? listed.value : get().versions,
      loadedDesignId: designId,
      lastEvicted: [...evicted],
    });
    return version;
  },

  readVersion: async (versionId: string) => {
    const result = await readDesignVersion(versionId);
    if (isErr(result)) {
      showErrorToast(result.error);
      return null;
    }
    return result.value;
  },

  rename: async (versionId: string, name: string) => {
    const result = await renameDesignVersion(versionId, name);
    if (isErr(result)) {
      showErrorToast(result.error);
      return;
    }
    set({ versions: get().versions.map((v) => (v.id === versionId ? result.value : v)) });
  },

  setPinned: async (versionId: string, pinned: boolean) => {
    const result = await setDesignVersionPinned(versionId, pinned);
    if (isErr(result)) {
      showErrorToast(result.error);
      return;
    }
    set({ versions: get().versions.map((v) => (v.id === versionId ? result.value : v)) });
  },

  remove: async (versionId: string) => {
    const result = await deleteDesignVersion(versionId);
    if (isErr(result)) {
      showErrorToast(result.error);
      return;
    }
    set({ versions: get().versions.filter((v) => v.id !== versionId) });
  },

  clearEvicted: () => {
    set({ lastEvicted: [] });
  },

  reset: () => {
    set({ ...INITIAL_DESIGN_VERSION_STATE, versions: [], lastEvicted: [] });
  },
}));

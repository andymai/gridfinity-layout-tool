/**
 * Folder operations on the layout library, with persistence and user-facing
 * failure toasts. Every rule (name limits, cycles, what a delete lifts to the
 * parent) lives in `@/core/storage` as pure functions; this hook reads the
 * live library, applies one, stores the result and saves it.
 */

import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLibraryStore } from '@/core/store/library';
import { useToastStore } from '@/core/store/toast';
import type { FolderKind, LayoutFolder, LayoutId, LayoutLibrary } from '@/core/types';
import { getUserMessage, isErr, ok } from '@/core/result';
import type { LayoutError, Result } from '@/core/result';
import {
  createFolder as createFolderIn,
  deleteFolder as deleteFolderIn,
  moveFolder as moveFolderIn,
  renameFolder as renameFolderIn,
  saveLibrary,
  setEntryFolder,
  setFolderKind as setFolderKindIn,
} from '@/core/storage';
import { useTranslation } from '@/i18n';

const EMPTY_FOLDERS: readonly LayoutFolder[] = [];

type Created = { library: LayoutLibrary; folder: LayoutFolder };

function createKinded(
  library: LayoutLibrary,
  name: string,
  parentId: string | null,
  kind: FolderKind | undefined
): Result<Created, LayoutError> {
  const created = createFolderIn(library, name, parentId);
  if (kind === undefined || isErr(created)) return created;
  const { folder } = created.value;
  const kinded = setFolderKindIn(created.value.library, folder.id, kind, folder.createdAt);
  return isErr(kinded) ? kinded : ok({ library: kinded.value, folder: { ...folder, kind } });
}

export function useLayoutFolders() {
  const t = useTranslation();
  const { folders, setLibrary } = useLibraryStore(
    useShallow((s) => ({ folders: s.library.folders ?? EMPTY_FOLDERS, setLibrary: s.setLibrary }))
  );
  const addToast = useToastStore((s) => s.addToast);

  const commit = useCallback(
    async <T>(
      result: Result<T, LayoutError>,
      pick: (value: T) => LayoutLibrary
    ): Promise<T | null> => {
      if (isErr(result)) {
        addToast(getUserMessage(result.error), 'error');
        return null;
      }
      const previous = useLibraryStore.getState().library;
      const next = pick(result.value);
      setLibrary(next);
      const saved = await saveLibrary(next);
      if (isErr(saved)) {
        // What the store shows must be what a reload will show, unless a
        // newer library landed meanwhile; that one saves itself.
        if (useLibraryStore.getState().library === next) setLibrary(previous);
        addToast(t('layouts.folders.saveFailed'), 'error');
        return null;
      }
      return result.value;
    },
    [addToast, setLibrary, t]
  );

  const current = (): LayoutLibrary => useLibraryStore.getState().library;

  const createFolder = useCallback(
    async (
      name: string,
      parentId: string | null = null,
      kind?: FolderKind
    ): Promise<LayoutFolder | null> => {
      const created = await commit(createKinded(current(), name, parentId, kind), (v) => v.library);
      return created?.folder ?? null;
    },
    [commit]
  );

  const renameFolder = useCallback(
    (id: string, name: string) => commit(renameFolderIn(current(), id, name), (v) => v),
    [commit]
  );

  const moveFolder = useCallback(
    (id: string, parentId: string | null) =>
      commit(moveFolderIn(current(), id, parentId), (v) => v),
    [commit]
  );

  const deleteFolder = useCallback(
    (id: string) => commit(deleteFolderIn(current(), id), (v) => v.library),
    [commit]
  );

  const moveLayout = useCallback(
    (layoutId: LayoutId, folderId: string | null) =>
      commit(setEntryFolder(current(), layoutId, folderId), (v) => v),
    [commit]
  );

  const setFolderKind = useCallback(
    (id: string, kind: FolderKind) => commit(setFolderKindIn(current(), id, kind), (v) => v),
    [commit]
  );

  return {
    folders,
    createFolder,
    renameFolder,
    moveFolder,
    deleteFolder,
    moveLayout,
    setFolderKind,
  };
}

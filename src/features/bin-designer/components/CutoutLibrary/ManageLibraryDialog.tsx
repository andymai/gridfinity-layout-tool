/**
 * Rename, move, delete, export and import library items and folders. Every
 * change goes straight to the library store, which syncs it.
 */

import { useRef, useState } from 'react';
import {
  Button,
  Dialog,
  IconButton,
  InlineEditText,
  PlusIcon,
  Select,
  TrashIcon,
} from '@/design-system';
import { useTranslation } from '@/i18n';
import { useToastStore } from '@/core/store/toast';
import { isErr } from '@/core/result';
import type { Result, StorageError } from '@/core/result';
import { trackEvent } from '@/shared/analytics/posthog';
import type {
  CutoutLibraryFolder,
  CutoutLibraryItem,
} from '@/features/bin-designer/library/libraryTypes';
import {
  MAX_LIBRARY_FOLDERS,
  MAX_LIBRARY_FOLDER_DEPTH,
  MAX_LIBRARY_ITEMS,
  MAX_LIBRARY_NAME_LENGTH,
} from '@/features/bin-designer/library/libraryTypes';
import {
  createFolder,
  createItem,
  deleteFolder,
  deleteItem,
  updateFolder,
  updateItem,
  wouldLoop,
} from '@/features/bin-designer/library/CutoutLibraryService';
import { useCutoutLibrary } from '@/features/bin-designer/library/cutoutLibraryStore';
import {
  downloadLibraryFolder,
  downloadLibraryItem,
  importedMeshesUsable,
  parseLibraryFileJSON,
  type LibraryFolderTree,
} from '@/features/bin-designer/library/libraryFile';
import {
  importFolderTree,
  treeLimit,
  type LibraryLimit,
} from '@/features/bin-designer/library/libraryTreeImport';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { folderOptions, folderRows } from './libraryFolders';

interface ManageLibraryDialogProps {
  readonly onClose: () => void;
}

type PendingDelete =
  | { readonly kind: 'item'; readonly item: CutoutLibraryItem }
  | { readonly kind: 'folder'; readonly folder: CutoutLibraryFolder };

const NO_FOLDER = '';

const LIMIT_MESSAGES: Record<LibraryLimit, { readonly key: string; readonly max: number }> = {
  items: { key: 'binDesigner.cutouts.library.full', max: MAX_LIBRARY_ITEMS },
  folders: { key: 'binDesigner.cutouts.library.foldersFull', max: MAX_LIBRARY_FOLDERS },
  depth: { key: 'binDesigner.cutouts.library.importTooDeep', max: MAX_LIBRARY_FOLDER_DEPTH },
};

export function ManageLibraryDialog({ onClose }: ManageLibraryDialogProps) {
  const t = useTranslation();
  const addToast = useToastStore((s) => s.addToast);
  const { items, folders } = useCutoutLibrary();
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderById = new Map(folders.map((f) => [f.id, f]));
  const noFolder = t('binDesigner.cutouts.library.noFolder');

  const importFolder = async (tree: LibraryFolderTree) => {
    for (const item of tree.items) {
      if (!(await importedMeshesUsable(item.content))) {
        addToast(t('binDesigner.cutouts.library.importFailed'), 'error');
        return;
      }
    }
    const limit = treeLimit(tree, { items: items.length, folders: folders.length });
    if (limit) {
      addToast(t(LIMIT_MESSAGES[limit].key, { max: LIMIT_MESSAGES[limit].max }), 'error');
      return;
    }
    const imported = await importFolderTree(tree, {
      folder: t('binDesigner.cutouts.library.newFolder'),
      item: t('binDesigner.cutouts.library.defaultName'),
    });
    if (isErr(imported)) {
      // Another tab filled the library after the check above.
      const full = imported.error.code === 'STORAGE_QUOTA_EXCEEDED';
      addToast(
        full
          ? t('binDesigner.cutouts.library.full', { max: MAX_LIBRARY_ITEMS })
          : t('binDesigner.cutouts.library.saveFailed'),
        'error'
      );
      return;
    }
    trackEvent('cutout_library_folder_imported', {
      items: imported.value.items,
      folders: imported.value.folders,
    });
    addToast(
      t('binDesigner.cutouts.library.importedFolder', { name: imported.value.folder.name }),
      'success'
    );
  };

  const importFile = async (file: File) => {
    const parsed = parseLibraryFileJSON(await file.text(), t);
    if (parsed?.kind === 'folder') {
      await importFolder(parsed.tree);
      return;
    }
    if (!parsed || !(await importedMeshesUsable(parsed.content))) {
      addToast(t('binDesigner.cutouts.library.importFailed'), 'error');
      return;
    }
    const name = parsed.name || t('binDesigner.cutouts.library.defaultName');
    const created = await createItem({ name, folderId: null, content: parsed.content });
    if (isErr(created)) {
      const full = created.error.code === 'STORAGE_QUOTA_EXCEEDED';
      addToast(
        full
          ? t('binDesigner.cutouts.library.full', { max: MAX_LIBRARY_ITEMS })
          : t('binDesigner.cutouts.library.saveFailed'),
        'error'
      );
      return;
    }
    trackEvent('cutout_library_item_imported', {
      shapes: parsed.content.params.cutouts.length,
    });
    addToast(t('binDesigner.cutouts.library.imported', { name: created.value.name }), 'success');
  };

  const exportItem = async (item: CutoutLibraryItem) => {
    const saved = await downloadLibraryItem(item);
    if (isErr(saved)) {
      if (saved.error.code === 'STORAGE_MESH_MISSING') {
        addToast(t('binDesigner.cutouts.library.exportFailed'), 'error');
      }
      return;
    }
    trackEvent('cutout_library_item_exported', { shapes: item.content.params.cutouts.length });
  };

  const exportFolder = async (folder: CutoutLibraryFolder) => {
    const saved = await downloadLibraryFolder(folder, folders, items);
    if (isErr(saved)) {
      if (saved.error.code === 'STORAGE_MESH_MISSING') {
        addToast(t('binDesigner.cutouts.library.exportFolderFailed'), 'error');
      }
      return;
    }
    trackEvent('cutout_library_folder_exported', {
      items: saved.value.items.length,
      folders: saved.value.folders.length,
    });
  };

  /** Toast a failed write, with `limit`'s message when it hit that limit. */
  const report = async (
    write: Promise<Result<unknown, StorageError>>,
    limit?: { readonly key: string; readonly max: number }
  ) => {
    const result = await write;
    if (!isErr(result)) return;
    addToast(
      limit && result.error.code === 'STORAGE_QUOTA_EXCEEDED'
        ? t(limit.key, { max: limit.max })
        : t('binDesigner.cutouts.library.saveFailed'),
      'error'
    );
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    void report(
      pendingDelete.kind === 'item'
        ? deleteItem(pendingDelete.item.id)
        : deleteFolder(pendingDelete.folder.id)
    );
    setPendingDelete(null);
  };

  return (
    <>
      <Dialog.Root open onClose={onClose} size="xl">
        <Dialog.Header title={t('binDesigner.cutouts.library.manage')} />
        <Dialog.Body>
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  void report(createFolder(t('binDesigner.cutouts.library.newFolder'), null), {
                    key: 'binDesigner.cutouts.library.foldersFull',
                    max: MAX_LIBRARY_FOLDERS,
                  })
                }
              >
                <PlusIcon size="sm" aria-hidden="true" />
                {t('binDesigner.cutouts.library.newFolder')}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => fileInputRef.current?.click()}>
                {t('binDesigner.cutouts.library.importFile')}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                hidden
                data-testid="library-import-input"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void importFile(file);
                  e.target.value = '';
                }}
              />
            </div>

            {folders.length > 0 && (
              <ul className="flex flex-col gap-1">
                {folderRows(folders).map(({ folder, depth }) => (
                  <li
                    key={folder.id}
                    className="flex items-center gap-2"
                    style={{ paddingLeft: `${depth * 12}px` }}
                  >
                    <div className="min-w-0 flex-1 text-sm font-medium">
                      <InlineEditText
                        value={folder.name}
                        maxLength={MAX_LIBRARY_NAME_LENGTH}
                        aria-label={t('binDesigner.cutouts.library.rename', { name: folder.name })}
                        onCommit={(name) => void report(updateFolder(folder.id, { name }))}
                      />
                    </div>
                    <Select
                      size="sm"
                      className="w-36 flex-shrink-0"
                      aria-label={t('binDesigner.cutouts.library.moveTo', { name: folder.name })}
                      value={folder.parentId ?? NO_FOLDER}
                      options={folderOptions(
                        folders.filter(
                          (f) => f.id !== folder.id && !wouldLoop(folder.id, f.id, folderById)
                        ),
                        noFolder
                      )}
                      onValueChange={(value) =>
                        void report(
                          updateFolder(folder.id, {
                            parentId: value === NO_FOLDER ? null : value,
                          }),
                          {
                            key: 'binDesigner.cutouts.library.tooDeep',
                            max: MAX_LIBRARY_FOLDER_DEPTH,
                          }
                        )
                      }
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={t('binDesigner.cutouts.library.exportFolder', {
                        name: folder.name,
                      })}
                      onClick={() => void exportFolder(folder)}
                    >
                      {t('common.export')}
                    </Button>
                    <IconButton
                      size="sm"
                      variant="ghost"
                      aria-label={t('binDesigner.cutouts.library.deleteFolder', {
                        name: folder.name,
                      })}
                      onClick={() => setPendingDelete({ kind: 'folder', folder })}
                    >
                      <TrashIcon size="sm" />
                    </IconButton>
                  </li>
                ))}
              </ul>
            )}

            <ul className="flex flex-col gap-1">
              {items.map((item) => (
                <li key={item.id} className="flex items-center gap-2">
                  <div className="min-w-0 flex-1 text-sm">
                    <InlineEditText
                      value={item.name}
                      maxLength={MAX_LIBRARY_NAME_LENGTH}
                      aria-label={t('binDesigner.cutouts.library.rename', { name: item.name })}
                      onCommit={(name) => void report(updateItem(item.id, { name }))}
                    />
                  </div>
                  <Select
                    size="sm"
                    className="w-36 flex-shrink-0"
                    aria-label={t('binDesigner.cutouts.library.moveTo', { name: item.name })}
                    value={
                      item.folderId !== null && folderById.has(item.folderId)
                        ? item.folderId
                        : NO_FOLDER
                    }
                    options={folderOptions(folders, noFolder)}
                    onValueChange={(value) =>
                      void report(
                        updateItem(item.id, { folderId: value === NO_FOLDER ? null : value })
                      )
                    }
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={t('binDesigner.cutouts.library.exportItem', { name: item.name })}
                    onClick={() => void exportItem(item)}
                  >
                    {t('common.export')}
                  </Button>
                  <IconButton
                    size="sm"
                    variant="ghost"
                    aria-label={t('binDesigner.cutouts.library.deleteItem', { name: item.name })}
                    onClick={() => setPendingDelete({ kind: 'item', item })}
                  >
                    <TrashIcon size="sm" />
                  </IconButton>
                </li>
              ))}
            </ul>
          </div>
        </Dialog.Body>
        <Dialog.Footer>
          <Button variant="secondary" onClick={onClose}>
            {t('common.close')}
          </Button>
        </Dialog.Footer>
      </Dialog.Root>
      <ConfirmDialog
        isOpen={pendingDelete !== null}
        title={t('common.delete')}
        message={
          pendingDelete
            ? t('binDesigner.cutouts.library.confirmDelete', {
                name:
                  pendingDelete.kind === 'item'
                    ? pendingDelete.item.name
                    : pendingDelete.folder.name,
              })
            : ''
        }
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}

/**
 * Name a selection and pick its folder before it goes into the library. When
 * the selection came from an item, it can update that item or save a new one.
 */

import { useId, useState } from 'react';
import { Button, Dialog, Field, Input, SegmentedControl, Select } from '@/design-system';
import { useTranslation } from '@/i18n';
import type {
  CutoutLibraryFolder,
  CutoutLibraryItem,
} from '@/features/bin-designer/library/libraryTypes';
import { MAX_LIBRARY_NAME_LENGTH } from '@/features/bin-designer/library/libraryTypes';
import { folderOptions } from './libraryFolders';

export type SaveMode = 'update' | 'new';

export interface SaveChoice {
  readonly mode: SaveMode;
  readonly name: string;
  readonly folderId: string | null;
}

interface SaveToLibraryDialogProps {
  /** The item the selection came from, which saving can update. */
  readonly source: CutoutLibraryItem | null;
  readonly defaultName: string;
  readonly folders: readonly CutoutLibraryFolder[];
  readonly saving: boolean;
  readonly onSave: (choice: SaveChoice) => void;
  readonly onCancel: () => void;
}

const NO_FOLDER = '';

export function SaveToLibraryDialog({
  source,
  defaultName,
  folders,
  saving,
  onSave,
  onCancel,
}: SaveToLibraryDialogProps) {
  const t = useTranslation();
  const nameId = useId();
  const folderId = useId();
  const [mode, setMode] = useState<SaveMode>(source ? 'update' : 'new');
  const [name, setName] = useState(defaultName);
  const [folder, setFolder] = useState(source?.folderId ?? NO_FOLDER);

  const submit = () => {
    if (saving) return;
    onSave({ mode, name, folderId: folder === NO_FOLDER ? null : folder });
  };

  return (
    <Dialog.Root open onClose={onCancel} size="sm">
      <Dialog.Header title={t('binDesigner.cutouts.library.save')} />
      <Dialog.Body>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          {source && (
            <SegmentedControl<SaveMode>
              options={[
                {
                  value: 'update',
                  label: t('binDesigner.cutouts.library.updateExisting', { name: source.name }),
                },
                { value: 'new', label: t('binDesigner.cutouts.library.saveAsNew') },
              ]}
              value={mode}
              onChange={setMode}
              size="sm"
              aria-label={t('binDesigner.cutouts.library.save')}
            />
          )}
          <Field label={t('binDesigner.cutouts.library.name')} htmlFor={nameId}>
            <Input
              id={nameId}
              value={name}
              maxLength={MAX_LIBRARY_NAME_LENGTH}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label={t('binDesigner.cutouts.library.folder')} htmlFor={folderId}>
            <Select
              id={folderId}
              value={folder}
              options={folderOptions(folders, t('binDesigner.cutouts.library.noFolder'))}
              onValueChange={setFolder}
            />
          </Field>
        </form>
      </Dialog.Body>
      <Dialog.Footer>
        <Button variant="secondary" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button variant="primary" onClick={submit} disabled={saving}>
          {t('common.save')}
        </Button>
      </Dialog.Footer>
    </Dialog.Root>
  );
}

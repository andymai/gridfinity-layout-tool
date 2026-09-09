import { useState } from 'react';
import type { LayoutLibrary } from '@/core/types';
import { useTranslation } from '@/i18n';
import { Button, Dialog } from '@/design-system';
import { FolderPickList } from '../FolderPickList';

interface MoveToFolderDialogProps {
  readonly open: boolean;
  readonly library: LayoutLibrary;
  /** What is being moved, for the title. */
  readonly name: string;
  /** Where it sits now. */
  readonly currentFolderId: string | null;
  /** Set when a folder is being moved, so its own subtree is off limits. */
  readonly movingFolderId?: string;
  readonly onClose: () => void;
  readonly onMove: (folderId: string | null) => void;
}

/**
 * Pick a destination folder; Move is enabled once the choice differs from now.
 * Mount it per item (`key`), since the choice seeds from the current folder.
 */
export function MoveToFolderDialog({
  open,
  library,
  name,
  currentFolderId,
  movingFolderId,
  onClose,
  onMove,
}: MoveToFolderDialogProps) {
  const t = useTranslation();
  const [picked, setPicked] = useState<string | null>(currentFolderId);

  return (
    <Dialog.Root open={open} onClose={onClose} size="sm">
      <Dialog.Header
        title={t('layouts.folders.moveTitle', { name })}
        closeAriaLabel={t('common.closeDialog')}
      />
      <Dialog.Body>
        <FolderPickList
          library={library}
          value={picked}
          movingFolderId={movingFolderId}
          onPick={setPicked}
        />
      </Dialog.Body>
      <Dialog.Footer>
        <Button variant="secondary" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button
          variant="primary"
          disabled={picked === currentFolderId}
          onClick={() => onMove(picked)}
        >
          {t('layouts.folders.move')}
        </Button>
      </Dialog.Footer>
    </Dialog.Root>
  );
}

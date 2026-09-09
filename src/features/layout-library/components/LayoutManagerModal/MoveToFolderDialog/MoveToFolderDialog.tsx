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
  /** Resolves once the move is stored; the dialog stays inert until then. */
  readonly onMove: (folderId: string | null) => Promise<void> | void;
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
  const [busy, setBusy] = useState(false);
  // A move applied elsewhere while the dialog is open (sync) resets the
  // choice, or Move would file the layout back where it just came from.
  const [seenCurrent, setSeenCurrent] = useState(currentFolderId);
  if (seenCurrent !== currentFolderId) {
    setSeenCurrent(currentFolderId);
    setPicked(currentFolderId);
  }
  const move = async () => {
    setBusy(true);
    try {
      await onMove(picked);
    } finally {
      setBusy(false);
    }
  };

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
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          {t('common.cancel')}
        </Button>
        <Button
          variant="primary"
          disabled={busy || picked === currentFolderId}
          loading={busy}
          onClick={() => void move()}
        >
          {t('layouts.folders.move')}
        </Button>
      </Dialog.Footer>
    </Dialog.Root>
  );
}

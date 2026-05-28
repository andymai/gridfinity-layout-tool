import { Dialog } from '@/design-system';
import { Button } from '@/design-system';
import { LayoutThumbnail } from '@/shell/LayoutThumbnail';
import { useTranslation } from '@/i18n';
import type { Snapshot } from '@/core/types';

interface RestoreDialogProps {
  snapshot: Snapshot | null;
  onReplace: () => void;
  onCreateCopy: () => void;
  onClose: () => void;
}

export function RestoreDialog({ snapshot, onReplace, onCreateCopy, onClose }: RestoreDialogProps) {
  const t = useTranslation();

  if (!snapshot) return null;

  return (
    <Dialog.Root open={!!snapshot} onClose={onClose} size="sm">
      <Dialog.Header title={t('snapshots.restore')} closeAriaLabel={t('common.closeDialog')} />
      <Dialog.Body>
        <div className="flex items-start gap-4 mb-4">
          <LayoutThumbnail preview={snapshot.preview} size={64} />
          <div>
            <p className="text-sm font-medium text-content">
              {snapshot.label ?? t('snapshots.autoSaved')}
            </p>
            <p className="text-xs text-content-tertiary mt-1">
              {t('snapshots.bins', { count: snapshot.preview.binCount })}
              {' \u00b7 '}
              {t('snapshots.layers', { count: snapshot.preview.layerCount })}
            </p>
          </div>
        </div>
        <p className="text-sm text-content-secondary">{t('snapshots.replaceWarning')}</p>
      </Dialog.Body>
      <Dialog.Footer>
        <Button variant="ghost" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button variant="ghost" onClick={onCreateCopy}>
          {t('snapshots.createCopy')}
        </Button>
        <Button variant="primary" onClick={onReplace}>
          {t('snapshots.restore')}
        </Button>
      </Dialog.Footer>
    </Dialog.Root>
  );
}

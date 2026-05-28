import { Button, Dialog } from '@/design-system';
import { useTranslation } from '@/i18n';

export interface DeleteAccountDialogProps {
  isOpen: boolean;
  /** Local item count, surfaced in the body so the user knows what's NOT being deleted. */
  localCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmation dialog for the irreversible Delete Account flow. Cancel is
 * the primary visual action — destructive defaults shouldn't be one
 * stray Enter press away.
 */
export function DeleteAccountDialog({
  isOpen,
  localCount,
  onConfirm,
  onCancel,
}: DeleteAccountDialogProps) {
  const t = useTranslation();
  return (
    <Dialog.Root open={isOpen} onClose={onCancel} size="md">
      <Dialog.Header
        title={t('syncDialog.deleteAccount.title')}
        closeAriaLabel={t('common.closeDialog')}
      />
      <Dialog.Body>
        <p className="text-sm text-content-secondary">{t('syncDialog.deleteAccount.message')}</p>
        <p className="text-sm text-content-secondary mt-3">
          {t('syncDialog.deleteAccount.localNote', { count: localCount })}
        </p>
      </Dialog.Body>
      <Dialog.Footer>
        <Button variant="primary" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button variant="danger" onClick={onConfirm}>
          {t('syncDialog.deleteAccount.confirm')}
        </Button>
      </Dialog.Footer>
    </Dialog.Root>
  );
}

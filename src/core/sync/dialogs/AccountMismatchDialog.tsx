import { Button, Dialog } from '@/design-system';
import { useTranslation } from '@/i18n';

export interface AccountMismatchDialogProps {
  isOpen: boolean;
  localCount: number;
  newAccountLabel: string;
  onChoice: (choice: 'merge' | 'discard') => void;
}

/**
 * Account-mismatch guard dialog. Both choices are explicit: Esc and
 * backdrop click are no-ops because either choice — Merge or Discard —
 * is consequential, and a reflex Escape press shouldn't wipe local
 * data nor silently merge it into the wrong account. The user must
 * pick one of the two buttons.
 */
export function AccountMismatchDialog({
  isOpen,
  localCount,
  newAccountLabel,
  onChoice,
}: AccountMismatchDialogProps) {
  const t = useTranslation();
  return (
    <Dialog.Root open={isOpen} onClose={() => {}} size="md">
      <Dialog.Header title={t('syncDialog.accountMismatch.title')} />
      <Dialog.Body>
        <p className="text-sm text-content-secondary">
          {t('syncDialog.accountMismatch.message', {
            count: localCount,
            account: newAccountLabel,
          })}
        </p>
      </Dialog.Body>
      <Dialog.Footer>
        <Button variant="danger" onClick={() => onChoice('discard')}>
          {t('syncDialog.accountMismatch.discard')}
        </Button>
        <Button variant="primary" onClick={() => onChoice('merge')}>
          {t('syncDialog.accountMismatch.merge', { account: newAccountLabel })}
        </Button>
      </Dialog.Footer>
    </Dialog.Root>
  );
}

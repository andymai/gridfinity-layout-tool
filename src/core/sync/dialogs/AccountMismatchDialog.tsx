import { Button, Dialog } from '@/design-system';
import { useTranslation } from '@/i18n';

export interface AccountMismatchDialogProps {
  isOpen: boolean;
  localCount: number;
  newAccountLabel: string;
  onChoice: (choice: 'merge' | 'discard') => void;
}

/**
 * Account-mismatch guard dialog. Default action is Discard — if the
 * device is shared and a different account is signing in, we don't want
 * the previous user's layouts to silently leak into the new account's
 * cloud. The Merge option is opt-in for the rare "I made a second
 * Google account" case.
 */
export function AccountMismatchDialog({
  isOpen,
  localCount,
  newAccountLabel,
  onChoice,
}: AccountMismatchDialogProps) {
  const t = useTranslation();
  return (
    <Dialog.Root open={isOpen} onClose={() => onChoice('discard')} size="md">
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
        <Button variant="ghost" onClick={() => onChoice('merge')}>
          {t('syncDialog.accountMismatch.merge', { account: newAccountLabel })}
        </Button>
        <Button variant="primary" onClick={() => onChoice('discard')}>
          {t('syncDialog.accountMismatch.discard')}
        </Button>
      </Dialog.Footer>
    </Dialog.Root>
  );
}

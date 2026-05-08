import { Button, Dialog } from '@/design-system';
import { useTranslation } from '@/i18n';

export interface SignOutDialogProps {
  isOpen: boolean;
  localCount: number;
  onChoice: (choice: 'keep' | 'wipe') => void;
  onCancel: () => void;
}

/**
 * Three-outcome dialog for explicit sign-out: Keep local (default,
 * primary), Wipe local (secondary, destructive), or Cancel.
 *
 * The plan defaults Keep because most users sign out on their own
 * device and want their library back on next sign-in. Wipe is for
 * the shared-computer case.
 */
export function SignOutDialog({ isOpen, localCount, onChoice, onCancel }: SignOutDialogProps) {
  const t = useTranslation();
  return (
    <Dialog.Root open={isOpen} onClose={onCancel} size="md">
      <Dialog.Header title={t('syncDialog.signOut.title')} />
      <Dialog.Body>
        <p className="text-sm text-content-secondary">
          {t('syncDialog.signOut.message', { count: localCount })}
        </p>
      </Dialog.Body>
      <Dialog.Footer>
        <Button variant="ghost" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button variant="ghost" onClick={() => onChoice('wipe')}>
          {t('syncDialog.signOut.wipe')}
        </Button>
        <Button variant="primary" onClick={() => onChoice('keep')}>
          {t('syncDialog.signOut.keep')}
        </Button>
      </Dialog.Footer>
    </Dialog.Root>
  );
}

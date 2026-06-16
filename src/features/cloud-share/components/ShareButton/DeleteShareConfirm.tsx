import { useState } from 'react';
import { Button } from '@/design-system';
import { useTranslation } from '@/i18n';

interface DeleteShareConfirmProps {
  isDeleting: boolean;
  onConfirm: () => void;
}

/**
 * Two-step delete affordance for an existing share link: a subtle "Delete"
 * link that expands into an inline confirm panel. Click events stop
 * propagation so the popover's click-outside handler doesn't see the
 * confirm-flow buttons being removed from the DOM mid-flow as an outside
 * click.
 */
export function DeleteShareConfirm({ isDeleting, onConfirm }: DeleteShareConfirmProps) {
  const t = useTranslation();
  const [showConfirm, setShowConfirm] = useState(false);

  if (!showConfirm) {
    return (
      <Button
        variant="ghost"
        onClick={(e) => {
          e.stopPropagation();
          setShowConfirm(true);
        }}
        className="text-sm font-normal text-content-tertiary hover:text-error hover:bg-transparent transition-colors"
      >
        {t('share.deleteShareLink')}
      </Button>
    );
  }

  return (
    <div className="bg-error/10 border border-error/30 rounded-lg p-3 space-y-2">
      <p className="text-sm text-content">{t('share.deleteConfirmMessage')}</p>
      <div className="flex gap-2">
        <Button
          variant="danger"
          loading={isDeleting}
          onClick={(e) => {
            e.stopPropagation();
            onConfirm();
          }}
          className="text-sm px-3 py-1.5"
        >
          {isDeleting ? t('share.deleting') : t('common.delete')}
        </Button>
        <Button
          variant="secondary"
          onClick={(e) => {
            e.stopPropagation();
            setShowConfirm(false);
          }}
          disabled={isDeleting}
          className="text-sm px-3 py-1.5"
        >
          {t('common.cancel')}
        </Button>
      </div>
    </div>
  );
}

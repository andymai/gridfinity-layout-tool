import { useState } from 'react';
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
      <button
        onClick={(e) => {
          e.stopPropagation();
          setShowConfirm(true);
        }}
        className="text-sm text-content-tertiary hover:text-error transition-colors"
      >
        {t('share.deleteShareLink')}
      </button>
    );
  }

  return (
    <div className="bg-error/10 border border-error/30 rounded-lg p-3 space-y-2">
      <p className="text-sm text-content">{t('share.deleteConfirmMessage')}</p>
      <div className="flex gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onConfirm();
          }}
          disabled={isDeleting}
          className="btn btn-secondary text-error border-error hover:bg-error hover:text-white text-sm px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isDeleting ? (
            <span className="flex items-center gap-2">
              <svg
                className="w-3 h-3 animate-spin motion-reduce:animate-none"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              {t('share.deleting')}
            </span>
          ) : (
            t('common.delete')
          )}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowConfirm(false);
          }}
          disabled={isDeleting}
          className="btn btn-secondary text-sm px-3 py-1.5 disabled:opacity-50"
        >
          {t('common.cancel')}
        </button>
      </div>
    </div>
  );
}

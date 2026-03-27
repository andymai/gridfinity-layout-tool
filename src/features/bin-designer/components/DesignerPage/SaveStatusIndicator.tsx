/**
 * Compact status label reflecting the current save state.
 * Returns null when status is 'idle'.
 */

import { useTranslation } from '@/i18n';
import type { SaveStatus } from '@/features/bin-designer/types';

/** CSS class for each save status */
const SAVE_STATUS_CLASSES: Record<Exclude<SaveStatus, 'idle'>, string> = {
  saving: 'text-content-tertiary',
  saved: 'text-content-secondary animate-fade-in',
  error: 'text-red-400',
};

export function SaveStatusIndicator({
  status,
  compact,
}: {
  status: SaveStatus;
  compact?: boolean;
}) {
  const t = useTranslation();
  if (status === 'idle') return null;

  const statusTextKey = {
    saving: 'header.saving',
    saved: 'header.saved',
    error: 'binDesigner.saveFailed',
  } as const;

  return (
    <div
      className={`flex items-center gap-1.5 ${compact ? 'px-0.5 py-0.5' : 'px-2 py-1 mr-2'} text-[11px] ${SAVE_STATUS_CLASSES[status]}`}
      aria-live="polite"
      role="status"
    >
      {status === 'saving' && (
        <svg
          className="w-3 h-3 animate-spin motion-reduce:animate-none"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle
            className="opacity-20"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="3"
          />
          <path
            className="opacity-70"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      )}
      {status === 'saved' && (
        <svg
          className="w-3 h-3 text-success"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      )}
      {status === 'error' && (
        <svg
          className="w-3 h-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      )}
      {!compact && <span>{t(statusTextKey[status])}</span>}
    </div>
  );
}

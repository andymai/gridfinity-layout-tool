/**
 * Banner shown while a shared design is being fetched from the API.
 */

import { useTranslation } from '@/i18n';

export function ShareLoadingBanner() {
  const t = useTranslation();
  return (
    <div className="flex items-center justify-center gap-2 bg-accent-muted px-3 py-1.5 text-xs font-medium text-accent">
      <svg
        className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
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
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
      {t('binDesigner.loadingSharedDesign')}
    </div>
  );
}

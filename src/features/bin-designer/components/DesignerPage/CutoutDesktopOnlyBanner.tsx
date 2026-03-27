/**
 * Info banner shown on non-desktop viewports when the cutout editor is open.
 * Explains that the cutout editor is only available on desktop.
 */

import { useTranslation } from '@/i18n';

export function CutoutDesktopOnlyBanner() {
  const t = useTranslation();
  return (
    <div className="flex items-center gap-2 bg-info/10 px-4 py-2 text-xs text-info border-b border-info/20">
      <svg
        className="h-4 w-4 flex-shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span>{t('binDesigner.cutoutDesktopOnly')}</span>
    </div>
  );
}

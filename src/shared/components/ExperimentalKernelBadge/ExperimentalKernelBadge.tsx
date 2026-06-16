/**
 * Floating badge overlay shown inside 3D preview areas when the experimental
 * CAD kernel Labs flag (`brepkit_kernel`) is enabled. Non-dismissible,
 * pointer-events pass through to the canvas except for the "Labs settings" link.
 */

import { Button } from '@/design-system';
import { useFeatureFlag } from '@/shared/hooks/useFeatureFlag';
import { useLabsStore } from '@/core/store';
import { useTranslation } from '@/i18n';

export function ExperimentalKernelBadge() {
  const t = useTranslation();
  const isBrepkitEnabled = useFeatureFlag('brepkit_kernel');
  const openDrawer = useLabsStore((s) => s.openDrawer);

  if (!isBrepkitEnabled) return null;

  return (
    <div className="absolute left-3 top-3 z-10 pointer-events-none">
      <div className="flex flex-col gap-0.5 rounded-lg border border-info/20 bg-info/10 px-3 py-2 text-xs text-info shadow-sm backdrop-blur-sm">
        <div className="flex items-center gap-1.5">
          <svg
            className="h-3.5 w-3.5 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="font-medium">{t('labs.experimentalKernel.title')}</span>
        </div>
        <span className="leading-relaxed text-info/80">{t('labs.experimentalKernel.warning')}</span>
        <Button
          variant="ghost"
          type="button"
          onClick={openDrawer}
          className="pointer-events-auto mt-0.5 h-auto self-start rounded-none bg-transparent px-0 py-0 text-xs font-normal text-info underline underline-offset-2 hover:bg-transparent hover:text-info/80"
        >
          {t('labs.experimentalKernel.labsSettings')}
        </Button>
      </div>
    </div>
  );
}

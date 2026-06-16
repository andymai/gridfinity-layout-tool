/**
 * Parameter-panel footer affordance: "Set current settings as default for new
 * bins" at the moment of intent (while the user is editing parameters), plus a
 * subtle indicator when a custom default is already active.
 *
 * Resetting to factory lives in the Saved Designs ⋯ menu / Settings / command
 * palette — kept out of this high-traffic spot. Shares behavior with every
 * other surface via `useBinDefaults`.
 */

import { useTranslation } from '@/i18n';
import { Button } from '@/design-system';
import { useBinDefaults } from '@/features/bin-designer/hooks';

export function SetDefaultFooter() {
  const t = useTranslation();
  const { hasCustomDefault, setCurrentAsDefault } = useBinDefaults();

  return (
    <div className="px-4 py-3">
      <Button
        type="button"
        variant="ghost"
        onClick={setCurrentAsDefault}
        className="flex w-full items-center gap-2 rounded-md px-0 py-1 text-left text-xs font-normal text-content-secondary transition-colors hover:text-content"
      >
        <svg
          className="h-4 w-4 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <span className="flex-1">{t('binDesigner.setAsDefault')}</span>
      </Button>
      {hasCustomDefault && (
        <div className="mt-1.5 flex items-center gap-1.5 pl-6 text-[11px] text-content-tertiary">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
          {t('binDesigner.customDefaultActive')}
        </div>
      )}
    </div>
  );
}

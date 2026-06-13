/**
 * One-time inline hint that explains how multi-color zones map to slicer
 * filaments. Dismissal persists in the settings store so users only see
 * it once per browser profile.
 */

import { useShallow } from 'zustand/react/shallow';
import { IconButton } from '@/design-system';
import { InfoIcon, XIcon } from '@/design-system/Icon';
import { useSettingsStore } from '@/core/store';
import { useTranslation } from '@/i18n';

const HINT_ID = 'multi-color-export';

export function ColorsHintBanner() {
  const t = useTranslation();
  const { dismissed, dismissedHints, updateSettings } = useSettingsStore(
    useShallow((s) => ({
      dismissed: s.settings.dismissedHints.includes(HINT_ID),
      dismissedHints: s.settings.dismissedHints,
      updateSettings: s.updateSettings,
    }))
  );

  if (dismissed) return null;

  return (
    <div
      role="status"
      className="flex items-start gap-2 rounded-lg border border-info/40 bg-info-muted/40 p-2.5 text-[11px] text-content-secondary"
    >
      <InfoIcon size="sm" className="mt-0.5 shrink-0 text-info" />
      <p className="flex-1 leading-snug">{t('binDesigner.colors.firstTimeHint')}</p>
      <IconButton
        variant="ghost"
        size="sm"
        touchTarget={false}
        onClick={() => {
          updateSettings({ dismissedHints: [...dismissedHints, HINT_ID] });
        }}
        className="shrink-0"
        aria-label={t('binDesigner.colors.firstTimeHint.dismiss')}
        title={t('binDesigner.colors.firstTimeHint.dismiss')}
      >
        <XIcon size="sm" />
      </IconButton>
    </div>
  );
}

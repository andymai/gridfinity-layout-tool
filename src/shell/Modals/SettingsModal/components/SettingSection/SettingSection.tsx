import type { ReactNode } from 'react';
import { Button, RotateCcwIcon } from '@/design-system';
import { useSettingsStore } from '@/core/store';
import { useToastStore } from '@/core/store/toast';
import { useTranslation } from '@/i18n';
import type { UserSettings } from '@/core/store/settings';
import { useSettingsNav } from '../../SettingsModalContext';

// Store actions are read lazily in the reset handler (not subscribed at render)
// so a section renders without coupling its tab's tests to the settings store.

interface SettingSectionProps {
  /** Stable anchor id; must match the section's entry in settingsRegistry. */
  id: string;
  title: string;
  hint?: string;
  /** Leading icon shown before the title. */
  icon?: ReactNode;
  /** Danger styling for the title (e.g. Storage "Clear all data"). */
  tone?: 'default' | 'danger';
  /**
   * Settings keys this section owns. When provided, a Reset control appears that
   * restores exactly these keys to their defaults — applied immediately with an
   * Undo toast (the reset is non-destructive, so no confirmation prompt).
   */
  resetKeys?: (keyof UserSettings)[];
  /**
   * Custom reset handler; overrides `resetKeys` (for non-UserSettings resets).
   * Applied immediately; the handler owns its own user feedback.
   */
  onReset?: () => void;
  /** Hide/disable the reset control (e.g. already at defaults). */
  resetDisabled?: boolean;
  children: ReactNode;
}

/**
 * A titled settings section with a search anchor and an optional per-section
 * reset. When the active settings search result targets this section, it scrolls
 * into view and briefly highlights.
 */
export function SettingSection({
  id,
  title,
  hint,
  icon,
  tone = 'default',
  resetKeys,
  onReset,
  resetDisabled = false,
  children,
}: SettingSectionProps) {
  const t = useTranslation();
  const { highlightedSectionId } = useSettingsNav();

  const isHighlighted = highlightedSectionId === id;
  const canReset = (onReset || (resetKeys && resetKeys.length > 0)) && !resetDisabled;

  const handleReset = () => {
    if (onReset) {
      onReset();
      return;
    }
    if (!resetKeys) return;

    // Snapshot the owned keys so the reset can be undone from the toast.
    const previous = useSettingsStore.getState().settings;
    const snapshot = Object.fromEntries(
      resetKeys.map((key) => [key, previous[key]])
    ) as Partial<UserSettings>;

    useSettingsStore.getState().resetSettingKeys(resetKeys);
    useToastStore.getState().addToast({
      message: t('settings.section.resetDone', { section: title }),
      type: 'info',
      action: {
        label: t('common.undo'),
        onClick: () => {
          useSettingsStore.getState().updateSettings(snapshot);
        },
      },
    });
  };

  return (
    <section
      id={id}
      data-settings-section={id}
      className={`scroll-mt-4 rounded-lg transition-shadow ${
        isHighlighted ? 'ring-2 ring-accent ring-offset-2 ring-offset-surface-secondary' : ''
      }`}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3
            className={`flex items-center gap-2 text-base font-semibold ${
              tone === 'danger' ? 'text-error' : 'text-content'
            }`}
          >
            {icon}
            {title}
          </h3>
          {hint && <p className="mt-1 text-xs text-content-tertiary">{hint}</p>}
        </div>
        {canReset && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="flex-shrink-0 gap-1 text-xs text-content-tertiary hover:text-content"
            aria-label={t('settings.section.resetAria', { section: title })}
          >
            <RotateCcwIcon size="sm" />
            {t('settings.section.reset')}
          </Button>
        )}
      </div>
      {children}
    </section>
  );
}

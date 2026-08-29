/**
 * Feature toggle: a switch row with optional inline controls.
 *
 * `primaryControls` show whenever the feature is on; `children` fold behind
 * the shared MoreDisclosure idiom.
 */

import { type ReactNode } from 'react';
import { useTranslation } from '@/i18n';
import { Button } from '@/design-system';
import { MoreDisclosure } from '@/shared/components/MoreDisclosure';

interface FeatureToggleProps {
  /** Display label for the feature */
  label: string;
  /** Whether the feature is enabled */
  checked: boolean;
  /** Called when toggle changes */
  onChange: () => void;
  /** Brief summary of current value shown when enabled (e.g., "6.5mm x 2mm") */
  valueSummary?: string;
  /** Controls shown immediately when enabled (no Customize click needed) */
  primaryControls?: ReactNode;
  /** Detailed controls shown when "Customize" is clicked */
  children?: ReactNode;
  /** Whether this feature is coming soon (shows badge, disables toggle) */
  comingSoon?: boolean;
  /** Reason the feature is unavailable (disables toggle, shows explanation). Takes precedence over comingSoon. */
  disabledReason?: string;
  /** Override the "Customize" button label. Defaults to t('common.customize'). */
  customizeLabel?: string;
  /** Optional badge rendered next to the label (e.g., an "Experimental" pill). */
  badge?: ReactNode;
}

export function FeatureToggle({
  label,
  checked,
  onChange,
  valueSummary,
  primaryControls,
  children,
  comingSoon = false,
  disabledReason,
  customizeLabel,
  badge,
}: FeatureToggleProps) {
  const t = useTranslation();

  const isDisabled = !!disabledReason || comingSoon;
  const isActive = checked && !isDisabled;

  return (
    <div>
      {/* Toggle row — vertical rhythm is owned by the parent container
          (PanelSection leading / a stacking `space-y`), not this row, so a
          toggle never adds padding on top of an already-padded section. */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-content-secondary">{label}</span>
          {!disabledReason && comingSoon && (
            <span className="rounded-full bg-surface-tertiary px-1.5 py-0.5 text-micro font-medium text-content-tertiary">
              {t('common.soon')}
            </span>
          )}
          {badge}
        </div>
        <Button
          variant="ghost"
          type="button"
          role="switch"
          aria-checked={isActive}
          aria-label={label}
          onClick={onChange}
          disabled={isDisabled}
          className={`relative inline-flex h-7 w-12 items-center justify-start rounded-full px-0 py-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${
            isDisabled
              ? 'cursor-not-allowed bg-stroke-subtle opacity-50 hover:bg-stroke-subtle'
              : checked
                ? 'bg-accent hover:bg-accent'
                : 'bg-stroke-subtle hover:bg-stroke-subtle'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
              isActive ? 'translate-x-6' : 'translate-x-0.5'
            }`}
          />
        </Button>
      </div>

      {/* Disabled reason text */}
      {disabledReason && (
        <p className="mt-0.5 text-label text-content-tertiary">{disabledReason}</p>
      )}

      {/* Primary controls (shown immediately when enabled, no Customize needed) */}
      {isActive && primaryControls && <div className="mt-1.5 space-y-3">{primaryControls}</div>}

      {/* Detailed controls behind the shared disclosure idiom. */}
      {isActive && children && (
        <MoreDisclosure
          className="ml-1 mt-0.5"
          label={customizeLabel ?? t('common.customize')}
          summary={valueSummary}
        >
          {children}
        </MoreDisclosure>
      )}
    </div>
  );
}

/**
 * Feature toggle: a switch row with optional inline controls.
 *
 * `primaryControls` show whenever the feature is on; `children` fold behind
 * the shared MoreDisclosure idiom.
 */

import { useId, type ReactNode } from 'react';
import { useTranslation } from '@/i18n';
import { Button } from '@/design-system';
import { cn } from '@/design-system/cn';
import { LabelInfo } from '@/shared/components/InfoDot';
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
  /** Disabled with no reason line, for a cause the control right above already shows. */
  disabled?: boolean;
  /** Override the "Customize" button label. Defaults to t('common.customize'). */
  customizeLabel?: string;
  /** Optional badge rendered next to the label (e.g., an "Experimental" pill). */
  badge?: ReactNode;
  /** Evergreen explanation behind an info dot beside the label. */
  info?: ReactNode;
  shortcut?: string;
  trailing?: ReactNode;
  /** The whole row pulses on a help jump; the switch takes focus. */
  helpTarget?: string;
  ariaLabel?: string;
  variant?: 'desktop' | 'mobile';
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
  info,
  disabled = false,
  shortcut,
  trailing,
  helpTarget,
  ariaLabel,
  variant = 'desktop',
}: FeatureToggleProps) {
  const t = useTranslation();
  const switchId = useId();
  const isMobile = variant === 'mobile';

  const isDisabled = disabled || !!disabledReason || comingSoon;
  const isActive = checked && !isDisabled;
  // The switch reports `checked` even while disabled: the stored value survives
  // the gate, and a switch that read "off" would claim the setting had been
  // cleared when it is only waiting on the reason below. Only the controls
  // fold away, since nothing they set can apply until the gate lifts.
  const switchTone = isDisabled
    ? checked
      ? 'cursor-not-allowed bg-accent opacity-50 hover:bg-accent'
      : 'cursor-not-allowed bg-stroke-subtle opacity-50 hover:bg-stroke-subtle'
    : checked
      ? 'bg-accent hover:bg-accent'
      : 'bg-stroke-subtle hover:bg-stroke-subtle';

  return (
    <div data-help-target={helpTarget}>
      {/* Toggle row — vertical rhythm is owned by the parent container
          (PanelSection leading / a stacking `space-y`), not this row, so a
          toggle never adds padding on top of an already-padded section. */}
      <div className={cn('relative flex items-center justify-between', isMobile && 'min-h-11')}>
        {/* On a phone the label's ::before stretches over the row, so a tap
            anywhere along it toggles. It resolves against the row because the
            label and this cluster stay unpositioned. Badges and key caps let
            taps through to it; the info dot and trailing menu sit on top. */}
        <div
          className={cn(
            'flex items-center gap-2',
            isMobile &&
              '[&>:not(label,button,a)]:pointer-events-none [&_a]:pointer-events-auto [&_a]:relative [&_button]:pointer-events-auto [&_button]:relative'
          )}
        >
          <label
            htmlFor={switchId}
            className={cn(
              isMobile ? 'text-sm' : 'text-xs',
              'text-content-secondary',
              !isDisabled && 'cursor-pointer',
              isMobile && !isDisabled && "before:absolute before:inset-0 before:content-['']"
            )}
          >
            {label}
          </label>
          {info !== undefined && <LabelInfo label={label}>{info}</LabelInfo>}
          {shortcut && (
            <kbd className="rounded border border-stroke-subtle bg-surface-elevated px-1 py-0.5 text-micro leading-none text-content-disabled">
              {shortcut}
            </kbd>
          )}
          {trailing}
          {!disabledReason && comingSoon && (
            <span className="rounded-full bg-surface-tertiary px-1.5 py-0.5 text-micro font-medium text-content-tertiary">
              {t('common.soon')}
            </span>
          )}
          {badge}
        </div>
        <Button
          id={switchId}
          variant="ghost"
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label={ariaLabel ?? label}
          data-help-focus={helpTarget ? '' : undefined}
          onClick={onChange}
          disabled={isDisabled}
          className={`relative inline-flex h-7 w-12 items-center justify-start rounded-full px-0 py-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${switchTone}`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
              checked ? 'translate-x-6' : 'translate-x-0.5'
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

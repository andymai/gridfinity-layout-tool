/**
 * Feature toggle with "Customize" inline expand pattern.
 *
 * Shows a toggle switch with optional default value summary.
 * When enabled, optionally shows a "Customize" link that reveals
 * detailed sub-controls inline below the toggle.
 */

import { useState, useId, type ReactNode } from 'react';
import { useTranslation } from '@/i18n';

interface FeatureToggleProps {
  /** Display label for the feature */
  label: string;
  /** Whether the feature is enabled */
  checked: boolean;
  /** Called when toggle changes */
  onChange: () => void;
  /** Brief summary of current value shown when enabled (e.g., "6.5mm × 2mm") */
  valueSummary?: string;
  /** Controls shown immediately when enabled (no Customize click needed) */
  primaryControls?: ReactNode;
  /** Detailed controls shown when "Customize" is clicked */
  children?: ReactNode;
  /** Whether this feature is coming soon (shows badge, disables toggle) */
  comingSoon?: boolean;
}

export function FeatureToggle({
  label,
  checked,
  onChange,
  valueSummary,
  primaryControls,
  children,
  comingSoon = false,
}: FeatureToggleProps) {
  const t = useTranslation();
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const contentId = useId();

  return (
    <div>
      {/* Toggle row */}
      <div className="flex items-center justify-between py-1.5">
        <div className="flex items-center gap-2">
          <span className="text-xs text-content-secondary">{label}</span>
          {comingSoon && (
            <span className="rounded-full bg-surface-tertiary px-1.5 py-0.5 text-[10px] font-medium text-content-tertiary">
              {t('binDesigner.soon')}
            </span>
          )}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label={label}
          onClick={onChange}
          disabled={comingSoon}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${
            comingSoon
              ? 'cursor-not-allowed bg-stroke-subtle opacity-50'
              : checked
                ? 'bg-accent'
                : 'bg-stroke-subtle'
          }`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${
              checked ? 'translate-x-4' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      {/* Primary controls (shown immediately when enabled, no Customize needed) */}
      {checked && !comingSoon && primaryControls && (
        <div className="mt-1.5 space-y-3">{primaryControls}</div>
      )}

      {/* Value summary + Customize link (shown when enabled and has children) */}
      {checked && !comingSoon && children && (
        <div className="ml-1 mt-0.5">
          <div className="flex items-center gap-2">
            {valueSummary && !customizeOpen && (
              <span className="text-[11px] text-content-tertiary">{valueSummary}</span>
            )}
            <button
              type="button"
              onClick={() => setCustomizeOpen(!customizeOpen)}
              aria-expanded={customizeOpen}
              aria-controls={contentId}
              className="text-[11px] font-medium text-accent hover:text-accent/80 transition-colors"
            >
              {customizeOpen ? t('common.done') : t('binDesigner.customize')}
            </button>
          </div>

          {/* Inline expand for detailed controls */}
          <div
            id={contentId}
            role="region"
            aria-label={`${label} settings`}
            aria-hidden={!customizeOpen}
            className={`overflow-hidden transition-all duration-200 ${
              customizeOpen ? 'opacity-100 max-h-[500px] mt-2' : 'opacity-0 max-h-0'
            }`}
          >
            <div className="space-y-3 border-l-2 border-accent/20 pl-3 pb-1">{children}</div>
          </div>
        </div>
      )}
    </div>
  );
}

import type { ReactNode } from 'react';
import { Checkbox } from '@/design-system';

interface ToggleRowProps {
  /** Label text displayed on the left. */
  label: string;
  /** Whether the toggle is on. */
  checked: boolean;
  /** Called when the row is clicked or activated via keyboard. */
  onChange: () => void;
  /** Optional tooltip shown on hover over the label. */
  tooltip?: string;
  /** Optional keyboard hint rendered as a <kbd> next to the label (e.g. "H"). */
  shortcut?: string;
  /** Accessible name; falls back to `label`. */
  ariaLabel?: string;
  /** Help-modal deep-link target, applied to the row itself so the pulse lands on it. */
  helpTarget?: string;
  /** Platform variant affects text size and checkbox hit area. */
  variant?: 'desktop' | 'mobile';
  /**
   * Control rendered just after the label — an overflow menu trigger for rows
   * that own a sub-editor. Must be interactive; it is deliberately a sibling of
   * the checkbox rather than a child (see the structure note below).
   */
  trailing?: ReactNode;
}

/**
 * Sidebar boolean row: label on the left, Checkbox on the right, whole row
 * clickable.
 *
 * The sidebar deliberately uses checkboxes rather than the Settings modal's
 * FeatureToggle pill — the column is 288px wide and a pill is 28px tall per
 * row. Reach for this instead of hand-rolling the row so every sidebar boolean
 * shares one keyboard and ARIA implementation.
 *
 * The checkbox role lives on an inset overlay rather than on the row element
 * because `role="checkbox"` is Children Presentational: a `trailing` button
 * nested inside it would be invisible to assistive tech. As a sibling of the
 * overlay it stays exposed, and the label and checkbox keep their columns.
 */
export function ToggleRow({
  label,
  checked,
  onChange,
  tooltip,
  shortcut,
  ariaLabel,
  helpTarget,
  variant = 'desktop',
  trailing,
}: ToggleRowProps) {
  const isMobile = variant === 'mobile';

  return (
    <div
      className={`relative flex items-center justify-between ${isMobile ? 'py-2 text-sm' : 'pt-2'}`}
    >
      <div
        data-help-target={helpTarget}
        className="absolute inset-0 cursor-pointer rounded"
        onClick={onChange}
        role="checkbox"
        aria-checked={checked}
        aria-label={ariaLabel ?? label}
        title={tooltip}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            onChange();
          }
        }}
      />
      <div className="relative flex items-center gap-1.5 pointer-events-none">
        <span className={`leading-none ${checked ? 'text-content' : 'text-content-tertiary'}`}>
          {label}
        </span>
        {shortcut && (
          <kbd className="text-micro leading-none text-content-disabled bg-surface-elevated px-1 py-0.5 rounded border border-stroke-subtle">
            {shortcut}
          </kbd>
        )}
        {trailing && <span className="pointer-events-auto">{trailing}</span>}
      </div>
      <div className="relative pointer-events-none">
        <Checkbox checked={checked} size={isMobile ? 'lg' : 'md'} />
      </div>
    </div>
  );
}

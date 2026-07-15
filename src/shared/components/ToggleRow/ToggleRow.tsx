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
}

/**
 * Sidebar boolean row: label on the left, Checkbox on the right, whole row
 * clickable.
 *
 * The sidebar deliberately uses checkboxes rather than the Settings modal's
 * FeatureToggle pill — the column is 288px wide and a pill is 28px tall per
 * row. Reach for this instead of hand-rolling the row so every sidebar boolean
 * shares one keyboard and ARIA implementation.
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
}: ToggleRowProps) {
  const isMobile = variant === 'mobile';

  return (
    <div
      data-help-target={helpTarget}
      className={`flex items-center justify-between cursor-pointer ${isMobile ? 'py-2 text-sm' : 'pt-2'}`}
      onClick={onChange}
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel ?? label}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          onChange();
        }
      }}
    >
      <div className="flex items-center gap-1.5">
        <span
          className={`leading-none ${checked ? 'text-content' : 'text-content-tertiary'}`}
          title={tooltip}
        >
          {label}
        </span>
        {shortcut && (
          <kbd className="text-[9px] leading-none text-content-disabled bg-surface-elevated px-1 py-0.5 rounded border border-stroke-subtle">
            {shortcut}
          </kbd>
        )}
      </div>
      <Checkbox checked={checked} size={isMobile ? 'lg' : 'md'} />
    </div>
  );
}

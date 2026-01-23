/**
 * Row of quick-select preset buttons.
 * Allows one-click selection of common values.
 */

interface QuickSelectProps<T extends number | string> {
  /** The currently selected value */
  value: T;
  /** Available preset options */
  options: T[];
  /** Called when an option is selected */
  onChange: (value: T) => void;
  /** Format function for display (default: String) */
  format?: (value: T) => string;
  /** Whether the control is disabled */
  disabled?: boolean;
  /** Accessible group label */
  ariaLabel: string;
}

export function QuickSelect<T extends number | string>({
  value,
  options,
  onChange,
  format = String,
  disabled = false,
  ariaLabel,
}: QuickSelectProps<T>) {
  return (
    <div className="flex gap-1" role="group" aria-label={ariaLabel}>
      {options.map((option) => {
        const isActive = option === value;
        return (
          <button
            key={String(option)}
            type="button"
            onClick={() => onChange(option)}
            disabled={disabled}
            className={`flex-1 rounded px-1.5 py-0.5 text-xs font-medium transition-colors ${
              isActive
                ? 'bg-accent text-white'
                : 'bg-surface-elevated text-content-secondary hover:bg-surface-hover'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            aria-pressed={isActive}
          >
            {format(option)}
          </button>
        );
      })}
    </div>
  );
}

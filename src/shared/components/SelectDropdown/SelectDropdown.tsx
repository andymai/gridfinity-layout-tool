interface SelectOption {
  id: string;
  name: string;
  /** Optional suffix to append to the name (e.g., "(current)") */
  suffix?: string;
}

interface SelectDropdownProps {
  /** Current selected value */
  value: string;
  /** Called when selection changes */
  onChange: (value: string) => void;
  /** List of options to display */
  options: SelectOption[];
  /** Optional placeholder shown when value is empty */
  placeholder?: {
    value: string;
    label: string;
    disabled?: boolean;
  };
  /** Color for left swatch. Pass string for solid color, null for mixed indicator, undefined for no swatch */
  colorSwatch?: string | null;
  /** Accessible label for the select */
  ariaLabel: string;
  /** Platform variant affects sizing */
  variant?: 'desktop' | 'mobile';
  /** Additional CSS classes for the wrapper */
  className?: string;
}

/**
 * Styled select dropdown with optional color swatch.
 * Provides consistent appearance across desktop and mobile variants.
 */
export function SelectDropdown({
  value,
  onChange,
  options,
  placeholder,
  colorSwatch,
  ariaLabel,
  variant = 'desktop',
  className = '',
}: SelectDropdownProps) {
  const isMobile = variant === 'mobile';
  const inputHeight = isMobile ? 'h-12' : '';
  const hasColorSwatch = colorSwatch !== undefined;

  return (
    <div className={`relative ${className}`}>
      {/* Color swatch indicator */}
      {hasColorSwatch &&
        (colorSwatch ? (
          <div
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded pointer-events-none"
            style={{ backgroundColor: colorSwatch }}
          />
        ) : (
          // Mixed/null state indicator
          <div className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded pointer-events-none bg-surface-hover border border-stroke-subtle" />
        ))}

      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`input w-full pr-8 appearance-none ${hasColorSwatch ? 'pl-8' : ''} ${inputHeight}`}
        aria-label={ariaLabel}
      >
        {placeholder && (
          <option value={placeholder.value} disabled={placeholder.disabled}>
            {placeholder.label}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.name}
            {opt.suffix || ''}
          </option>
        ))}
      </select>

      {/* Chevron indicator */}
      <svg
        className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-content-tertiary"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}

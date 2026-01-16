interface CheckboxProps {
  /** Whether the checkbox is checked */
  checked: boolean;
  /** Called when the checkbox value changes. If omitted, checkbox is display-only (for use inside clickable parent elements). */
  onChange?: (checked: boolean) => void;
  /** Accessible label for the checkbox. Only needed when onChange is provided (interactive mode). */
  ariaLabel?: string;
  /** Optional visible label text */
  label?: string;
  /** Platform variant affects sizing */
  variant?: 'desktop' | 'mobile';
  /** Whether the checkbox is disabled */
  disabled?: boolean;
  /** Additional CSS classes for the container */
  className?: string;
}

/**
 * Styled checkbox with consistent appearance across desktop and mobile.
 * Uses a custom visual indicator with accent color when checked.
 */
export function Checkbox({
  checked,
  onChange,
  ariaLabel,
  label,
  variant = 'desktop',
  disabled = false,
  className = '',
}: CheckboxProps) {
  const isMobile = variant === 'mobile';
  const size = isMobile ? 'w-6 h-6' : 'w-4 h-4';
  const iconPadding = isMobile ? 'p-1' : 'p-0.5';

  // Display-only mode: no interaction handlers, used inside clickable parent elements
  const isDisplayOnly = !onChange;

  const handleClick = () => {
    if (!disabled && onChange) {
      onChange(!checked);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === ' ' || e.key === 'Enter') && !disabled && onChange) {
      e.preventDefault();
      onChange(!checked);
    }
  };

  // Display-only mode: just render the visual indicator
  if (isDisplayOnly) {
    return (
      <div className={`flex items-center gap-2 ${className}`} aria-hidden="true">
        <div className={`relative ${size} flex-shrink-0`}>
          <div
            className={`${size} rounded border-2 transition-colors ${
              checked
                ? 'bg-accent border-accent'
                : 'bg-surface border-stroke'
            }`}
          />
          {checked && (
            <svg
              className={`absolute inset-0 ${size} text-white ${iconPadding}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
        {label && (
          <span className={`${isMobile ? 'text-sm' : 'text-xs'} ${checked ? 'text-content' : 'text-content-secondary'} select-none`}>
            {label}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-2 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${className}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
    >
      {/* Visual checkbox indicator */}
      <div className={`relative ${size} flex-shrink-0 pointer-events-none`} aria-hidden="true">
        <div
          className={`${size} rounded border-2 transition-colors ${
            checked
              ? 'bg-accent border-accent'
              : 'bg-surface border-stroke'
          }`}
        />
        {checked && (
          <svg
            className={`absolute inset-0 ${size} text-white ${iconPadding}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>

      {/* Optional label */}
      {label && (
        <span className={`${isMobile ? 'text-sm' : 'text-xs'} ${checked ? 'text-content' : 'text-content-secondary'} select-none`}>
          {label}
        </span>
      )}
    </div>
  );
}

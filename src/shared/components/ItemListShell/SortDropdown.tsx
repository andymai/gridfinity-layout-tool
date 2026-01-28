import type { SortOption } from './types';

interface SortDropdownProps {
  options: SortOption[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
}

/**
 * Dropdown for selecting sort order.
 * Uses native select element for better accessibility and mobile UX.
 */
export function SortDropdown({ options, value, onChange, ariaLabel }: SortDropdownProps) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none pl-3 pr-8 py-1.5 bg-surface border border-stroke rounded-lg text-sm text-content focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent cursor-pointer"
        aria-label={ariaLabel}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {/* Dropdown arrow */}
      <svg
        className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-content-tertiary pointer-events-none"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}

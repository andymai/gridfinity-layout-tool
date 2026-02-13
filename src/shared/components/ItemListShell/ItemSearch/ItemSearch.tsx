import { ICON_PATHS } from '@/shared/constants/iconPaths';

interface ItemSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel: string;
  clearAriaLabel: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

/**
 * Search input with clear button for item lists.
 * Shows a magnifying glass icon on the left and an X button when there's input.
 */
export function ItemSearch({
  value,
  onChange,
  placeholder,
  ariaLabel,
  clearAriaLabel,
  inputRef,
}: ItemSearchProps) {
  return (
    <div className="relative">
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-tertiary"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        {ICON_PATHS.search.map((d) => (
          <path key={d} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
        ))}
      </svg>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-8 py-2 bg-surface border border-stroke rounded-lg text-sm text-content placeholder:text-content-tertiary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
        aria-label={ariaLabel}
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-content-tertiary hover:text-content transition-colors"
          aria-label={clearAriaLabel}
          type="button"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            {ICON_PATHS.close.map((d) => (
              <path key={d} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
            ))}
          </svg>
        </button>
      )}
    </div>
  );
}

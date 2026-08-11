import { IconButton, Input, XIcon } from '@/design-system';
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
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        fullWidth
        leftIcon={
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {ICON_PATHS.search.map((d) => (
              <path key={d} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
            ))}
          </svg>
        }
        // `leftIcon` sets pl-0 on the input, which butts the text against the
        // magnifier; pl-2 restores the gap. pr-8 is room for the clear button.
        className="pl-2 pr-8"
        aria-label={ariaLabel}
      />
      {value && (
        <IconButton
          type="button"
          variant="ghost"
          size="sm"
          touchTarget={false}
          onClick={() => onChange('')}
          aria-label={clearAriaLabel}
          className="absolute right-2 top-1/2 -translate-y-1/2"
        >
          <XIcon size="sm" />
        </IconButton>
      )}
    </div>
  );
}

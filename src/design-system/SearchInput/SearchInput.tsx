/**
 * Search field: an Input preset with a magnifier, an Escape-or-click clear
 * affordance, and an optional keyboard-shortcut hint shown while empty.
 */

import { forwardRef } from 'react';
import { Input, type InputProps } from '../Input';
import { IconButton } from '../IconButton';
import { SearchIcon, XIcon } from '../Icon';
import { Kbd } from '../Kbd';

export interface SearchInputProps extends Omit<
  InputProps,
  'leftIcon' | 'rightIcon' | 'type' | 'value' | 'onChange'
> {
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  /** Accessible label for the clear button. */
  readonly clearLabel: string;
  /** Shortcut hint (e.g. "⌘K") rendered as a Kbd chip while the field is empty. */
  readonly shortcutHint?: string;
  readonly onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ value, onValueChange, clearLabel, shortcutHint, onKeyDown, ...props }, ref) => {
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape' && value !== '') {
        // Claim Escape only while there is text to clear, so an enclosing
        // dialog still closes on Escape from an empty field. A claimed key is
        // not forwarded either — the caller's handler must not also act on it.
        e.stopPropagation();
        onValueChange('');
        return;
      }
      onKeyDown?.(e);
    };

    return (
      <Input
        ref={ref}
        type="text"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        onKeyDown={handleKeyDown}
        leftIcon={<SearchIcon size="sm" />}
        rightIcon={
          value !== '' ? (
            <IconButton
              type="button"
              variant="ghost"
              size="sm"
              touchTarget={false}
              aria-label={clearLabel}
              onClick={() => onValueChange('')}
            >
              <XIcon size="xs" />
            </IconButton>
          ) : shortcutHint ? (
            <Kbd aria-hidden="true">{shortcutHint}</Kbd>
          ) : undefined
        }
        {...props}
      />
    );
  }
);

SearchInput.displayName = 'SearchInput';

import { useEffect, useRef, useState } from 'react';
import { cn } from '../cn';
import { activePress, focusRing, interactiveTransition } from '../variants';

export interface InlineEditTextProps {
  /**
   * Current text value shown in display mode.
   */
  value: string;

  /**
   * Called with the trimmed committed value (or fallback when trim is empty).
   * Not called when reverted via Escape or when the value is unchanged.
   */
  onCommit: (value: string) => void;

  /**
   * Committed when the trimmed input is empty.
   * When omitted, an empty input reverts to the current value.
   */
  fallback?: string;

  /**
   * Maximum input length, applied natively to the edit input.
   */
  maxLength?: number;

  /**
   * Placeholder shown in the edit input.
   */
  placeholder?: string;

  /**
   * Accessible name for the display-mode edit button and the edit input,
   * e.g. 'Rename layout'.
   */
  'aria-label': string;

  /**
   * Also enter edit mode on contextmenu (mobile long-press path).
   * @default false
   */
  editOnContextMenu?: boolean;

  /**
   * Additional classes for the display-mode button.
   */
  displayClassName?: string;

  /**
   * Additional classes for the edit-mode input.
   */
  inputClassName?: string;
}

/**
 * Click-to-edit text for renaming items inline (layout names, category names).
 * Displays a button until clicked, then swaps to a focused, selected input.
 * Enter or blur commits, Escape reverts; focus returns to the button afterwards.
 *
 * @example
 * <InlineEditText
 *   value={layout.name}
 *   onCommit={setName}
 *   fallback="Untitled layout"
 *   maxLength={CONSTRAINTS.NAME_MAX_LENGTH}
 *   aria-label={t('header.editLayoutName')}
 * />
 *
 * @example
 * // Mobile long-press entry, custom sizing per surface
 * <InlineEditText
 *   value={category.name}
 *   onCommit={renameCategory}
 *   editOnContextMenu
 *   displayClassName="w-full text-center"
 *   inputClassName="w-full text-center"
 *   aria-label={t('mobile.categories.renameCategory')}
 * />
 */
export function InlineEditText({
  value,
  onCommit,
  fallback,
  maxLength,
  placeholder,
  'aria-label': ariaLabel,
  editOnContextMenu = false,
  displayClassName,
  inputClassName,
}: InlineEditTextProps): React.JSX.Element {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef(false);
  // Browsers (not jsdom) fire a native blur when the focused input is removed
  // from the DOM, so Escape-revert would otherwise commit the stale draft.
  const revertedRef = useRef(false);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
      restoreFocusRef.current = true;
    } else if (restoreFocusRef.current) {
      restoreFocusRef.current = false;
      buttonRef.current?.focus();
    }
  }, [isEditing]);

  const enterEdit = (): void => {
    revertedRef.current = false;
    setDraft(value);
    setIsEditing(true);
  };

  const commit = (): void => {
    if (revertedRef.current) return;
    const next = draft.trim() || fallback || value;
    if (next !== value) {
      onCommit(next);
    }
    setIsEditing(false);
  };

  const revert = (): void => {
    revertedRef.current = true;
    setDraft(value);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      commit();
    } else if (e.key === 'Escape') {
      revert();
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={cn(
          'px-3 py-1.5 rounded-md text-sm',
          interactiveTransition,
          'bg-surface-elevated border border-accent text-content',
          'outline-none [box-shadow:0_0_0_3px_var(--color-primary-muted)]',
          'placeholder:text-content-tertiary',
          inputClassName
        )}
      />
    );
  }

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={enterEdit}
      onContextMenu={
        editOnContextMenu
          ? (e) => {
              e.preventDefault();
              enterEdit();
            }
          : undefined
      }
      title={value}
      aria-label={ariaLabel}
      className={cn(
        'px-3 py-1.5 text-sm rounded-md truncate',
        interactiveTransition,
        activePress,
        ...focusRing,
        'text-content-secondary bg-transparent',
        'hover:bg-surface-hover hover:text-content hover:scale-[1.02]',
        displayClassName
      )}
    >
      {value}
    </button>
  );
}

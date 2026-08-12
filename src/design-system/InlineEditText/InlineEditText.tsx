import { useEffect, useRef } from 'react';
import { cn } from '../cn';
import { useInlineEdit } from './useInlineEdit';
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
   * Text for display mode when it must differ from the editable value, e.g. an
   * unlabelled snapshot that reads "Auto-saved" but edits as empty. Defaults
   * to {@link value}; the edit input always starts from {@link value}.
   */
  displayValue?: string;

  /**
   * Keep click and key events from reaching an ancestor.
   *
   * These fields commonly sit inside a clickable card or row, where entering
   * edit must not also select or open the item. Applies in both modes: typing
   * in the input would otherwise bubble to a card's own key handling.
   *
   * @default false
   */
  stopPropagation?: boolean;

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
 * The styled preset over {@link useInlineEdit}, which owns every one of those
 * rules. Use this when clicking the name is what starts the rename and the
 * display is only the name; use the hook directly when a menu triggers the
 * rename or the display carries more than the value, since this renders its own
 * button and nesting one inside a clickable row is wrong.
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
  displayValue,
  stopPropagation = false,
  displayClassName,
  inputClassName,
}: InlineEditTextProps): React.JSX.Element {
  const {
    isEditing,
    editingValue: draft,
    inputRef,
    startEditing: enterEdit,
    handleChange,
    handleFinish: commit,
    handleKeyDown: editKeyDown,
  } = useInlineEdit({ initialValue: value, onSave: onCommit, fallback });

  const buttonRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef(false);

  // Focus and selection on entering edit belong to the hook; returning focus to
  // the display button is this preset's own, since only it renders one.
  useEffect(() => {
    if (isEditing) {
      restoreFocusRef.current = true;
    } else if (restoreFocusRef.current) {
      restoreFocusRef.current = false;
      buttonRef.current?.focus();
    }
  }, [isEditing]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (stopPropagation) e.stopPropagation();
    editKeyDown(e);
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        onClick={stopPropagation ? (e) => e.stopPropagation() : undefined}
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
      onClick={(e) => {
        if (stopPropagation) e.stopPropagation();
        enterEdit();
      }}
      onContextMenu={
        editOnContextMenu
          ? (e) => {
              e.preventDefault();
              enterEdit();
            }
          : undefined
      }
      title={displayValue ?? value}
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
      {displayValue ?? value}
    </button>
  );
}

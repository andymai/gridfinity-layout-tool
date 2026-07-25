import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../cn';
import { interactiveTransition } from '../variants';

export interface ComboboxOption {
  /** Text inserted into the field when the option is chosen. */
  value: string;
  /** Display text (defaults to `value`). */
  label?: string;
  /** Muted trailing hint (e.g. a reason tag). */
  hint?: string;
}

/** Inline completion preview for the top prediction. */
export interface ComboboxGhost {
  /** Full value the ghost inserts when accepted. */
  value: string;
  /** The grey text shown after the caret (value minus the typed prefix). */
  completion: string;
}

type ComboboxSize = 'sm' | 'md' | 'lg';

export interface ComboboxProps {
  value: string;
  /** Fires on every keystroke. */
  onChange: (value: string) => void;
  /** Fires when a suggestion (option or ghost) is accepted. */
  onCommit?: (value: string, meta: { viaGhost: boolean; option?: ComboboxOption }) => void;
  /** Ranked options, already filtered by the caller. */
  options: ComboboxOption[];
  /** Inline ghost preview for the top prediction. */
  ghost?: ComboboxGhost | null;
  /** Whether to render the inline ghost (disable on touch/mobile). */
  enableInlineGhost?: boolean;
  /** Open the list as soon as the field is focused (proactive prediction). */
  openOnFocus?: boolean;
  placeholder?: string;
  maxLength?: number;
  disabled?: boolean;
  size?: ComboboxSize;
  'aria-label'?: string;
  className?: string;
  inputClassName?: string;
  renderOption?: (option: ComboboxOption, state: { active: boolean }) => ReactNode;
}

// Kept as a plain string (composed with `cn` at render, not module init) so an
// imported class token can't resolve `undefined` under a chunk cycle (#1466).
const WRAPPER_STATIC =
  'relative inline-flex w-full items-center bg-surface border border-stroke rounded-md ' +
  'hover:border-stroke-strong focus-within:border-accent focus-within:ring-1 focus-within:ring-accent';

const wrapperSize: Record<ComboboxSize, string> = { sm: 'h-7', md: 'py-2', lg: 'h-12' };
const fieldSize: Record<ComboboxSize, string> = {
  sm: 'px-2 text-xs',
  md: 'px-3 text-sm',
  lg: 'px-4 text-base',
};

/**
 * Text input with a portal dropdown of ranked suggestions and optional inline
 * ghost completion. Generic and controlled — the caller owns filtering/ranking
 * and simply passes `options` (+ an optional `ghost`).
 *
 * Keyboard: ↑/↓ move the active option, Enter accepts it, Tab/→ accept the ghost
 * (when the caret is at the end), Esc closes the list but keeps the value.
 */
export const Combobox = forwardRef<HTMLInputElement, ComboboxProps>(function Combobox(
  {
    value,
    onChange,
    onCommit,
    options,
    ghost = null,
    enableInlineGhost = true,
    openOnFocus = false,
    placeholder,
    maxLength,
    disabled,
    size = 'md',
    className,
    inputClassName,
    renderOption,
    'aria-label': ariaLabel,
  },
  ref
) {
  const listboxId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);

  const hasOptions = options.length > 0;
  const open = focused && !dismissed && hasOptions && (openOnFocus || value.trim().length > 0);
  const activeGhost =
    enableInlineGhost && ghost && focused && ghost.completion.length > 0 ? ghost : null;

  // Keep the active row within bounds as the option set changes.
  useEffect(() => {
    setActiveIndex((i) => (i >= options.length ? 0 : i));
  }, [options]);

  // Position the portal list under the field.
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const r = wrapperRef.current?.getBoundingClientRect();
      if (r) setRect({ top: r.bottom + 4, left: r.left, width: r.width });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open]);

  const clampValue = useCallback(
    (next: string) => (maxLength ? next.slice(0, maxLength) : next),
    [maxLength]
  );

  const commit = useCallback(
    (next: string, viaGhost: boolean, option?: ComboboxOption) => {
      const clamped = clampValue(next);
      onChange(clamped);
      onCommit?.(clamped, { viaGhost, option });
      setDismissed(true);
      setActiveIndex(0);
    },
    [clampValue, onChange, onCommit]
  );

  const caretAtEnd = () => {
    const el = wrapperRef.current?.querySelector('input');
    return !el || el.selectionStart === null || el.selectionStart === el.value.length;
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        e.stopPropagation();
        setDismissed(true);
      }
      return;
    }
    if ((e.key === 'Tab' || e.key === 'ArrowRight') && activeGhost && caretAtEnd()) {
      // Tab always accepts the ghost; ArrowRight only completes at the caret end.
      e.preventDefault();
      commit(activeGhost.value, true);
      return;
    }
    if (!open) {
      if (e.key === 'ArrowDown' && hasOptions) {
        e.preventDefault();
        setDismissed(false);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % options.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + options.length) % options.length);
    } else if (e.key === 'Enter' && activeIndex >= 0 && activeIndex < options.length) {
      e.preventDefault();
      const option = options[activeIndex];
      commit(option.value, false, option);
    }
  };

  return (
    <div
      ref={wrapperRef}
      className={cn(WRAPPER_STATIC, interactiveTransition, wrapperSize[size], className)}
    >
      {activeGhost && (
        <div
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute inset-0 flex select-none items-center',
            fieldSize[size]
          )}
        >
          <span className="invisible whitespace-pre">{value}</span>
          <span className="whitespace-pre text-content-tertiary">{activeGhost.completion}</span>
        </div>
      )}

      <input
        ref={ref}
        type="text"
        value={value}
        disabled={disabled}
        maxLength={maxLength}
        autoComplete="off"
        spellCheck={false}
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={open ? `${listboxId}-opt-${activeIndex}` : undefined}
        placeholder={activeGhost ? undefined : placeholder}
        onChange={(e) => {
          setDismissed(false);
          setActiveIndex(0);
          onChange(clampValue(e.target.value));
        }}
        onFocus={() => {
          setFocused(true);
          setDismissed(false);
        }}
        onBlur={() => setFocused(false)}
        onKeyDown={handleKeyDown}
        className={cn(
          'relative w-full flex-1 bg-transparent text-content outline-none',
          'placeholder:text-content-tertiary',
          fieldSize[size],
          inputClassName
        )}
      />

      {open &&
        rect &&
        createPortal(
          <div
            id={listboxId}
            role="listbox"
            className="fixed z-50 max-h-72 overflow-y-auto rounded-lg border border-stroke bg-surface-elevated py-1 shadow-xl scrollbar-thin"
            style={{ top: rect.top, left: rect.left, width: rect.width }}
          >
            {options.map((option, index) => {
              const active = index === activeIndex;
              return (
                // eslint-disable-next-line jsx-a11y/click-events-have-key-events -- listbox option; keyboard handled on the combobox input (Arrow/Enter), options aren't individually focusable
                <div
                  key={`${option.value}-${index}`}
                  id={`${listboxId}-opt-${index}`}
                  role="option"
                  aria-selected={active}
                  tabIndex={-1}
                  // Prevent the input blur that would close the list before click lands.
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => commit(option.value, false, option)}
                  className={cn(
                    'flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-left text-sm',
                    active ? 'bg-surface-hover text-content' : 'text-content-secondary'
                  )}
                >
                  {renderOption ? (
                    renderOption(option, { active })
                  ) : (
                    <>
                      <span className="truncate">{option.label ?? option.value}</span>
                      {option.hint && (
                        <span className="flex-shrink-0 text-xs text-content-tertiary">
                          {option.hint}
                        </span>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>,
          document.body
        )}
    </div>
  );
});

/**
 * For prose that earns its words but not permanent panel height. Only
 * evergreen explanations belong here: state-dependent messages (blocked
 * reasons, warnings) must stay visible inline, or the state they report
 * becomes invisible.
 *
 * The explanation renders in a portal, far from the dot in the document, so
 * opening it moves focus there for a keyboard or screen-reader user, and
 * closing it hands focus back. Tabbing out of it closes it from the dot, so
 * the browser carries on from the dot's place in the sidebar rather than from
 * the end of the document.
 *
 * With `hoverDelayMs`, a resting mouse also opens it, without moving focus:
 * it closes again once the pointer has left both the dot and the panel. A
 * click on the dot or inside the panel pins it open the same way a dot
 * without hover opens.
 */

import { useEffect, useId, useRef, useState } from 'react';
import type { PointerEvent, ReactNode } from 'react';
import { IconButton, Popover } from '@/design-system';
import { InfoIcon } from '@/design-system/Icon';

const TABBABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex="0"]';

/** Long enough to cross the gap between the dot and its panel. */
const HOVER_CLOSE_GRACE_MS = 150;

const DEFAULT_PANEL =
  'max-h-[min(70vh,28rem)] max-w-[260px] overflow-y-auto p-3 text-xs leading-relaxed text-content-secondary';

interface InfoDotProps {
  readonly 'aria-label': string;
  readonly children: ReactNode;
  /** Glyph in place of the info icon. */
  readonly icon?: ReactNode;
  /** Opens after the mouse rests on the dot this long. */
  readonly hoverDelayMs?: number;
  /** Replaces the panel's default text sizing. */
  readonly panelClassName?: string;
}

export function InfoDot({
  'aria-label': ariaLabel,
  children,
  icon,
  hoverDelayMs,
  panelClassName = DEFAULT_PANEL,
}: InfoDotProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentId = useId();
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);

  const clearHoverTimer = (): void => {
    if (hoverTimer.current !== null) clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
  };
  useEffect(() => clearHoverTimer, []);

  const close = (): void => {
    clearHoverTimer();
    setOpen(false);
    setPinned(false);
    // Focus only moved into the panel if a click pinned it.
    if (pinned) buttonRef.current?.focus();
  };

  useEffect(() => {
    const content = contentRef.current;
    if (!open || !pinned || !content) return;
    content.focus();
    // Runs before the browser's own Tab move, which then starts from the dot.
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Tab') return;
      const tabbable = content.querySelectorAll<HTMLElement>(TABBABLE);
      const active = document.activeElement;
      const leaving =
        tabbable.length === 0 ||
        (event.shiftKey
          ? active === tabbable[0] || active === content
          : active === tabbable[tabbable.length - 1]);
      if (leaving) {
        setOpen(false);
        setPinned(false);
        buttonRef.current?.focus();
      }
    };
    content.addEventListener('keydown', onKeyDown);
    return () => content.removeEventListener('keydown', onKeyDown);
  }, [open, pinned]);

  const hover = hoverDelayMs !== undefined;
  const isMouse = (event: PointerEvent): boolean => hover && event.pointerType === 'mouse';
  const scheduleHoverClose = (): void => {
    clearHoverTimer();
    if (pinned) return;
    hoverTimer.current = setTimeout(() => setOpen(false), HOVER_CLOSE_GRACE_MS);
  };

  return (
    <>
      <IconButton
        ref={buttonRef}
        type="button"
        variant="ghost"
        size="sm"
        touchTarget={false}
        onClick={() => {
          clearHoverTimer();
          if (open && pinned) {
            close();
            return;
          }
          setOpen(true);
          setPinned(true);
        }}
        onPointerEnter={(event) => {
          if (!isMouse(event)) return;
          clearHoverTimer();
          if (!open) hoverTimer.current = setTimeout(() => setOpen(true), hoverDelayMs);
        }}
        onPointerLeave={(event) => {
          if (isMouse(event)) scheduleHoverClose();
        }}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={open ? contentId : undefined}
        // A 24px hit area around the 16px glyph: the dot sits inline in text,
        // where a full touch target would push the line apart.
        className="relative h-4 w-4 rounded-full text-content-tertiary before:absolute before:-inset-1 before:content-[''] hover:bg-transparent hover:text-content-secondary"
      >
        {icon ?? <InfoIcon size="xs" />}
      </IconButton>
      <Popover
        anchorRef={buttonRef}
        isOpen={open}
        onClose={close}
        placement="bottom-start"
        aria-label={ariaLabel}
        className={panelClassName}
        onPointerEnter={(event) => {
          if (isMouse(event)) clearHoverTimer();
        }}
        onPointerLeave={(event) => {
          if (isMouse(event)) scheduleHoverClose();
        }}
      >
        <div
          id={contentId}
          ref={contentRef}
          tabIndex={-1}
          className="outline-none"
          // Using a control in a hover-opened panel commits to it, so pointer-out
          // must no longer close it under the user.
          onPointerDown={() => {
            clearHoverTimer();
            setPinned(true);
          }}
        >
          {children}
        </div>
      </Popover>
    </>
  );
}

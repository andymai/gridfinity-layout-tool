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
 */

import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { IconButton, Popover } from '@/design-system';
import { InfoIcon } from '@/design-system/Icon';

const TABBABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex="0"]';

interface InfoDotProps {
  readonly 'aria-label': string;
  readonly children: ReactNode;
}

export function InfoDot({ 'aria-label': ariaLabel, children }: InfoDotProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const contentId = useId();
  const [open, setOpen] = useState(false);

  const close = (): void => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  useEffect(() => {
    const content = contentRef.current;
    if (!open || !content) return;
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
        buttonRef.current?.focus();
      }
    };
    content.addEventListener('keydown', onKeyDown);
    return () => content.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <>
      <IconButton
        ref={buttonRef}
        type="button"
        variant="ghost"
        size="sm"
        touchTarget={false}
        onClick={() => setOpen((prev) => !prev)}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={open ? contentId : undefined}
        // A 24px hit area around the 16px glyph: the dot sits inline in text,
        // where a full touch target would push the line apart.
        className="relative h-4 w-4 rounded-full text-content-tertiary before:absolute before:-inset-1 before:content-[''] hover:bg-transparent hover:text-content-secondary"
      >
        <InfoIcon size="xs" />
      </IconButton>
      <Popover
        anchorRef={buttonRef}
        isOpen={open}
        onClose={close}
        placement="bottom-start"
        aria-label={ariaLabel}
        className="max-h-[min(70vh,28rem)] max-w-[260px] overflow-y-auto p-3 text-xs leading-relaxed text-content-secondary"
      >
        <div id={contentId} ref={contentRef} tabIndex={-1} className="outline-none">
          {children}
        </div>
      </Popover>
    </>
  );
}

/**
 * For prose that earns its words but not permanent panel height. Only
 * evergreen explanations belong here: state-dependent messages (blocked
 * reasons, warnings) must stay visible inline, or the state they report
 * becomes invisible.
 *
 * The explanation renders in a portal, far from the dot in the document, so
 * opening it moves focus there for a keyboard or screen-reader user, and
 * closing it hands focus back.
 */

import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { IconButton, Popover } from '@/design-system';
import { InfoIcon } from '@/design-system/Icon';

interface InfoDotProps {
  readonly 'aria-label': string;
  readonly children: ReactNode;
}

export function InfoDot({ 'aria-label': ariaLabel, children }: InfoDotProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const contentId = useId();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) contentRef.current?.focus();
  }, [open]);

  const close = (): void => {
    setOpen(false);
    buttonRef.current?.focus();
  };

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
        className="h-4 w-4 rounded-full text-content-tertiary hover:bg-transparent hover:text-content-secondary"
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

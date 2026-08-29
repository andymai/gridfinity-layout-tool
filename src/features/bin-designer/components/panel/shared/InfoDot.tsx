/**
 * For prose that earns its words but not permanent panel height. Only
 * evergreen explanations belong here: state-dependent messages (blocked
 * reasons, warnings) must stay visible inline, or the state they report
 * becomes invisible.
 */

import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { IconButton, Popover } from '@/design-system';
import { InfoIcon } from '@/design-system/Icon';

interface InfoDotProps {
  readonly 'aria-label': string;
  readonly children: ReactNode;
}

export function InfoDot({ 'aria-label': ariaLabel, children }: InfoDotProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
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
        className="h-4 w-4 rounded-full text-content-tertiary hover:bg-transparent hover:text-content-secondary"
      >
        <InfoIcon size="xs" />
      </IconButton>
      <Popover
        anchorRef={buttonRef}
        isOpen={open}
        onClose={() => setOpen(false)}
        placement="bottom-start"
        className="max-w-[260px] p-3 text-xs leading-relaxed text-content-secondary"
      >
        {children}
      </Popover>
    </>
  );
}

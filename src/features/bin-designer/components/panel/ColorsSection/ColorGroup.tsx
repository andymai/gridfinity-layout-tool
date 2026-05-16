/**
 * Collapsible group header for grouping color zones (Exterior / Interior
 * / Add-ons). Hides itself when there are no children — empty groups
 * don't earn space on the panel.
 */

import { useState, type ReactNode } from 'react';
import { ChevronDownIcon } from '@/design-system/Icon';

interface ColorGroupProps {
  title: string;
  defaultOpen?: boolean;
  /** When false, the group renders nothing at all. */
  visible?: boolean;
  children: ReactNode;
}

export function ColorGroup({
  title,
  defaultOpen = true,
  visible = true,
  children,
}: ColorGroupProps) {
  const [open, setOpen] = useState(defaultOpen);
  if (!visible) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-[10px] font-medium uppercase tracking-wide text-content-tertiary py-1 -mx-1 px-1 rounded hover:bg-surface-hover transition-colors"
        aria-expanded={open}
      >
        <span>{title}</span>
        <ChevronDownIcon size="sm" className={`transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && <div className="space-y-0.5 pt-1">{children}</div>}
    </div>
  );
}

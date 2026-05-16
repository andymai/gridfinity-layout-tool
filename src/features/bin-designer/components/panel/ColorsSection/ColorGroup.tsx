/**
 * Renders nothing when `visible` is false. The caller computes `visible`
 * from whether any zones are active, so an "empty" group (i.e. the
 * caller would only render zero children) never reaches the DOM.
 */

import { useId, useState, type ReactNode } from 'react';
import { ChevronDownIcon } from '@/design-system/Icon';

interface ColorGroupProps {
  title: string;
  defaultOpen?: boolean;
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
  const regionId = useId();
  if (!visible) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-[10px] font-medium uppercase tracking-wide text-content-tertiary py-1 -mx-1 px-1 rounded hover:bg-surface-hover transition-colors"
        aria-expanded={open}
        aria-controls={regionId}
      >
        <span>{title}</span>
        <ChevronDownIcon size="sm" className={`transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && (
        <div id={regionId} className="space-y-0.5 pt-1">
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * Renders nothing when `visible` is false. The caller computes `visible`
 * from whether any zones are active, so an "empty" group (i.e. the
 * caller would only render zero children) never reaches the DOM.
 *
 * Auto-opens when `growthTick` increments — used to reveal a previously-
 * empty group when its corresponding feature gets enabled, so a newly-
 * active zone isn't trapped behind a stale collapsed header.
 */

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ChevronDownIcon } from '@/design-system/Icon';

interface ColorGroupProps {
  title: string;
  defaultOpen?: boolean;
  visible?: boolean;
  /**
   * Increments every time the set of visible zones inside this group
   * grows. The group auto-opens on each increment so a newly-active
   * zone is never trapped behind a stale collapsed header.
   */
  growthTick?: number;
  children: ReactNode;
}

export function ColorGroup({
  title,
  defaultOpen = true,
  visible = true,
  growthTick = 0,
  children,
}: ColorGroupProps) {
  const [open, setOpen] = useState(defaultOpen);
  const regionId = useId();
  const prevTickRef = useRef(growthTick);

  useEffect(() => {
    if (growthTick !== prevTickRef.current) {
      setOpen(true);
      prevTickRef.current = growthTick;
    }
  }, [growthTick]);

  if (!visible) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-content-secondary py-1 -mx-1 px-1 rounded hover:bg-surface-hover transition-colors"
        aria-expanded={open}
        aria-controls={regionId}
      >
        <span>{title}</span>
        <ChevronDownIcon size="sm" className={`transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>
      <div
        id={regionId}
        className={`grid transition-[grid-template-rows] duration-150 ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
      >
        <div className="overflow-hidden">
          <div className="space-y-0.5 pt-1">{children}</div>
        </div>
      </div>
    </div>
  );
}

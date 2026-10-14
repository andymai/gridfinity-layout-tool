/**
 * Renders nothing when `visible` is false. The caller computes `visible`
 * from whether any zones are active, so an "empty" group (i.e. the
 * caller would only render zero children) never reaches the DOM.
 *
 * Auto-opens when `growthTick` increments — used to reveal a previously-
 * empty group when its corresponding feature gets enabled, so a newly-
 * active zone isn't trapped behind a stale collapsed header.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { MoreDisclosure } from '@/shared/components/MoreDisclosure';

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
  const prevTickRef = useRef(growthTick);

  useEffect(() => {
    if (growthTick !== prevTickRef.current) {
      setOpen(true);
      prevTickRef.current = growthTick;
    }
  }, [growthTick]);

  if (!visible) return null;

  return (
    <MoreDisclosure label={title} open={open} onOpenChange={setOpen}>
      <div className="space-y-0.5">{children}</div>
    </MoreDisclosure>
  );
}

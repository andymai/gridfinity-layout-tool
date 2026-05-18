/**
 * Marks a DOM region as the deep-link destination for a help entry.
 *
 * `helpJumpDispatcher` finds `[data-help-target="<id>"]` via querySelector
 * after firing the surface-open event, then applies the pulse animation
 * directly to this element (so it must be a real box, not `display: contents`).
 *
 * Use at the use site of the control, not inside shared components.
 */

import type { ReactNode } from 'react';
import { HELP_TARGET_ATTR } from '@/shared/help/helpJumpDispatcher';

interface HelpTargetMarkerProps {
  id: string;
  children: ReactNode;
  className?: string;
}

export function HelpTargetMarker({ id, children, className }: HelpTargetMarkerProps) {
  const dataAttr: Record<string, string> = { [HELP_TARGET_ATTR]: id };
  return (
    <div {...dataAttr} className={className}>
      {children}
    </div>
  );
}

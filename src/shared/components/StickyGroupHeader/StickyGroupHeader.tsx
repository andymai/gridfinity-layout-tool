/**
 * Collapsible group header with sticky positioning.
 *
 * Shows a title bar that sticks to the top of its scroll container.
 * Clicking it collapses/expands the children with a smooth transition.
 * An optional summary string is rendered inline in the header row; it is
 * always visible (dimmer when expanded, full color when collapsed) so users
 * retain quick-glance context regardless of state.
 */

import { useState, useId, type ReactNode } from 'react';
import { ChevronDownIcon } from '@/design-system/Icon';

interface StickyGroupHeaderBaseProps {
  title: string;
  defaultExpanded?: boolean;
  summary?: string;
  /** Optional short label rendered as a pill next to the title (e.g. "Experimental").
   *  Typed as `string` so the badge can't accidentally hold an interactive element
   *  inside the collapse `<button>`. */
  badge?: string;
  children: ReactNode;
}

// Discriminated union: providing `expanded` requires `onExpandedChange` so the
// header can't silently freeze. Either go fully controlled or fully uncontrolled.
type StickyGroupHeaderProps = StickyGroupHeaderBaseProps &
  (
    | { expanded?: undefined; onExpandedChange?: undefined }
    | { expanded: boolean; onExpandedChange: (next: boolean) => void }
  );

export function StickyGroupHeader({
  title,
  defaultExpanded = true,
  expanded: controlledExpanded,
  onExpandedChange,
  summary,
  badge,
  children,
}: StickyGroupHeaderProps) {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const isControlled = controlledExpanded !== undefined;
  const expanded = isControlled ? controlledExpanded : internalExpanded;
  const setExpanded = (next: boolean) => {
    if (!isControlled) setInternalExpanded(next);
    onExpandedChange?.(next);
  };
  const [hasToggled, setHasToggled] = useState(false);
  const contentId = useId();

  return (
    <div className="border-b border-stroke-subtle">
      <button
        type="button"
        className="sticky top-0 z-10 flex w-full items-center gap-2 backdrop-blur-sm bg-surface-secondary/90 border-b border-stroke-subtle/50 px-4 py-3 hover:bg-surface-hover/50 transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
        onClick={() => {
          setHasToggled(true);
          setExpanded(!expanded);
        }}
        aria-expanded={expanded}
        aria-controls={contentId}
      >
        <ChevronDownIcon
          className={`transition-transform duration-200 text-content-tertiary ${expanded ? 'rotate-0' : '-rotate-90'}`}
          size="xs"
        />
        <span className="text-[11px] font-bold text-content-tertiary uppercase tracking-widest">
          {title}
        </span>
        {badge && (
          <span className="inline-flex items-center rounded bg-info-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-info">
            {badge}
          </span>
        )}
        {summary && (
          <span
            className={`ml-auto min-w-0 truncate text-xs tabular-nums transition-colors ${
              expanded ? 'text-content-tertiary/70' : 'text-content-tertiary'
            }`}
          >
            {summary}
          </span>
        )}
      </button>

      <div
        id={contentId}
        role="region"
        aria-label={title}
        aria-hidden={!expanded}
        inert={!expanded ? true : undefined}
        className={`grid ${hasToggled ? 'transition-[grid-template-rows,opacity] duration-200' : ''} ${
          expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">{children}</div>
      </div>
    </div>
  );
}

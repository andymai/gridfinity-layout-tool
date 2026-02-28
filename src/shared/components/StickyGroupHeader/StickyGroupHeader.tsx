/**
 * Collapsible group header with sticky positioning.
 *
 * Shows a title bar that sticks to the top of its scroll container.
 * Clicking it collapses/expands the children with a smooth transition.
 * An optional summary string is shown when collapsed.
 */

import { useState, useId, type ReactNode } from 'react';
import { ChevronDownIcon } from '@/design-system/Icon';

interface StickyGroupHeaderProps {
  title: string;
  defaultExpanded?: boolean;
  summary?: string;
  children: ReactNode;
}

export function StickyGroupHeader({
  title,
  defaultExpanded = true,
  summary,
  children,
}: StickyGroupHeaderProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
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
      </button>

      {summary && !expanded && (
        <div className="px-4 pb-3 -mt-1 text-xs text-content-tertiary truncate">{summary}</div>
      )}

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

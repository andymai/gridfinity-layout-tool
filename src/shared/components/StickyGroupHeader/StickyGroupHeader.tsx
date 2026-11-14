/**
 * Collapsible group header with sticky positioning.
 *
 * Shows a title bar that sticks to the top of its scroll container.
 * Clicking it collapses/expands the children with a smooth transition.
 * An optional summary string is rendered inline in the header row; it is
 * always visible (dimmer when expanded, full color when collapsed) so users
 * retain quick-glance context regardless of state.
 */

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/design-system';
import { cn } from '@/design-system/cn';
import { ChevronDownIcon } from '@/design-system/Icon';

/**
 * `band` is for a panel whose groups hold their own small-caps sub-headers:
 * the default header is set in that same style, so with several groups open
 * the two levels read alike and a group's end is hard to find.
 */
export type StickyGroupHeaderVariant = 'default' | 'band';

// A band's top rule pulls up one pixel onto the edge above it, so a stack of
// collapsed bands shows a single line between each, not the bar's bottom
// border and the next rule side by side.
const ROOT_CLASS: Record<StickyGroupHeaderVariant, string> = {
  default: 'border-b border-stroke-subtle',
  band: '-mt-px border-t border-stroke',
};

const BAR_CLASS: Record<StickyGroupHeaderVariant, string> = {
  default: 'backdrop-blur-sm bg-surface-secondary/90 border-b border-stroke-subtle/50',
  band: 'bg-surface-secondary',
};

// Extra space under a band's last row marks where a long group ends. It sits
// inside the collapsing row's child, since padding on that child would stay
// visible when the row folds to zero.
const BODY_CLASS: Record<StickyGroupHeaderVariant, string | undefined> = {
  default: undefined,
  band: 'pb-[calc(var(--space-panel)*0.5)]',
};

function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let node = el.parentElement; node; node = node.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(node).overflowY)) return node;
  }
  return null;
}

// A band sits on the panel's own surface, so once it sticks over scrolled
// content it needs an edge. A marker at the top of the group leaves the scroll
// area exactly when the bar sticks.
function useStuck(enabled: boolean) {
  const markerRef = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const marker = markerRef.current;
    if (!enabled || !marker || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const rootTop = entry.rootBounds?.top ?? 0;
        setStuck(!entry.isIntersecting && entry.boundingClientRect.top < rootTop);
      },
      { root: scrollParent(marker) }
    );
    observer.observe(marker);
    return () => observer.disconnect();
  }, [enabled]);
  return { markerRef, stuck };
}

const BUTTON_CLASS: Record<StickyGroupHeaderVariant, string> = {
  default: 'px-(--space-panel) py-[calc(var(--space-panel)*0.75)] hover:bg-surface-hover/50',
  band: 'px-(--space-panel) py-[calc(var(--space-panel)*0.625)] hover:bg-surface-hover',
};

const TITLE_CLASS: Record<StickyGroupHeaderVariant, string> = {
  default: 'text-label font-bold text-content-tertiary uppercase tracking-widest',
  band: 'text-title text-content',
};

interface StickyGroupHeaderBaseProps {
  title: string;
  defaultExpanded?: boolean;
  summary?: string;
  /** Optional short label rendered as a pill next to the title (e.g. "Experimental").
   *  Typed as `string` so the badge can't accidentally hold an interactive element
   *  inside the collapse `<Button>`. */
  badge?: string;
  /** Accessible name for the "changed from defaults" dot. Setting it shows the
   *  dot; there is no separate boolean, so the mark cannot exist unlabelled:
   *  the dot itself is aria-hidden and would otherwise be visual-only. */
  modifiedLabel?: string;
  variant?: StickyGroupHeaderVariant;
  /** Buttons for the group (add, sort, manage), beside the header rather than inside its toggle. */
  actions?: ReactNode;
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
  modifiedLabel,
  variant = 'default',
  actions,
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
  const { markerRef, stuck } = useStuck(variant === 'band');

  return (
    <div className={ROOT_CLASS[variant]} data-variant={variant}>
      {variant === 'band' && <div ref={markerRef} aria-hidden="true" />}
      <div
        data-stuck={stuck || undefined}
        className={cn(
          'sticky top-0 z-10 flex items-center',
          BAR_CLASS[variant],
          stuck && 'shadow-[0_1px_0_0_var(--color-stroke-subtle)]'
        )}
      >
        {/* The accordion pattern: the toggle sits inside a heading, so each group
            is a stop in a screen reader's heading navigation. */}
        <h2 className="flex min-w-0 flex-1">
          <Button
            type="button"
            variant="ghost"
            touchTarget={false}
            className={cn(
              'flex min-w-0 flex-1 items-center justify-start gap-2 rounded-none transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset',
              BUTTON_CLASS[variant]
            )}
            onClick={() => {
              setHasToggled(true);
              setExpanded(!expanded);
            }}
            aria-expanded={expanded}
            aria-controls={contentId}
          >
            <ChevronDownIcon
              className={cn(
                'transition-transform duration-200',
                variant === 'band' ? 'text-content-secondary' : 'text-content-tertiary',
                expanded ? 'rotate-0' : '-rotate-90'
              )}
              size={variant === 'band' ? 'sm' : 'xs'}
            />
            <span className={TITLE_CLASS[variant]}>{title}</span>
            {modifiedLabel && (
              <>
                {/* `title` as well as the sr-only text: a bare dot is unexplained
                for anyone who can see it, and "changed" reads as "unsaved"
                without the wording to correct it. */}
                <span
                  title={modifiedLabel}
                  aria-hidden="true"
                  data-testid="group-modified-dot"
                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                />
                <span className="sr-only">{modifiedLabel}</span>
              </>
            )}
            {badge && (
              <span className="inline-flex items-center rounded bg-info-muted px-1.5 py-0.5 text-micro font-semibold uppercase tracking-wide text-info">
                {badge}
              </span>
            )}
            {summary && (
              <span
                className={`ml-auto min-w-0 truncate text-xs font-normal tabular-nums transition-colors ${
                  expanded ? 'text-content-tertiary/70' : 'text-content-tertiary'
                }`}
              >
                {summary}
              </span>
            )}
          </Button>
        </h2>
        {actions && (
          <div className="flex shrink-0 items-center gap-0.5 pr-[calc(var(--space-panel)-0.25rem)]">
            {actions}
          </div>
        )}
      </div>

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
        <div className="overflow-hidden">
          {BODY_CLASS[variant] ? <div className={BODY_CLASS[variant]}>{children}</div> : children}
        </div>
      </div>
    </div>
  );
}

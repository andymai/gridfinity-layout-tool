/**
 * Selectable card for a one-of-N choice, expanding inline to hold the selected
 * option's own controls.
 *
 * Used wherever a panel choice is consequential enough that the options need
 * explaining rather than just labelling: the interior mode and the base's body
 * type. A `SegmentedControl` is the right primitive when the labels speak for
 * themselves; this one buys room for an icon and a description at the cost of
 * vertical space.
 */

import type { ReactNode } from 'react';
import { Button } from '@/design-system';

interface ModeCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
  /** Rendered beside the title: an "Experimental" pill and the like. */
  badge?: ReactNode;
  /** Controls for this option, rendered below the header while selected. */
  children?: ReactNode;
}

export function ModeCard({
  icon,
  title,
  description,
  selected,
  onSelect,
  badge,
  children,
}: ModeCardProps) {
  return (
    <div
      className={`
        w-full rounded-lg border p-3
        transition-all duration-200 ease-in-out
        ${
          selected
            ? 'border-accent bg-accent/5'
            : 'border-stroke-subtle bg-surface-elevated hover:bg-surface-hover'
        }
      `}
    >
      {/* Header. Only this element is the interactive control. `aria-pressed`
          rather than a radio role: the cards stay plain buttons, but selection
          stops being conveyed by colour alone. */}
      <Button
        type="button"
        variant="ghost"
        aria-pressed={selected}
        onClick={onSelect}
        className="flex h-auto w-full cursor-pointer items-start justify-start gap-3 bg-transparent p-0 text-left font-normal hover:bg-transparent"
      >
        <div className="mt-0.5">{icon}</div>
        <div className="flex-1 min-w-0">
          {/* flex-wrap, not a nowrap row: the badge sits beside the title at
              normal panel widths and drops to its own line on a narrow one,
              rather than squeezing the heading into an ellipsis. */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-sm font-medium text-content-primary">{title}</span>
            {badge}
          </div>
          <p className="text-xs text-content-secondary mt-0.5">{description}</p>
        </div>
      </Button>

      {/* Content, outside the button so interactive controls are valid HTML */}
      {selected && children && (
        <div className="mt-3 pt-3 border-t border-stroke-subtle">{children}</div>
      )}
    </div>
  );
}

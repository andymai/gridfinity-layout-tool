import type { ReactNode } from 'react';
import { CheckIcon, cn } from '@/design-system';

interface SelectableCardProps {
  selected: boolean;
  onSelect: () => void;
  /** Primary label. */
  label: string;
  /** Secondary muted text shown next to/under the label. */
  description?: string;
  /** Optional visual preview rendered above the label (e.g. theme mock). */
  preview?: ReactNode;
  /** Tighter padding for dense lists without previews (e.g. the language list). */
  compact?: boolean;
  /** Accessible name; defaults to `label`. */
  'aria-label'?: string;
  className?: string;
}

/**
 * A radio-style selectable card. Used for Appearance previews (theme, accent,
 * density) and language selection. Renders as `role="radio"`; wrap a group in
 * an element with `role="radiogroup"`.
 */
export function SelectableCard({
  selected,
  onSelect,
  label,
  description,
  preview,
  compact = false,
  'aria-label': ariaLabel,
  className,
}: SelectableCardProps) {
  return (
    <div
      role="radio"
      aria-checked={selected}
      aria-label={ariaLabel ?? label}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        'group flex cursor-pointer flex-col gap-2 rounded-lg border text-left transition-colors',
        compact ? 'px-3 py-1.5' : 'p-2.5',
        'outline-none focus-visible:ring-2 focus-visible:ring-accent',
        selected
          ? 'border-accent bg-surface-elevated'
          : 'border-stroke-subtle hover:border-stroke-strong hover:bg-surface-hover',
        className
      )}
    >
      {preview && <div className="pointer-events-none">{preview}</div>}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <span className={cn('text-sm', selected ? 'text-content' : 'text-content-secondary')}>
            {label}
          </span>
          {description && <span className="ml-2 text-xs text-content-disabled">{description}</span>}
        </div>
        {selected && <CheckIcon size="sm" className="flex-shrink-0 text-accent" />}
      </div>
    </div>
  );
}

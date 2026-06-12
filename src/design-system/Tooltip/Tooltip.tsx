import { cloneElement, isValidElement, useId, useState } from 'react';
import type { KeyboardEvent, ReactElement, ReactNode } from 'react';
import { cn } from '../cn';
import { interactiveTransition } from '../variants';

type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right';

function mergeDescribedBy(existing: string | undefined, id: string): string {
  return existing ? `${existing} ${id}` : id;
}

const placementClasses: Record<TooltipPlacement, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-1.5',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-1.5',
  left: 'right-full top-1/2 -translate-y-1/2 mr-1.5',
  right: 'left-full top-1/2 -translate-y-1/2 ml-1.5',
};

export interface TooltipProps {
  /**
   * Tooltip text. Plain string only.
   */
  content: string;
  /**
   * Optional keyboard-shortcut suffix rendered in mono kbd styling after the content.
   */
  shortcut?: string;
  /**
   * Side of the trigger the bubble appears on.
   * @default 'top'
   */
  placement?: TooltipPlacement;
  /**
   * Delay before the bubble fades in, in milliseconds.
   * @default 300
   */
  delayMs?: number;
  /**
   * Render children without a tooltip (for conditional tooltips).
   * @default false
   */
  disabled?: boolean;
  /**
   * Trigger element(s) the tooltip describes.
   */
  children: ReactNode;
}

/**
 * Accessible replacement for native `title=` attributes.
 *
 * Shows on hover and keyboard focus, hides on Escape, and is announced by
 * screen readers via `role="tooltip"` + `aria-describedby`. Hidden entirely
 * on touch-only devices. Wraps the trigger in a span so it also works on
 * disabled buttons.
 *
 * @example
 * <Tooltip content="Undo" shortcut="⌘Z">
 *   <IconButton aria-label="Undo" icon={<UndoIcon />} />
 * </Tooltip>
 *
 * @example
 * // Vertical toolbar
 * <Tooltip content="Rectangle" shortcut="R" placement="right">
 *   <Button>...</Button>
 * </Tooltip>
 *
 * @example
 * // Conditional tooltip
 * <Tooltip content="Switch to draw tool" disabled={isActive}>
 *   <Button>Draw</Button>
 * </Tooltip>
 */
export function Tooltip({
  content,
  shortcut,
  placement = 'top',
  delayMs = 300,
  disabled = false,
  children,
}: TooltipProps): ReactNode {
  const id = useId();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (disabled) {
    return <>{children}</>;
  }

  const visible = (hovered || focused) && !dismissed;

  const handleKeyDown = (e: KeyboardEvent<HTMLSpanElement>): void => {
    if (e.key === 'Escape') {
      setDismissed(true);
    }
  };

  // Screen readers compute descriptions from the focused trigger element, not
  // ancestors, so aria-describedby must live on the child itself.
  const canAnnotateChild = isValidElement(children);
  const trigger = canAnnotateChild
    ? cloneElement(children as ReactElement<{ 'aria-describedby'?: string }>, {
        'aria-describedby': mergeDescribedBy(
          (children as ReactElement<{ 'aria-describedby'?: string }>).props['aria-describedby'],
          id
        ),
      })
    : children;

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- listeners only toggle tooltip visibility; the interactive child keeps its own semantics
    <span
      className="relative inline-flex"
      aria-describedby={canAnnotateChild ? undefined : id}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setDismissed(false);
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        setDismissed(false);
      }}
      onKeyDown={handleKeyDown}
    >
      {trigger}
      <span
        role="tooltip"
        id={id}
        className={cn(
          'pointer-events-none absolute z-50 whitespace-nowrap',
          'rounded-md border border-stroke-subtle bg-surface-elevated shadow-lg',
          'px-2 py-1 text-xs text-content',
          interactiveTransition,
          placementClasses[placement],
          // opacity-only hiding keeps the description in the accessibility
          // tree (visibility:hidden would remove it).
          visible ? 'opacity-100' : 'opacity-0',
          '[@media(hover:none)]:hidden'
        )}
        style={{ transitionDelay: visible ? `${delayMs}ms` : '0ms' }}
      >
        {content}
        {shortcut !== undefined && (
          <kbd className="ml-1.5 font-mono text-content-tertiary">{shortcut}</kbd>
        )}
      </span>
    </span>
  );
}

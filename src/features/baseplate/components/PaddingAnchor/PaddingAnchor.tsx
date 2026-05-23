import { useCallback, useRef, type KeyboardEvent } from 'react';
import { cn } from '@/design-system/cn';
import { AlertTriangleIcon } from '@/design-system/Icon';
import { focusRing, interactiveTransition } from '@/design-system/variants';
import { useTranslation } from '@/i18n';
import type { PaddingAnchor as PaddingAnchorValue } from '@/core/types';

type ConcreteAnchor = Exclude<PaddingAnchorValue, 'custom'>;

interface PaddingAnchorProps {
  readonly value: PaddingAnchorValue;
  readonly onChange: (anchor: ConcreteAnchor) => void;
  readonly showClampWarning?: boolean;
  readonly disabled?: boolean;
  readonly className?: string;
}

const ANCHORS: readonly ConcreteAnchor[] = ['tl', 'tc', 'tr', 'ml', 'c', 'mr', 'bl', 'bc', 'br'];

const ARROW_DELTAS: Record<string, readonly [number, number] | undefined> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

function clampToGrid(v: number): number {
  return Math.max(0, Math.min(2, v));
}

function neighbour(current: ConcreteAnchor, dx: number, dy: number): ConcreteAnchor {
  const i = ANCHORS.indexOf(current);
  const nextRow = clampToGrid(Math.floor(i / 3) + dy);
  const nextCol = clampToGrid((i % 3) + dx);
  return ANCHORS[nextRow * 3 + nextCol];
}

// Roving tabindex: only one button in the radiogroup is in the tab order.
// When custom (no selection), the first dot becomes the entry point.
const FIRST_ANCHOR: ConcreteAnchor = 'tl';
function rovingTabIndex(anchor: ConcreteAnchor, value: PaddingAnchorValue): 0 | -1 {
  if (value === 'custom') return anchor === FIRST_ANCHOR ? 0 : -1;
  return anchor === value ? 0 : -1;
}

export function PaddingAnchor({
  value,
  onChange,
  showClampWarning,
  disabled,
  className,
}: PaddingAnchorProps) {
  const t = useTranslation();
  const buttonRefs = useRef<Map<ConcreteAnchor, HTMLButtonElement>>(new Map());

  const handleKeyDown = useCallback(
    (current: ConcreteAnchor, e: KeyboardEvent<HTMLButtonElement>) => {
      const delta = ARROW_DELTAS[e.key];
      if (!delta) return;
      e.preventDefault();
      const next = neighbour(current, delta[0], delta[1]);
      if (next === current) return;
      onChange(next);
      buttonRefs.current.get(next)?.focus();
    },
    [onChange]
  );

  return (
    <div
      role="radiogroup"
      aria-label={t('baseplate.paddingAnchor.label')}
      className={cn(
        'relative grid h-full w-full grid-cols-3 grid-rows-3 place-items-center gap-1 px-2 py-1.5',
        className
      )}
    >
      {ANCHORS.map((anchor) => {
        const selected = value === anchor;
        return (
          <button
            key={anchor}
            ref={(el) => {
              if (el) buttonRefs.current.set(anchor, el);
              else buttonRefs.current.delete(anchor);
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={t(`baseplate.paddingAnchor.${anchor}`)}
            tabIndex={rovingTabIndex(anchor, value)}
            disabled={disabled}
            onClick={() => onChange(anchor)}
            onKeyDown={(e) => handleKeyDown(anchor, e)}
            className={cn(
              'flex h-3.5 w-3.5 items-center justify-center rounded-full border',
              selected
                ? 'border-content bg-content'
                : 'border-stroke-subtle bg-surface-elevated hover:border-content-secondary hover:bg-surface-hover',
              'disabled:cursor-not-allowed disabled:opacity-50',
              interactiveTransition,
              ...focusRing
            )}
          />
        );
      })}
      {showClampWarning && (
        <span
          aria-label={t('baseplate.paddingAnchor.clampedWarning')}
          title={t('baseplate.paddingAnchor.clampedWarning')}
          className="absolute right-0.5 top-0.5 inline-flex h-3.5 w-3.5 items-center justify-center text-warning"
        >
          <AlertTriangleIcon size="sm" className="h-3.5 w-3.5" />
        </span>
      )}
    </div>
  );
}

import { useCallback, useRef, type KeyboardEvent } from 'react';
import { cn } from '@/design-system/cn';
import { AlertTriangleIcon, ArrowLeftIcon } from '@/design-system/Icon';
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

// ArrowLeftIcon points left (west). Rotating it clockwise by these amounts aims
// each cell's arrow at the drawer corner/edge that anchor snaps the baseplate to.
// `null` marks the center cell, which renders a target glyph instead of an arrow.
// Classes are spelled out literally so Tailwind's JIT emits the arbitrary rotations.
const ARROW_ROTATION: Record<ConcreteAnchor, string | null> = {
  tl: 'rotate-45',
  tc: 'rotate-90',
  tr: 'rotate-[135deg]',
  ml: 'rotate-0',
  c: null,
  mr: 'rotate-180',
  bl: 'rotate-[315deg]',
  bc: 'rotate-[270deg]',
  br: 'rotate-[225deg]',
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

function CellGlyph({ anchor }: { readonly anchor: ConcreteAnchor }) {
  const rotation = ARROW_ROTATION[anchor];
  if (rotation === null) {
    return (
      <span className="flex h-2 w-2 items-center justify-center rounded-full border border-current">
        <span className="h-0.5 w-0.5 rounded-full bg-current" />
      </span>
    );
  }
  return <ArrowLeftIcon size="sm" className={cn('h-3 w-3', rotation)} strokeWidth={2.25} />;
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
        const cellLabel = t(`baseplate.paddingAnchor.${anchor}`);
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
            aria-label={cellLabel}
            title={cellLabel}
            tabIndex={rovingTabIndex(anchor, value)}
            disabled={disabled}
            onClick={() => onChange(anchor)}
            onKeyDown={(e) => handleKeyDown(anchor, e)}
            className={cn(
              'flex h-5 w-5 items-center justify-center rounded-md border',
              selected
                ? 'border-content bg-content text-surface'
                : 'border-transparent text-content-tertiary hover:border-stroke-subtle hover:bg-surface-hover hover:text-content-secondary',
              'disabled:cursor-not-allowed disabled:opacity-50',
              interactiveTransition,
              ...focusRing
            )}
          >
            <CellGlyph anchor={anchor} />
          </button>
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

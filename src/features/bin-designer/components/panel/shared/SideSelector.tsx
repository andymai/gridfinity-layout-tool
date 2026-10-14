/**
 * Spatial side selector shared by feature panels (wall cutouts, handles).
 *
 * Lays the four bin walls out in their physical positions around a center bin
 * glyph — Back on top, Front on the bottom, Left and Right flanking — so the
 * control maps directly onto the bin you're editing instead of an abstract row
 * of L/R/F/B letters. Each side is an independent on/off `switch` rendered as a
 * solid button: a filled accent fill when on, a bordered surface chip when off,
 * so every side reads unmistakably as a clickable button. A side can be disabled
 * (e.g. the back handle while a label tab occupies that wall), in which case it
 * reads as off and shows an explanatory tooltip.
 *
 * `mode: 'single'` picks exactly one wall (a hinge, a slide entry): a radio
 * group where the arrow keys choose the wall in that direction.
 */

import { useRef } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { Button } from '@/design-system';

/** The four selectable walls, in their physical screen positions. */
export type Side = 'left' | 'right' | 'front' | 'back';

export interface SideState {
  side: Side;
  label: string;
  active: boolean;
  disabled?: boolean;
  /** Tooltip shown on hover (e.g. why a side is disabled). */
  title?: string;
}

interface MultiSideSelectorProps {
  readonly mode?: 'multi';
  /** All four sides; order is irrelevant — placement is spatial. */
  sides: ReadonlyArray<SideState>;
  onToggle: (side: Side) => void;
  ariaLabel: string;
}

interface SingleSideSelectorProps {
  readonly mode: 'single';
  /** All four sides; one the caller cannot accept is `disabled`. */
  sides: ReadonlyArray<Omit<SideState, 'active'>>;
  value: Side;
  onSelect: (side: Side) => void;
  ariaLabel: string;
}

type SideSelectorProps = MultiSideSelectorProps | SingleSideSelectorProps;

const ARROW_SIDE: Partial<Record<string, Side>> = {
  ArrowUp: 'back',
  ArrowDown: 'front',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

/** Grid placement per side around the center bin glyph. */
const SIDE_CELL: Record<Side, string> = {
  back: 'col-start-2 row-start-1',
  left: 'col-start-1 row-start-2',
  right: 'col-start-3 row-start-2',
  front: 'col-start-2 row-start-3',
};

const CHIP_BASE =
  'flex items-center justify-center rounded-md border px-2 py-1 text-xs font-medium transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

/** Filled accent button when on. */
const CHIP_ON = 'border-accent bg-accent text-on-accent hover:bg-accent hover:text-on-accent';
/** Bordered surface button when off — clearly a button, clearly not selected. */
const CHIP_OFF =
  'border-stroke-subtle bg-surface-elevated text-content-secondary hover:bg-surface-hover hover:text-content';

export function SideSelector(props: SideSelectorProps) {
  return props.mode === 'single' ? <SingleSide {...props} /> : <MultiSide {...props} />;
}

function Cross({
  role,
  ariaLabel,
  onKeyDown,
  children,
}: {
  role: 'group' | 'radiogroup';
  ariaLabel: string;
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
  children: ReactNode;
}) {
  return (
    <div
      role={role}
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className="grid grid-cols-3 grid-rows-3 gap-1"
    >
      {children}
      {/* Center bin glyph — grounds the four sides in physical space. */}
      <div aria-hidden className="col-start-2 row-start-2 flex items-center justify-center">
        <div className="h-5 w-7 rounded-sm border border-stroke-subtle bg-surface-tertiary" />
      </div>
    </div>
  );
}

function SingleSide({ sides, value, onSelect, ariaLabel }: SingleSideSelectorProps) {
  const buttons = useRef<Partial<Record<Side, HTMLButtonElement | null>>>({});
  // Re-picking the chosen wall would still be a store write: an undo entry
  // that changes nothing, and a cleared redo stack.
  const choose = (side: Side): void => {
    if (side !== value) onSelect(side);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const side = ARROW_SIDE[event.key];
    if (side === undefined) return;
    event.preventDefault();
    if (sides.some((option) => option.side === side && !option.disabled)) {
      choose(side);
      buttons.current[side]?.focus();
    }
  };
  return (
    <Cross role="radiogroup" ariaLabel={ariaLabel} onKeyDown={onKeyDown}>
      {sides.map(({ side, label, disabled, title }) => {
        const isOn = side === value;
        return (
          <Button
            key={side}
            ref={(element: HTMLButtonElement | null) => {
              buttons.current[side] = element;
            }}
            variant="ghost"
            type="button"
            role="radio"
            aria-checked={isOn}
            tabIndex={isOn ? 0 : -1}
            disabled={disabled}
            title={title}
            onClick={() => choose(side)}
            className={`${SIDE_CELL[side]} ${CHIP_BASE} ${isOn ? CHIP_ON : CHIP_OFF}`}
          >
            {label}
          </Button>
        );
      })}
    </Cross>
  );
}

function MultiSide({ sides, onToggle, ariaLabel }: MultiSideSelectorProps) {
  return (
    <Cross role="group" ariaLabel={ariaLabel}>
      {sides.map(({ side, label, active, disabled, title }) => {
        // A disabled side always reads as off — both visually and for ARIA —
        // regardless of the `active` the caller passes, so a blocked side can
        // never appear enabled.
        const isOn = active && !disabled;
        return (
          <Button
            key={side}
            variant="ghost"
            type="button"
            role="switch"
            aria-checked={isOn}
            disabled={disabled}
            title={title}
            onClick={() => onToggle(side)}
            className={`${SIDE_CELL[side]} ${CHIP_BASE} ${isOn ? CHIP_ON : CHIP_OFF}`}
          >
            {label}
          </Button>
        );
      })}
    </Cross>
  );
}

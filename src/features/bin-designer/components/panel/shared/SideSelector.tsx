/**
 * Spatial side selector shared by feature panels (wall cutouts, handles).
 *
 * Lays the four bin walls out in their physical positions around a center bin
 * glyph — Back on top, Front on the bottom, Left and Right flanking — so the
 * control maps directly onto the bin you're editing instead of an abstract row
 * of L/R/F/B letters. Each side is an independent on/off `switch`; the accent
 * tint (SEGMENT_ACTIVE/INACTIVE) is the "this is on" signal. A side can be
 * disabled (e.g. the back handle while a label tab occupies that wall), in which
 * case it reads as off and shows an explanatory tooltip.
 */

import { SEGMENT_ACTIVE, SEGMENT_INACTIVE } from '@/shared/components/segmentedControlClasses';

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

interface SideSelectorProps {
  /** All four sides; order is irrelevant — placement is spatial. */
  sides: ReadonlyArray<SideState>;
  onToggle: (side: Side) => void;
  ariaLabel: string;
}

/** Grid placement per side around the center bin glyph. */
const SIDE_CELL: Record<Side, string> = {
  back: 'col-start-2 row-start-1',
  left: 'col-start-1 row-start-2',
  right: 'col-start-3 row-start-2',
  front: 'col-start-2 row-start-3',
};

const CHIP_BASE =
  'flex items-center justify-center rounded-md px-2 py-1 text-xs font-medium transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

export function SideSelector({ sides, onToggle, ariaLabel }: SideSelectorProps) {
  return (
    <div role="group" aria-label={ariaLabel} className="grid grid-cols-3 grid-rows-3 gap-1">
      {sides.map(({ side, label, active, disabled, title }) => {
        // A disabled side always reads as off — both visually and for ARIA —
        // regardless of the `active` the caller passes, so a blocked side can
        // never appear enabled.
        const isOn = active && !disabled;
        return (
          <button
            key={side}
            type="button"
            role="switch"
            aria-checked={isOn}
            disabled={disabled}
            title={title}
            onClick={() => onToggle(side)}
            className={`${SIDE_CELL[side]} ${CHIP_BASE} ${isOn ? SEGMENT_ACTIVE : SEGMENT_INACTIVE}`}
          >
            {label}
          </button>
        );
      })}

      {/* Center bin glyph — grounds the four sides in physical space. */}
      <div aria-hidden className="col-start-2 row-start-2 flex items-center justify-center">
        <div className="h-5 w-7 rounded-sm border border-stroke-subtle bg-surface-tertiary" />
      </div>
    </div>
  );
}

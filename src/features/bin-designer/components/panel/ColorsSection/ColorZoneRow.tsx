/**
 * A single color zone row: swatch tile + zone label + hex value + chevron.
 *
 * Clicking the row opens a popover with the full picker. The 3D preview
 * receives hover focus on row hover AND while the popover is open so the
 * user always sees which zone they're editing.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Popover } from '@/design-system/Popover/Popover';
import { ChevronDownIcon } from '@/design-system/Icon';
import { ColorPicker } from './ColorPicker';
import type { HoverableZone } from '@/features/bin-designer/types/featureColors';

interface ColorZoneRowProps {
  /**
   * Hover/identifier target. Widened to HoverableZone so the lip row can
   * fire the whole-lip glow ('lip') even though 'lip' is not a settable
   * ColorZone — onChange is still wired by the parent to the correct
   * underlying slot(s).
   */
  zone: HoverableZone;
  label: string;
  color: string;
  defaultColor: string;
  otherColors: readonly string[];
  /** Body hex used to seed AI suggestions in the picker. */
  bodyColor: string;
  /** Session-scoped recent colors the user has committed elsewhere. */
  recentColors: readonly string[];
  onChange: (hex: string) => void;
  onHover: (zone: HoverableZone | null) => void;
  /** Native-picker gesture hooks, forwarded to ColorPicker for undo coalescing. */
  onGestureStart?: () => void;
  onGestureEnd?: () => void;
}

export function ColorZoneRow({
  zone,
  label,
  color,
  defaultColor,
  otherColors,
  bodyColor,
  recentColors,
  onChange,
  onHover,
  onGestureStart,
  onGestureEnd,
}: ColorZoneRowProps) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleClose = useCallback(() => setIsOpen(false), []);

  // While the popover is open, keep this zone pinned as the focused one
  // so the 3D preview glow doesn't drop off when the user moves their
  // pointer into the popover content. The cleanup runs on close (or
  // unmount) and releases the pin — without it, closing via Escape /
  // click-outside while the pointer is already off the row would leave
  // the glow stuck because pointerLeave short-circuits when `isOpen`.
  useEffect(() => {
    if (!isOpen) return;
    onHover(zone);
    return () => onHover(null);
  }, [isOpen, zone, onHover]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        onPointerEnter={() => onHover(zone)}
        onPointerLeave={() => {
          if (!isOpen) onHover(null);
        }}
        className="group flex w-full items-center gap-3 rounded-lg px-2 py-2 -mx-2 transition-colors hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/40 data-[open=true]:bg-surface-hover md:py-1.5"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={`${label}: ${color}`}
        data-open={isOpen}
      >
        <span
          className="w-6 h-6 rounded-md border border-stroke-subtle/60 shrink-0 shadow-inner transition-transform group-hover:scale-105"
          style={{ backgroundColor: color }}
        />
        <span className="flex-1 text-left text-xs text-content-secondary">{label}</span>
        <span className="font-mono text-[11px] text-content-secondary tabular-nums">{color}</span>
        <ChevronDownIcon
          size="sm"
          className="-rotate-90 text-content-tertiary transition-transform group-hover:translate-x-0.5"
        />
      </button>

      {isOpen && (
        <Popover anchorRef={buttonRef} isOpen onClose={handleClose} placement="bottom-start">
          <ColorPicker
            zone={zone}
            zoneLabel={label}
            color={color}
            defaultColor={defaultColor}
            otherColors={otherColors}
            bodyColor={bodyColor}
            recentColors={recentColors}
            onChange={onChange}
            onGestureStart={onGestureStart}
            onGestureEnd={onGestureEnd}
          />
        </Popover>
      )}
    </>
  );
}

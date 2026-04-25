/**
 * A single color zone row: colored dot + zone label, click to edit.
 *
 * Opens a popover with preset filament colors + hex input.
 * Fires hover events for 3D preview glow feedback.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Popover } from '@/design-system/Popover/Popover';
import { ColorPicker } from './ColorPicker';
import type { ColorZone } from '@/features/bin-designer/types/featureColors';

interface ColorZoneRowProps {
  zone: ColorZone;
  label: string;
  color: string;
  onChange: (hex: string) => void;
  onHover: (zone: ColorZone | null) => void;
}

export function ColorZoneRow({ zone, label, color, onChange, onHover }: ColorZoneRowProps) {
  const [isOpen, setIsOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement | null>(null);

  const handleClose = useCallback(() => setIsOpen(false), []);

  // Re-anchor on open (effect to comply with React 19 ref rules)
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    anchorRef.current = isOpen ? buttonRef.current : null;
  }, [isOpen]);

  return (
    <div
      className="flex items-center gap-2.5"
      onPointerEnter={() => onHover(zone)}
      onPointerLeave={() => onHover(null)}
    >
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="group flex items-center gap-2 rounded-md px-1.5 py-1 -mx-1.5 transition-colors hover:bg-surface-hover"
        aria-expanded={isOpen}
        aria-label={`${label}: ${color}`}
      >
        <span
          className="w-4 h-4 rounded-full border border-stroke-subtle/50 shrink-0 transition-transform group-hover:scale-110"
          style={{ backgroundColor: color }}
        />
        <span className="text-xs text-content-secondary">{label}</span>
      </button>

      {isOpen && (
        <Popover
          key={color}
          anchorRef={anchorRef}
          isOpen
          onClose={handleClose}
          placement="bottom-start"
        >
          <ColorPicker color={color} onChange={onChange} />
        </Popover>
      )}
    </div>
  );
}

/**
 * Swatch row for a single color zone (Body / Lip / Label Tab).
 *
 * Shows 4 clickable swatch buttons — one per palette slot.
 * Selected swatch gets a ring + checkmark overlay.
 * Fires pointer events for 3D preview glow feedback.
 */

import { useSettingsStore } from '@/core/store';
import type { ColorZone, FilamentSlotId } from '@/features/bin-designer/types/featureColors';

interface FilamentSwatchRowProps {
  zone: ColorZone;
  label: string;
  value: FilamentSlotId;
  onChange: (slotId: FilamentSlotId) => void;
  onHover: (zone: ColorZone | null) => void;
  disabled?: boolean;
}

export function FilamentSwatchRow({
  zone,
  label,
  value,
  onChange,
  onHover,
  disabled,
}: FilamentSwatchRowProps) {
  const palette = useSettingsStore((s) => s.settings.filamentPalette);

  return (
    <div
      className={`flex items-center justify-between gap-2 ${disabled ? 'opacity-40 pointer-events-none' : ''}`}
      onPointerEnter={() => onHover(zone)}
      onPointerLeave={() => onHover(null)}
    >
      <span className="text-xs text-content-secondary">{label}</span>
      <div className="flex items-center gap-1.5">
        {palette.map((slot) => {
          const isSelected = slot.id === value;
          return (
            <button
              key={slot.id}
              type="button"
              onClick={() => onChange(slot.id)}
              disabled={disabled}
              className={`relative w-7 h-7 rounded-md border transition-all focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none ${
                isSelected
                  ? 'ring-2 ring-accent border-accent'
                  : 'border-stroke-subtle/50 hover:border-stroke hover:scale-105'
              }`}
              style={{ backgroundColor: slot.color }}
              // eslint-disable-next-line i18next/no-literal-string -- dynamic slot name + state suffix, not user-facing prose
              aria-label={`${slot.name}${isSelected ? ' (selected)' : ''}`}
              aria-pressed={isSelected}
              title={slot.name}
            >
              {isSelected && (
                <svg
                  className="absolute inset-0 m-auto w-3.5 h-3.5 drop-shadow-sm"
                  viewBox="0 0 14 14"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M3 7l3 3 5-5"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

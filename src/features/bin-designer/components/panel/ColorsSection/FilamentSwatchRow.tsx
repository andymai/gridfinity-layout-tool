/**
 * Swatch row for a single color zone (Body / Lip / Label Tab).
 *
 * Shows 4 clickable swatch buttons — one per palette slot.
 * Selected swatch gets a ring + auto-contrast checkmark overlay.
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
  disabledReason?: string;
}

/** Returns true if the hex color is perceptually light (checkmark should be dark). */
function isLightColor(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  // Relative luminance (sRGB simplified)
  return r * 0.299 + g * 0.587 + b * 0.114 > 160;
}

export function FilamentSwatchRow({
  zone,
  label,
  value,
  onChange,
  onHover,
  disabled,
  disabledReason,
}: FilamentSwatchRowProps) {
  const palette = useSettingsStore((s) => s.settings.filamentPalette);

  return (
    <div
      className={`flex items-center justify-between gap-2 rounded-md px-1.5 py-1 -mx-1.5 transition-colors ${
        disabled ? 'opacity-40 pointer-events-none' : 'hover:bg-surface-hover/50'
      }`}
      onPointerEnter={() => onHover(zone)}
      onPointerLeave={() => onHover(null)}
      title={disabled ? disabledReason : undefined}
    >
      <span className="text-xs text-content-secondary">{label}</span>
      <div className="flex items-center gap-1.5">
        {palette.map((slot) => {
          const isSelected = slot.id === value;
          // eslint-disable-next-line i18next/no-literal-string -- hex color constants
          const checkColor = isLightColor(slot.color) ? '#1f2937' : '#ffffff';
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
              aria-label={`${label}: ${slot.name}`}
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
                    stroke={checkColor}
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

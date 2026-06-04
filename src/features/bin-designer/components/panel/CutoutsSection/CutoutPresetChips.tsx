/**
 * Quick-pick hardware-size chips — the fast path for bit/socket organizers.
 *
 * Shows the most common spec sizes as one-tap chips (the active size is
 * highlighted); the rest of the catalog expands inline via an overflow-count
 * disclosure chip so the dominant use case (drop a 6mm hex, a 1/4" drive) is a
 * single click and the full list never needs a dropdown.
 */

import { useState } from 'react';
import { useTranslation } from '@/i18n';
import { cn } from '@/design-system/cn';
import type { CutoutSizePreset } from './cutoutShapePresets';

interface CutoutPresetChipsProps {
  readonly presets: readonly CutoutSizePreset[];
  readonly onPick: (mm: number) => void;
  /** Currently applied nominal size (mm), used to highlight the matching chip. */
  readonly activeMm?: number;
  readonly disabled?: boolean;
  /** Number of presets surfaced before the overflow disclosure chip. */
  readonly maxChips?: number;
}

/** Compact chip label — the spec's leading token, e.g. `1/4"` or `6`. */
function chipLabel(preset: CutoutSizePreset): string {
  const fraction = preset.label.match(/^\d+\/\d+"/);
  if (fraction) return fraction[0];
  return String(preset.mm);
}

const CHIP_BASE = 'rounded border px-1.5 py-0.5 text-[11px] tabular-nums transition-colors';
const CHIP_INACTIVE =
  'border-stroke-subtle bg-surface-elevated text-content-secondary hover:border-accent/50 hover:text-content';

export function CutoutPresetChips({
  presets,
  onPick,
  activeMm,
  disabled = false,
  maxChips = 6,
}: CutoutPresetChipsProps) {
  const t = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const restCount = Math.max(0, presets.length - maxChips);
  const shown = expanded ? presets : presets.slice(0, maxChips);

  return (
    <div className="space-y-1">
      <span className="block text-[10px] text-content-tertiary">
        {t('binDesigner.cutouts.sizePreset')}
      </span>
      <div className="flex flex-wrap gap-1">
        {shown.map((preset) => {
          const active = activeMm !== undefined && Math.abs(activeMm - preset.mm) < 0.01;
          return (
            <button
              key={preset.id}
              type="button"
              disabled={disabled}
              onClick={() => onPick(preset.mm)}
              title={preset.label}
              aria-pressed={active}
              aria-label={preset.label}
              className={cn(
                CHIP_BASE,
                active ? 'border-accent bg-accent/15 text-accent' : CHIP_INACTIVE,
                disabled && 'cursor-not-allowed opacity-50'
              )}
            >
              {chipLabel(preset)}
            </button>
          );
        })}
        {restCount > 0 && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-label={t('binDesigner.cutouts.sizePresetMore')}
            className={cn(
              CHIP_BASE,
              CHIP_INACTIVE,
              'inline-flex items-center gap-0.5',
              disabled && 'cursor-not-allowed opacity-50'
            )}
          >
            {!expanded && <span>{restCount}</span>}
            <svg
              viewBox="0 0 12 12"
              className={cn('h-2.5 w-2.5 transition-transform', expanded && 'rotate-180')}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 4.5L6 7.5L9 4.5" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

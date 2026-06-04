/**
 * Quick-pick hardware-size chips — the fast path for bit/socket organizers.
 *
 * Shows the most common spec sizes as one-tap chips (the active size is
 * highlighted), with the full catalog tucked behind a "More…" dropdown
 * (reusing CutoutPresetMenu). Replaces the dropdown-only picker so the
 * dominant use case (drop a 6mm hex, a 1/4" drive) is a single click.
 */

import { useTranslation } from '@/i18n';
import { cn } from '@/design-system/cn';
import type { CutoutSizePreset } from './cutoutShapePresets';
import { CutoutPresetMenu } from './CutoutPresetMenu';

interface CutoutPresetChipsProps {
  readonly presets: readonly CutoutSizePreset[];
  readonly onPick: (mm: number) => void;
  /** Currently applied nominal size (mm), used to highlight the matching chip. */
  readonly activeMm?: number;
  readonly disabled?: boolean;
  /** Number of presets surfaced as chips; the rest live in the "More…" menu. */
  readonly maxChips?: number;
}

/** Compact chip label — the spec's leading token, e.g. `1/4"` or `6`. */
function chipLabel(preset: CutoutSizePreset): string {
  const fraction = preset.label.match(/^\d+\/\d+"/);
  if (fraction) return fraction[0];
  return String(preset.mm);
}

export function CutoutPresetChips({
  presets,
  onPick,
  activeMm,
  disabled = false,
  maxChips = 6,
}: CutoutPresetChipsProps) {
  const t = useTranslation();
  const quick = presets.slice(0, maxChips);
  const rest = presets.slice(maxChips);

  return (
    <div className="space-y-1">
      <span className="block text-[10px] uppercase tracking-wide text-content-tertiary">
        {t('binDesigner.cutouts.sizePreset')}
      </span>
      <div className="flex flex-wrap gap-1">
        {quick.map((preset) => {
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
                'rounded border px-1.5 py-0.5 text-[11px] tabular-nums transition-colors',
                active
                  ? 'border-accent bg-accent/15 text-accent'
                  : 'border-stroke-subtle bg-surface-elevated text-content-secondary hover:border-accent/50 hover:text-content',
                disabled && 'cursor-not-allowed opacity-50'
              )}
            >
              {chipLabel(preset)}
            </button>
          );
        })}
      </div>
      {rest.length > 0 && (
        <CutoutPresetMenu
          presets={rest}
          label={t('binDesigner.cutouts.sizePresetMore')}
          onPick={onPick}
          disabled={disabled}
        />
      )}
    </div>
  );
}

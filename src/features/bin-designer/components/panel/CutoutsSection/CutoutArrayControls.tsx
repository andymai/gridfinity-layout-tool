/**
 * Parametric-array controls: turn a single cutout into a grid / staggered /
 * radial array, tune its layout, and flatten it back to independent cutouts.
 * The master cutout drives every instance; only the layout lives in `array`.
 */

import type { Cutout, CutoutArrayMode, CutoutArrayConfig } from '@/features/bin-designer/types';
import { CUTOUT_ARRAY_MODES, MAX_ARRAY_COUNT } from '@/features/bin-designer/types';
import {
  arrayInstanceCount,
  defaultArrayConfig,
  arrayFieldBounds,
  ARRAY_MIN_RADIUS,
} from '@/shared/utils/cutoutArray';
import { useTranslation } from '@/i18n';
import { Button, Checkbox, Stepper } from '@/design-system';
import { CompactNumberInput } from '@/shared/components/CompactNumberInput';

interface CutoutArrayControlsProps {
  readonly cutout: Cutout;
  /** Bin interior dimensions (mm) — array layout is clamped to fit within them. */
  readonly binWidth: number;
  readonly binDepth: number;
  readonly onUpdate: (patch: Partial<Cutout>) => void;
  readonly onFlatten: () => void;
  readonly disabled?: boolean;
}

export function CutoutArrayControls({
  cutout,
  binWidth,
  binDepth,
  onUpdate,
  onFlatten,
  disabled = false,
}: CutoutArrayControlsProps) {
  const t = useTranslation();
  const array = cutout.array;

  const setArray = (patch: Partial<CutoutArrayConfig>): void => {
    if (!array) return;
    onUpdate({ array: { ...array, ...patch } });
  };

  if (!array) {
    return (
      <Button
        type="button"
        variant="ghost"
        className="w-full rounded border border-stroke-subtle bg-surface-elevated px-2 py-1.5 text-xs text-content-secondary hover:bg-surface-hover transition-colors disabled:opacity-50"
        onClick={() => onUpdate({ array: defaultArrayConfig(cutout.width, cutout.depth) })}
        disabled={disabled}
      >
        {t('binDesigner.cutouts.array.create')}
      </Button>
    );
  }

  const count = arrayInstanceCount(array);
  const bounds = arrayFieldBounds(cutout, binWidth, binDepth, array);

  return (
    <div className="space-y-1.5">
      <div
        className="flex rounded-lg bg-surface p-0.5 border border-stroke-subtle"
        role="tablist"
        aria-label={t('binDesigner.cutouts.section.array')}
      >
        {CUTOUT_ARRAY_MODES.map((mode: CutoutArrayMode) => (
          <Button
            key={mode}
            role="tab"
            type="button"
            variant="ghost"
            aria-selected={array.mode === mode}
            className={`flex flex-1 items-center justify-center gap-1 rounded-md px-1.5 py-1.5 text-[11px] font-medium transition-all leading-none ${
              array.mode === mode
                ? 'bg-surface-elevated text-content shadow-sm'
                : 'text-content-tertiary hover:text-content-secondary'
            }`}
            onClick={() => setArray({ mode })}
            disabled={disabled}
            title={t(`binDesigner.cutouts.array.mode.${mode}`)}
          >
            <ArrayModeIcon mode={mode} />
            {t(`binDesigner.cutouts.array.mode.${mode}`)}
          </Button>
        ))}
      </div>

      {array.mode === 'radial' ? (
        <>
          <ArrayStepRow
            label={t('binDesigner.cutouts.array.count')}
            value={array.count}
            onChange={(v) => setArray({ count: v })}
            min={1}
            max={MAX_ARRAY_COUNT}
            step={1}
            disabled={disabled}
          />
          <ArrayStepRow
            label={t('binDesigner.cutouts.array.radius')}
            value={array.radius}
            onChange={(v) => setArray({ radius: v })}
            min={ARRAY_MIN_RADIUS}
            max={bounds.maxRadius}
            step={0.5}
            unit="mm"
            disabled={disabled}
          />
          <ArrayStepRow
            label={t('binDesigner.cutouts.array.startAngle')}
            value={array.startAngle}
            onChange={(v) => setArray({ startAngle: v })}
            min={0}
            max={359}
            step={1}
            unit="°"
            disabled={disabled}
          />
          <label className="flex items-center gap-2 text-xs text-content-secondary">
            <Checkbox
              checked={array.rotateToCenter}
              onChange={(c) => setArray({ rotateToCenter: c })}
              disabled={disabled}
              aria-label={t('binDesigner.cutouts.array.rotateToCenter')}
            />
            {t('binDesigner.cutouts.array.rotateToCenter')}
          </label>
        </>
      ) : (
        <div className="grid grid-cols-2 gap-1">
          <CompactNumberInput
            label={t('binDesigner.cutouts.array.cols')}
            value={array.cols}
            onChange={(v) =>
              setArray({ cols: Math.max(1, Math.min(bounds.maxCols, Math.round(v))) })
            }
            min={1}
            max={bounds.maxCols}
            step={1}
            disabled={disabled}
          />
          <CompactNumberInput
            label={t('binDesigner.cutouts.array.rows')}
            value={array.rows}
            onChange={(v) =>
              setArray({ rows: Math.max(1, Math.min(bounds.maxRows, Math.round(v))) })
            }
            min={1}
            max={bounds.maxRows}
            step={1}
            disabled={disabled}
          />
          <CompactNumberInput
            label={t('binDesigner.cutouts.array.pitchX')}
            value={array.pitchX}
            onChange={(v) =>
              setArray({ pitchX: Math.max(bounds.minPitchX, Math.min(bounds.maxPitchX, v)) })
            }
            min={bounds.minPitchX}
            max={bounds.maxPitchX}
            step={0.5}
            unit="mm"
            disabled={disabled}
          />
          <CompactNumberInput
            label={t('binDesigner.cutouts.array.pitchY')}
            value={array.pitchY}
            onChange={(v) =>
              setArray({ pitchY: Math.max(bounds.minPitchY, Math.min(bounds.maxPitchY, v)) })
            }
            min={bounds.minPitchY}
            max={bounds.maxPitchY}
            step={0.5}
            unit="mm"
            disabled={disabled}
          />
        </div>
      )}

      <div className="flex items-center justify-between pt-0.5 text-[11px] text-content-tertiary">
        <span>{t('binDesigner.cutouts.array.instances', { count })}</span>
      </div>

      <div className="flex gap-1.5">
        <Button
          type="button"
          variant="ghost"
          className="flex-1 rounded border border-stroke-subtle bg-surface-elevated px-2 py-1 text-xs text-content-secondary hover:bg-surface-hover transition-colors disabled:opacity-50"
          onClick={onFlatten}
          disabled={disabled}
        >
          {t('binDesigner.cutouts.array.flatten')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="rounded border border-stroke-subtle bg-surface-elevated px-2 py-1 text-xs text-content-secondary hover:bg-surface-hover transition-colors disabled:opacity-50"
          onClick={() => onUpdate({ array: undefined })}
          disabled={disabled}
          title={t('binDesigner.cutouts.array.remove')}
        >
          {t('binDesigner.cutouts.array.remove')}
        </Button>
      </div>
    </div>
  );
}

interface ArrayStepRowProps {
  readonly label: string;
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly min: number;
  readonly max: number;
  readonly step?: number;
  readonly unit?: string;
  readonly disabled?: boolean;
}

function ArrayModeIcon({ mode }: { readonly mode: CutoutArrayMode }) {
  const props = {
    className: 'h-3 w-3 flex-shrink-0',
    viewBox: '0 0 14 14',
    'aria-hidden': true,
  } as const;
  if (mode === 'grid') {
    return (
      <svg {...props}>
        <circle cx="3" cy="4" r="1.3" fill="currentColor" />
        <circle cx="7" cy="4" r="1.3" fill="currentColor" />
        <circle cx="11" cy="4" r="1.3" fill="currentColor" />
        <circle cx="3" cy="9" r="1.3" fill="currentColor" />
        <circle cx="7" cy="9" r="1.3" fill="currentColor" />
        <circle cx="11" cy="9" r="1.3" fill="currentColor" />
      </svg>
    );
  }
  if (mode === 'staggered') {
    return (
      <svg {...props}>
        <circle cx="2.5" cy="4" r="1.3" fill="currentColor" />
        <circle cx="7" cy="4" r="1.3" fill="currentColor" />
        <circle cx="11.5" cy="4" r="1.3" fill="currentColor" />
        <circle cx="4.75" cy="9" r="1.3" fill="currentColor" />
        <circle cx="9.25" cy="9" r="1.3" fill="currentColor" />
      </svg>
    );
  }
  // radial
  return (
    <svg {...props} fill="none" stroke="currentColor" strokeWidth="1">
      <circle cx="7" cy="7" r="4.5" strokeDasharray="2 1.2" />
      <circle cx="7" cy="2.5" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="11.5" cy="7" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="7" cy="11.5" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="2.5" cy="7" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Label + numeric stepper row. Type for an exact value, or +/- by `step`. */
function ArrayStepRow({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  disabled,
}: ArrayStepRowProps) {
  const clamp = (v: number): number => Math.min(max, Math.max(min, Number(v.toFixed(3))));
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-content-secondary">
        {label}
        {unit ? <span className="ml-1 text-content-tertiary">{unit}</span> : null}
      </span>
      <Stepper
        size="sm"
        value={value}
        onChange={(v) => onChange(clamp(v))}
        onStep={(delta) => onChange(clamp(value + delta * step))}
        min={min}
        max={max}
        step={step}
        aria-label={label}
        disabled={disabled}
      />
    </div>
  );
}

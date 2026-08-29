/**
 * Parametric-array controls: turn a single cutout into a grid / staggered /
 * radial array, tune its layout, and flatten it back to independent cutouts.
 * The master cutout drives every instance; only the layout lives in `array`.
 *
 * Surfaced as "Repeat". The data field stays `array` deliberately: renaming it
 * would change every stored design and the community params fingerprint.
 */

import type { CutoutArrayMode, CutoutArrayConfig } from '@/features/bin-designer/types';
import { CUTOUT_ARRAY_MODES, MAX_ARRAY_COUNT } from '@/features/bin-designer/types';
import {
  arrayInstanceCount,
  arrayFieldBounds,
  arrayInstancesOverlap,
  fillBinCounts,
  ARRAY_MIN_RADIUS,
  type RepeatBox,
} from '@/shared/utils/cutoutArray';
import { useTranslation } from '@/i18n';
import { Button, Checkbox, Stepper, NumberField } from '@/design-system';
import { clamp } from '@/shared/utils/math';
import { cn } from '@/design-system/cn';
import { trackEvent } from '@/shared/analytics/posthog';
import {
  REPEAT_PRESETS,
  buildPresetConfig,
  clampedDefaultConfig,
  presetFits,
  presetInstanceCount,
  type RepeatPreset,
} from './repeatPresets';
import type { RepeatBlockedReason } from './cutoutSectionVisibility';

/** The explanation each refusal renders in place of the controls. */
const BLOCKED_REASON_KEYS: Record<RepeatBlockedReason, string> = {
  grouped: 'binDesigner.cutouts.repeat.blockedGrouped',
  descendantRepeat: 'binDesigner.cutouts.repeat.blockedDescendant',
  path: 'binDesigner.cutouts.repeat.blockedPath',
};

interface CutoutArrayControlsProps {
  /**
   * The footprint the layout is measured against: one cutout's box, or a whole
   * group's. A group repeats as one unit, so its spacing has to be measured
   * against the assembly rather than against whichever member was clicked.
   */
  readonly box: RepeatBox;
  readonly array: CutoutArrayConfig | undefined;
  /** Bin interior dimensions (mm) — array layout is clamped to fit within them. */
  readonly binWidth: number;
  readonly binDepth: number;
  readonly onChange: (config: CutoutArrayConfig | undefined) => void;
  readonly onFlatten: () => void;
  readonly disabled?: boolean;
  /** Set when a repeat is refused; renders the reason in place of the controls. */
  readonly blockedReason?: RepeatBlockedReason | null;
  /** Offered alongside the grouped explanation, so the reason has a way out. */
  readonly onUngroup?: () => void;
  /**
   * False for a group. Rotate-to-center turns each copy to face the ring, which
   * for a group means turning the whole assembly; expanding members one at a
   * time can only turn each about its own center, which pulls the assembly
   * apart. See `groupArrayConfig`.
   */
  readonly canRotateToCenter?: boolean;
}

export function CutoutArrayControls({
  box,
  array,
  binWidth,
  binDepth,
  onChange,
  onFlatten,
  disabled = false,
  blockedReason,
  onUngroup,
  canRotateToCenter = true,
}: CutoutArrayControlsProps) {
  const t = useTranslation();
  const cutout = box;

  const setArray = (patch: Partial<CutoutArrayConfig>): void => {
    if (!array) return;
    onChange({ ...array, ...patch });
  };

  const create = (config: CutoutArrayConfig, source: 'preset' | 'inspector'): void => {
    onChange(config);
    trackEvent('cutout_repeat_created', {
      source,
      mode: config.mode,
      instances: arrayInstanceCount(config),
    });
  };

  if (blockedReason) {
    return (
      <div className="space-y-1.5">
        <p className="text-label leading-snug text-content-tertiary">
          {t(BLOCKED_REASON_KEYS[blockedReason])}
        </p>
        {blockedReason === 'grouped' && onUngroup && (
          <Button
            type="button"
            variant="ghost"
            className="w-full rounded border border-stroke-subtle bg-surface-elevated px-2 py-1.5 text-xs text-content-secondary hover:bg-surface-hover transition-colors disabled:opacity-50"
            onClick={onUngroup}
            disabled={disabled}
          >
            {t('binDesigner.cutouts.ungroup')}
          </Button>
        )}
      </div>
    );
  }

  if (!array) {
    const fallback = clampedDefaultConfig(cutout, binWidth, binDepth);
    return (
      <div className="space-y-1.5">
        <span className="block text-micro text-content-tertiary">
          {t('binDesigner.cutouts.repeat.presetLabel')}
        </span>
        <div className="flex flex-wrap gap-1">
          {REPEAT_PRESETS.map((preset) => (
            <PresetChip
              key={preset.id}
              preset={preset}
              label={
                preset.radial
                  ? t('binDesigner.cutouts.repeat.presetRing', {
                      count: presetInstanceCount(preset),
                    })
                  : `${preset.cols} × ${preset.rows}`
              }
              fits={presetFits(preset, cutout, binWidth, binDepth)}
              noFitReason={t('binDesigner.cutouts.repeat.presetNoFit')}
              disabled={disabled}
              onPick={() => create(buildPresetConfig(preset, cutout), 'preset')}
            />
          ))}
        </div>
        <Button
          type="button"
          variant="ghost"
          className="w-full rounded border border-stroke-subtle bg-surface-elevated px-2 py-1.5 text-xs text-content-secondary hover:bg-surface-hover transition-colors disabled:opacity-50"
          onClick={() => fallback && create(fallback, 'inspector')}
          disabled={disabled || fallback === null}
        >
          {t('binDesigner.cutouts.repeat.create')}
        </Button>
      </div>
    );
  }

  const count = arrayInstanceCount(array);
  const bounds = arrayFieldBounds(cutout, binWidth, binDepth, array);
  const overlaps = arrayInstancesOverlap(cutout, array);
  const fill = fillBinCounts(cutout, binWidth, binDepth, array);
  const fillIsNoOp = fill.cols === array.cols && fill.rows === array.rows;
  const handleFillBin = () => setArray(fill);

  return (
    <div className="space-y-1.5">
      <div
        className="flex rounded-lg bg-surface p-0.5 border border-stroke-subtle"
        role="tablist"
        aria-label={t('binDesigner.cutouts.section.repeat')}
      >
        {CUTOUT_ARRAY_MODES.map((mode: CutoutArrayMode) => (
          <Button
            key={mode}
            role="tab"
            type="button"
            variant="ghost"
            aria-selected={array.mode === mode}
            className={`flex flex-1 items-center justify-center gap-1 rounded-md px-1.5 py-1.5 text-label font-medium transition-all leading-none ${
              array.mode === mode
                ? 'bg-surface-elevated text-content shadow-sm'
                : 'text-content-tertiary hover:text-content-secondary'
            }`}
            onClick={() => setArray({ mode })}
            disabled={disabled}
            title={t(`binDesigner.cutouts.repeat.mode.${mode}`)}
          >
            <ArrayModeIcon mode={mode} />
            {t(`binDesigner.cutouts.repeat.mode.${mode}`)}
          </Button>
        ))}
      </div>

      {array.mode === 'radial' ? (
        <>
          <ArrayStepRow
            label={t('binDesigner.cutouts.repeat.count')}
            value={array.count}
            onChange={(v) => setArray({ count: v })}
            min={1}
            max={MAX_ARRAY_COUNT}
            step={1}
            disabled={disabled}
          />
          <ArrayStepRow
            label={t('binDesigner.cutouts.repeat.radius')}
            value={array.radius}
            onChange={(v) => setArray({ radius: v })}
            min={ARRAY_MIN_RADIUS}
            max={bounds.maxRadius}
            step={0.5}
            unit="mm"
            disabled={disabled}
          />
          <ArrayStepRow
            label={t('binDesigner.cutouts.repeat.startAngle')}
            value={array.startAngle}
            onChange={(v) => setArray({ startAngle: v })}
            min={0}
            max={359}
            step={1}
            unit="°"
            disabled={disabled}
          />
          {canRotateToCenter ? (
            <label className="flex items-center gap-2 text-xs text-content-secondary">
              <Checkbox
                checked={array.rotateToCenter}
                onChange={(c) => setArray({ rotateToCenter: c })}
                disabled={disabled}
                aria-label={t('binDesigner.cutouts.repeat.rotateToCenter')}
              />
              {t('binDesigner.cutouts.repeat.rotateToCenter')}
            </label>
          ) : (
            <p className="text-label leading-snug text-content-tertiary">
              {t('binDesigner.cutouts.repeat.groupNoRotate')}
            </p>
          )}
        </>
      ) : (
        <div className="grid grid-cols-2 gap-1">
          <NumberField
            label={t('binDesigner.cutouts.repeat.cols')}
            value={array.cols}
            onChange={(v) =>
              setArray({ cols: Math.max(1, Math.min(bounds.maxCols, Math.round(v))) })
            }
            min={1}
            max={bounds.maxCols}
            step={1}
            disabled={disabled}
          />
          <NumberField
            label={t('binDesigner.cutouts.repeat.rows')}
            value={array.rows}
            onChange={(v) =>
              setArray({ rows: Math.max(1, Math.min(bounds.maxRows, Math.round(v))) })
            }
            min={1}
            max={bounds.maxRows}
            step={1}
            disabled={disabled}
          />
          <NumberField
            label={t('binDesigner.cutouts.repeat.pitchX')}
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
          <NumberField
            label={t('binDesigner.cutouts.repeat.pitchY')}
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

      {/* Advisory, not a block: a deliberate overlap is how two shapes are made
          to cut into each other, so the user is told what will happen rather
          than stopped. */}
      {overlaps && (
        <p className="pt-0.5 text-label leading-snug text-warning">
          {t('binDesigner.cutouts.repeat.overlapWarning')}
        </p>
      )}

      <div className="flex items-center justify-between pt-0.5 text-label text-content-tertiary">
        <span>{t('binDesigner.cutouts.repeat.instances', { count })}</span>
      </div>

      <div className="flex gap-1.5">
        {/* Writes into cols/rows rather than becoming a mode of its own, so the
            result stays editable — backing off a row does not undo the fill. */}
        {array.mode !== 'radial' && (
          <Button
            type="button"
            variant="ghost"
            className="flex-1 rounded border border-stroke-subtle bg-surface-elevated px-2 py-1 text-xs text-content-secondary hover:bg-surface-hover transition-colors disabled:opacity-50"
            onClick={handleFillBin}
            disabled={disabled || fillIsNoOp}
            title={t('binDesigner.cutouts.repeat.fillBinHint')}
          >
            {t('binDesigner.cutouts.repeat.fillBin')}
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          className="flex-1 rounded border border-stroke-subtle bg-surface-elevated px-2 py-1 text-xs text-content-secondary hover:bg-surface-hover transition-colors disabled:opacity-50"
          onClick={onFlatten}
          disabled={disabled}
        >
          {t('binDesigner.cutouts.repeat.flatten')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="rounded border border-stroke-subtle bg-surface-elevated px-2 py-1 text-xs text-content-secondary hover:bg-surface-hover transition-colors disabled:opacity-50"
          onClick={() => onChange(undefined)}
          disabled={disabled}
          title={t('binDesigner.cutouts.repeat.remove')}
        >
          {t('binDesigner.cutouts.repeat.remove')}
        </Button>
      </div>
    </div>
  );
}

interface PresetChipProps {
  readonly preset: RepeatPreset;
  readonly label: string;
  /** False when the bin has no room for this layout from the cutout's position. */
  readonly fits: boolean;
  readonly noFitReason: string;
  readonly disabled: boolean;
  readonly onPick: () => void;
}

/**
 * One starting layout. A layout the bin cannot hold is disabled and says why:
 * the array grows in +X/+Y from the cutout, so a shape near the far edge has
 * little room even when the rest of the board is empty, and a silently greyed
 * chip reads as a broken control rather than a rule.
 */
function PresetChip({ preset, label, fits, noFitReason, disabled, onPick }: PresetChipProps) {
  const off = disabled || !fits;
  return (
    <Button
      type="button"
      variant="ghost"
      data-testid={`repeat-preset-${preset.id}`}
      disabled={off}
      onClick={onPick}
      title={!fits ? noFitReason : undefined}
      className={cn(
        'rounded border px-1.5 py-0.5 text-label tabular-nums transition-colors',
        off
          ? 'cursor-not-allowed border-stroke-subtle bg-surface-elevated text-content-tertiary opacity-50'
          : 'border-stroke-subtle bg-surface-elevated text-content-secondary hover:border-accent/50 hover:text-content'
      )}
    >
      {label}
    </Button>
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
  const clampArray = (v: number): number => clamp(Number(v.toFixed(3)), min, max);
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-content-secondary">
        {label}
        {unit ? <span className="ml-1 text-content-tertiary">{unit}</span> : null}
      </span>
      <Stepper
        size="sm"
        value={value}
        onChange={(v) => onChange(clampArray(v))}
        onStep={(delta) => onChange(clampArray(value + delta * step))}
        min={min}
        max={max}
        step={step}
        aria-label={label}
        disabled={disabled}
      />
    </div>
  );
}

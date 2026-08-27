/**
 * Knife controls for one `knifeSlot` cutout: the preset a slot was sized for,
 * the four measurements that size it, and which end the handle leaves through.
 *
 * The slot's cut geometry lives in the shared width/depth/cutDepth fields, so
 * every write here re-derives all three through `knifeSlotDimensions` — the
 * measurements are the source and the cut sizes are the consequence, never the
 * other way round.
 */

import { useDesignerStore } from '@/features/bin-designer/store';
import type {
  Cutout,
  KnifeSlotAxis,
  KnifeSlotOpenEnd,
  KnifeSpec,
} from '@/features/bin-designer/types';
import {
  DEFAULT_KNIFE_SPEC,
  knifeSlotAxis,
  knifeSlotDimensions,
} from '@/features/bin-designer/types';
import { binDimensions } from '@/features/bin-designer/utils/binDimensions';
import { useTranslation } from '@/i18n';
import { Button } from '@/design-system';
import { cn } from '@/design-system/cn';
import { CompactNumberInput } from '@/shared/components/CompactNumberInput';
import { getSegmentClass, SEGMENT_GROUP_CLASS } from '@/shared/components/segmentedControlClasses';
import { KNIFE_SLOT_PRESETS } from '../panel/CutoutsSection/knifeSlotPresets';
import { resizeKeepingCenter } from '../panel/CutoutsSection/cutoutHelpers';
import { knifeDepthClamp } from '../panel/CutoutsSection/cutoutSectionVisibility';

/** The nominal measurements the steppers edit — orientation is set separately. */
type KnifeMeasurements = Pick<
  KnifeSpec,
  'bladeLengthMm' | 'heelHeightMm' | 'spineThicknessMm' | 'handleWidthMm' | 'handleHeightMm'
>;

/** Editor bounds for the nominal knife measurements (mm). */
const BLADE_LENGTH = { min: 20, max: 400, step: 1 };
const HEEL_HEIGHT = { min: 5, max: 80, step: 0.5 };
const SPINE_THICKNESS = { min: 0.5, max: 10, step: 0.1 };
const HANDLE_WIDTH = { min: 8, max: 70, step: 0.5 };
const HANDLE_HEIGHT = { min: 8, max: 60, step: 0.5 };

/** Whether the blade lies along the bin's width or its depth. */
const ORIENTATIONS: readonly { readonly value: KnifeSlotAxis; readonly labelKey: string }[] = [
  { value: 'horizontal', labelKey: 'binDesigner.cutouts.knifeOrientation.horizontal' },
  { value: 'vertical', labelKey: 'binDesigner.cutouts.knifeOrientation.vertical' },
];

/** Handle-side options in reading order; `null` = enclosed on both ends. */
const OPEN_ENDS: readonly { readonly value: KnifeSlotOpenEnd | null; readonly labelKey: string }[] =
  [
    { value: 'end', labelKey: 'binDesigner.cutouts.knifeOpenEnd.end' },
    { value: 'start', labelKey: 'binDesigner.cutouts.knifeOpenEnd.start' },
    { value: null, labelKey: 'binDesigner.cutouts.knifeOpenEnd.enclosed' },
  ];

const CHIP_BASE = 'rounded border px-1.5 py-0.5 text-[11px] transition-colors';
const CHIP_INACTIVE =
  'border-stroke-subtle bg-surface-elevated text-content-secondary hover:border-accent/50 hover:text-content';
const CHIP_ACTIVE = 'border-accent bg-accent/15 text-accent hover:bg-accent/15 hover:text-accent';

interface CutoutKnifeControlsProps {
  readonly cutout: Cutout;
  readonly binWidth: number;
  readonly binDepth: number;
  /**
   * The host cuts clean through, so there is no fill surface for the slot to
   * stop at and no depth to run out of.
   */
  readonly throughOnly?: boolean;
  readonly disabled: boolean;
  readonly onUpdate: (patch: Partial<Cutout>) => void;
}

export function CutoutKnifeControls({
  cutout,
  binWidth,
  binDepth,
  throughOnly = false,
  disabled,
  onUpdate,
}: CutoutKnifeControlsProps) {
  const t = useTranslation();
  const params = useDesignerStore((s) => s.params);
  const knife = cutout.knife ?? DEFAULT_KNIFE_SPEC;

  const { wallHeight, totalH } = binDimensions(params);
  const clamp = throughOnly
    ? null
    : knifeDepthClamp({
        cutDepth: cutout.cutDepth,
        wallHeight,
        totalHeight: totalH,
        topOffset: params.cutoutConfig.topOffset,
        heightUnitMm: params.heightUnitMm,
      });

  /**
   * Resize to the derived slot, keeping the centre. The ceilings are lifted to
   * the derived size itself so a knife longer than the bin keeps its real
   * measurement and lands off the board, where the banner offers to grow the
   * bin — the same contract the W/H fields' `softMax` holds. Clamping here
   * would ship a slot quietly shorter than the blade it was sized for.
   */
  const applySpec = (next: KnifeSpec): void => {
    const dims = knifeSlotDimensions(next);
    onUpdate({
      ...resizeKeepingCenter(
        cutout,
        dims.widthMm,
        dims.depthMm,
        Math.max(binWidth, dims.widthMm),
        Math.max(binDepth, dims.depthMm)
      ),
      cutDepth: dims.cutDepthMm,
      knife: next,
    });
  };

  // A hand-measured knife is no longer the preset it started from, so the
  // provenance goes with the edit.
  const setMeasurement = (patch: Partial<KnifeMeasurements>): void => {
    const { presetId: _preset, ...rest } = knife;
    applySpec({ ...rest, ...patch });
  };

  const setOpenEnd = (openEnd: KnifeSlotOpenEnd | null): void => {
    const { openEnd: _current, ...rest } = knife;
    onUpdate({ knife: openEnd === null ? rest : { ...rest, openEnd } });
  };

  // The blade lies along local X, so a quarter turn swings it between the bin's
  // width and its depth. The handle side (openEnd) still picks which wall.
  const axis = knifeSlotAxis(cutout.rotation);
  const setAxis = (next: KnifeSlotAxis): void => {
    if (next === axis) return;
    onUpdate({ rotation: next === 'horizontal' ? 0 : 90 });
  };

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <span className="block text-[10px] text-content-tertiary">
          {t('binDesigner.cutouts.knifePreset')}
        </span>
        <div className="flex flex-wrap gap-1">
          {KNIFE_SLOT_PRESETS.map((preset) => {
            const active = knife.presetId === preset.id;
            return (
              <Button
                key={preset.id}
                type="button"
                variant="ghost"
                disabled={disabled}
                onClick={() => applySpec(preset.knife)}
                aria-pressed={active}
                className={cn(
                  CHIP_BASE,
                  active ? CHIP_ACTIVE : CHIP_INACTIVE,
                  disabled && 'cursor-not-allowed opacity-50'
                )}
              >
                {t(preset.labelKey)}
              </Button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1">
        <CompactNumberInput
          label={t('binDesigner.cutouts.knifeBladeLength')}
          value={knife.bladeLengthMm}
          onChange={(bladeLengthMm) => setMeasurement({ bladeLengthMm })}
          min={BLADE_LENGTH.min}
          max={BLADE_LENGTH.max}
          step={BLADE_LENGTH.step}
          unit="mm"
          disabled={disabled}
        />
        <CompactNumberInput
          label={t('binDesigner.cutouts.knifeHeelHeight')}
          value={knife.heelHeightMm}
          onChange={(heelHeightMm) => setMeasurement({ heelHeightMm })}
          min={HEEL_HEIGHT.min}
          max={HEEL_HEIGHT.max}
          step={HEEL_HEIGHT.step}
          unit="mm"
          disabled={disabled}
        />
        <CompactNumberInput
          label={t('binDesigner.cutouts.knifeSpineThickness')}
          value={knife.spineThicknessMm}
          onChange={(spineThicknessMm) => setMeasurement({ spineThicknessMm })}
          min={SPINE_THICKNESS.min}
          max={SPINE_THICKNESS.max}
          step={SPINE_THICKNESS.step}
          unit="mm"
          disabled={disabled}
        />
        <CompactNumberInput
          label={t('binDesigner.cutouts.knifeHandleWidth')}
          value={knife.handleWidthMm}
          onChange={(handleWidthMm) => setMeasurement({ handleWidthMm })}
          min={HANDLE_WIDTH.min}
          max={HANDLE_WIDTH.max}
          step={HANDLE_WIDTH.step}
          unit="mm"
          disabled={disabled}
        />
        <CompactNumberInput
          label={t('binDesigner.cutouts.knifeHandleHeight')}
          value={knife.handleHeightMm}
          onChange={(handleHeightMm) => setMeasurement({ handleHeightMm })}
          min={HANDLE_HEIGHT.min}
          max={HANDLE_HEIGHT.max}
          step={HANDLE_HEIGHT.step}
          unit="mm"
          disabled={disabled}
        />
      </div>

      <div className="space-y-1">
        <span className="block text-[10px] text-content-tertiary">
          {t('binDesigner.cutouts.knifeOrientation')}
        </span>
        <div
          role="group"
          aria-label={t('binDesigner.cutouts.knifeOrientation')}
          className={SEGMENT_GROUP_CLASS}
        >
          {ORIENTATIONS.map(({ value, labelKey }) => {
            const active = axis === value;
            return (
              <Button
                key={value}
                type="button"
                variant="ghost"
                disabled={disabled}
                onClick={() => setAxis(value)}
                aria-pressed={active}
                className={`flex-1 py-0.5 text-[10px] leading-none ${getSegmentClass(active)}`}
              >
                {t(labelKey)}
              </Button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1">
        <span className="block text-[10px] text-content-tertiary">
          {t('binDesigner.cutouts.knifeOpenEnd')}
        </span>
        <div
          role="group"
          aria-label={t('binDesigner.cutouts.knifeOpenEnd')}
          className={SEGMENT_GROUP_CLASS}
        >
          {OPEN_ENDS.map(({ value, labelKey }) => {
            const active = (knife.openEnd ?? null) === value;
            return (
              <Button
                key={labelKey}
                type="button"
                variant="ghost"
                disabled={disabled}
                onClick={() => setOpenEnd(value)}
                aria-pressed={active}
                className={`flex-1 py-0.5 text-[10px] leading-none ${getSegmentClass(active)}`}
              >
                {t(labelKey)}
              </Button>
            );
          })}
        </div>
        <p className="text-[10px] text-content-tertiary">
          {t('binDesigner.cutouts.knifeOpenEndHint')}
        </p>
      </div>

      {clamp && (
        <p className="text-[11px] text-warning">
          {t('binDesigner.cutouts.knifeDepthClamped', {
            depth: clamp.availableMm.toFixed(1),
            needed: clamp.neededHeightUnits,
          })}
        </p>
      )}
    </div>
  );
}

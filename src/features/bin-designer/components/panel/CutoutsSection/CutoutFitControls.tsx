/**
 * Insertion-fit controls for a cutout: clearance (size the part needs to drop
 * in) and entry chamfer (self-centering bevel). Split from CutoutShapeControls
 * so the property panels can group "fit" separately from "shape".
 *
 * `onCueChange` lets the editor draw a live footprint cue while a fit field is
 * focused — the effect is otherwise invisible in the nominal-size 2D view.
 */

import type { Cutout } from '@/features/bin-designer/types';
import { CLEARANCE_SHAPES, CHAMFER_SHAPES, maxEntryChamfer } from '@/features/bin-designer/types';
import { useTranslation } from '@/i18n';
import { StepperControl } from '@/shared/components/StepperControl';
import type { FitCue } from './cutoutSectionVisibility';

/** Stepper increment for fit fields — coarse enough to tune by clicking, while
 *  the text field still accepts off-grid values for precise tuning. */
const FIT_STEP = 0.2;

interface CutoutFitControlsProps {
  readonly cutout: Cutout;
  readonly onUpdate: (patch: Partial<Cutout>) => void;
  readonly onCueChange?: (cue: FitCue) => void;
  readonly disabled?: boolean;
}

export function CutoutFitControls({
  cutout,
  onUpdate,
  onCueChange,
  disabled = false,
}: CutoutFitControlsProps) {
  const t = useTranslation();
  const isClearanceShape = CLEARANCE_SHAPES.includes(cutout.shape);
  const isChamferShape = CHAMFER_SHAPES.includes(cutout.shape);
  const maxChamfer = maxEntryChamfer(cutout.cutDepth);

  // Show the cue while a fit control is being interacted with (focus enters on
  // both the buttons and the number field; pointerenter covers drags without a
  // prior tab-focus). Cleared on blur/leave.
  const cueProps = (cue: Exclude<FitCue, null>) => ({
    onFocusCapture: () => onCueChange?.(cue),
    onPointerEnter: () => onCueChange?.(cue),
    onBlurCapture: () => onCueChange?.(null),
    onPointerLeave: () => onCueChange?.(null),
  });

  return (
    <div className="space-y-1.5">
      {isClearanceShape && (
        <FitStepRow
          {...cueProps('clearance')}
          label={t('binDesigner.cutouts.clearance')}
          info={t('binDesigner.cutouts.clearanceInfo')}
          unit="mm"
          value={cutout.clearance ?? 0}
          onChange={(clearance) => onUpdate({ clearance })}
          min={0}
          max={2}
          disabled={disabled}
        />
      )}

      {isChamferShape && maxChamfer > 0 && (
        <FitStepRow
          {...cueProps('chamfer')}
          label={t('binDesigner.cutouts.chamfer')}
          info={t('binDesigner.cutouts.chamferInfo')}
          unit="mm"
          value={Math.min(cutout.chamferWidth ?? 0, maxChamfer)}
          onChange={(chamferWidth) => onUpdate({ chamferWidth })}
          min={0}
          max={maxChamfer}
          disabled={disabled}
        />
      )}
    </div>
  );
}

interface FitStepRowProps {
  readonly label: string;
  readonly info: string;
  readonly unit: string;
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly min: number;
  readonly max: number;
  readonly disabled?: boolean;
  readonly onFocusCapture?: () => void;
  readonly onBlurCapture?: () => void;
  readonly onPointerEnter?: () => void;
  readonly onPointerLeave?: () => void;
}

/**
 * Label + numeric stepper row for a fit field. The +/- buttons move by
 * {@link FIT_STEP}; the text field accepts any fractional mm value (clamped,
 * never snapped to the step grid) for precise tuning.
 */
function FitStepRow({
  label,
  info,
  unit,
  value,
  onChange,
  min,
  max,
  disabled,
  ...cueHandlers
}: FitStepRowProps) {
  const clamp = (v: number): number => Math.min(max, Math.max(min, Number(v.toFixed(3))));
  return (
    <div className="flex items-center justify-between gap-2" title={info} {...cueHandlers}>
      <span className="text-xs text-content-secondary">
        {label}
        <span className="ml-1 text-content-tertiary">{unit}</span>
      </span>
      <StepperControl
        variant="compact"
        value={value}
        onChange={(v) => onChange(clamp(v))}
        onStep={(delta) => onChange(clamp(value + delta * FIT_STEP))}
        min={min}
        max={max}
        step={FIT_STEP}
        ariaLabel={label}
        disabled={disabled}
      />
    </div>
  );
}

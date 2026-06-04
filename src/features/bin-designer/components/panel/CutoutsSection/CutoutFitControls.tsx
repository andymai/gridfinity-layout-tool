/**
 * Insertion-fit controls for a cutout: clearance (size the part needs to drop
 * in) and entry chamfer (self-centering bevel). Split from CutoutShapeControls
 * so the property panels can group "fit" separately from "shape".
 *
 * `onCueChange` lets the editor draw a live footprint cue while a fit field is
 * focused — the effect is otherwise invisible in the nominal-size 2D view.
 */

import type { Cutout } from '@/features/bin-designer/types';
import {
  CLEARANCE_SHAPES,
  CHAMFER_SHAPES,
  MAX_CUTOUT_CHAMFER,
} from '@/features/bin-designer/types';
import { useTranslation } from '@/i18n';
import { CompactNumberInput } from '@/shared/components/CompactNumberInput';
import type { FitCue } from './cutoutSectionVisibility';

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
  // A straight wall must remain below the bevel, so cap the chamfer by cut depth.
  const maxChamfer = Math.max(0, Math.min(MAX_CUTOUT_CHAMFER, cutout.cutDepth - 0.2));

  // Show the cue while a fit control is being interacted with (focus enters on
  // both the slider and the number field; pointerenter covers slider drags
  // without a prior tab-focus). Cleared on blur/leave.
  const cueProps = (cue: Exclude<FitCue, null>) => ({
    onFocusCapture: () => onCueChange?.(cue),
    onPointerEnter: () => onCueChange?.(cue),
    onBlurCapture: () => onCueChange?.(null),
    onPointerLeave: () => onCueChange?.(null),
  });

  return (
    <div className="space-y-1.5">
      {isClearanceShape && (
        <div {...cueProps('clearance')}>
          <CompactNumberInput
            label={t('binDesigner.cutouts.clearance')}
            value={cutout.clearance ?? 0}
            onChange={(clearance) => onUpdate({ clearance })}
            min={0}
            max={2}
            step={0.05}
            unit="mm"
            info={t('binDesigner.cutouts.clearanceInfo')}
            disabled={disabled}
          />
        </div>
      )}

      {isChamferShape && maxChamfer > 0 && (
        <div {...cueProps('chamfer')}>
          <CompactNumberInput
            label={t('binDesigner.cutouts.chamfer')}
            value={Math.min(cutout.chamferWidth ?? 0, maxChamfer)}
            onChange={(chamferWidth) => onUpdate({ chamferWidth })}
            min={0}
            max={maxChamfer}
            step={0.25}
            unit="mm"
            info={t('binDesigner.cutouts.chamferInfo')}
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Socket-mode controls for one cutout's label: plate width, hardware icon and
 * orientation, plus the reason the board will carry no socket here.
 *
 * Every width offered comes from the shared socket plan, so the picker can
 * never propose a plate the pocket would reject, and when the plan drops this
 * cutout the controls say which of the four reasons applied rather than going
 * quietly inert.
 */

import { Button } from '@/design-system';
import { useTranslation } from '@/i18n';
import { getSegmentClass, SEGMENT_GROUP_CLASS } from '@/shared/components/segmentedControlClasses';
import { LabelIconPicker } from '../panel/LabelIconPicker';
import type { Cutout } from '@/features/bin-designer/types';
import { isLabelPlateWidthU } from '@/shared/constants/labelPlates';
import type { LabelPlateWidthU } from '@/shared/constants/labelPlates';
import { MAX_CUTOUT_LABEL_SOCKETS } from '@/features/bin-designer/hooks/useCutoutSocketPlan';
import { isCutoutSocketVertical } from '@/shared/utils/cutoutLabelSocketPlan';
import type { CutoutSocketPlanView } from '@/features/bin-designer/hooks/useCutoutSocketPlan';

interface CutoutSocketControlsProps {
  readonly cutout: Cutout;
  readonly plan: CutoutSocketPlanView;
  readonly disabled: boolean;
  readonly onUpdate: (patch: Partial<Cutout>) => void;
}

/** Display name for the picker's accessible label. */
function cutoutOwnerName(cutout: Cutout): string {
  const name = cutout.name?.trim();
  if (name) return name;
  const label = cutout.label.trim();
  return label !== '' ? label : cutout.shape;
}

export function CutoutSocketControls({
  cutout,
  plan,
  disabled,
  onUpdate,
}: CutoutSocketControlsProps) {
  const t = useTranslation();
  const socket = plan.byCutoutId.get(cutout.id);
  const skipReason = plan.skippedByCutoutId.get(cutout.id);
  // Read through the planner's own predicate rather than re-deriving it: the
  // toggle must show the orientation the pocket was actually cut at.
  const vertical = isCutoutSocketVertical(cutout);

  const orientationGroup = (
    <div
      role="group"
      aria-label={t('binDesigner.cutoutSocket.orientation')}
      className={SEGMENT_GROUP_CLASS}
    >
      <Button
        type="button"
        variant="ghost"
        disabled={disabled}
        onClick={() => onUpdate({ textAngle: 0 })}
        aria-pressed={!vertical}
        className={`flex-1 py-0.5 text-micro leading-none ${getSegmentClass(!vertical)}`}
      >
        {t('binDesigner.cutoutSocket.horizontal')}
      </Button>
      <Button
        type="button"
        variant="ghost"
        disabled={disabled}
        onClick={() => onUpdate({ textAngle: 90 })}
        aria-pressed={vertical}
        className={`flex-1 py-0.5 text-micro leading-none ${getSegmentClass(vertical)}`}
      >
        {t('binDesigner.cutoutSocket.vertical')}
      </Button>
    </div>
  );

  if (!socket) {
    // The no-room message advises trying the other orientation, so the one
    // control that can unblock the plan has to stay mounted with it. The other
    // refusals are not orientation's to fix and keep the bare warning.
    return (
      <div className="space-y-2">
        <p role="status" className="text-micro text-warning">
          {skipReason === 'centerAnchor'
            ? t('binDesigner.cutoutSocket.blockedCenterAnchor')
            : skipReason === 'tooShallow'
              ? t('binDesigner.cutoutSocket.blockedTooShallow')
              : skipReason === 'capped'
                ? t('binDesigner.cutoutSocket.blockedCapped', { max: MAX_CUTOUT_LABEL_SOCKETS })
                : t('binDesigner.cutoutSocket.blockedNoRoom')}
        </p>
        {(skipReason === 'noRoom' || skipReason === undefined) && orientationGroup}
      </div>
    );
  }

  const override = cutout.labelPlateWidthU;
  const pinned = isLabelPlateWidthU(override) && socket.fittingWidthsU.includes(override);

  const setWidth = (widthU: LabelPlateWidthU | null) => {
    onUpdate(widthU === null ? { labelPlateWidthU: undefined } : { labelPlateWidthU: widthU });
  };

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <span className="text-micro text-text-muted">{t('binDesigner.cutoutSocket.width')}</span>
        <div
          role="group"
          aria-label={t('binDesigner.cutoutSocket.width')}
          className={SEGMENT_GROUP_CLASS}
        >
          <Button
            type="button"
            variant="ghost"
            disabled={disabled}
            onClick={() => setWidth(null)}
            aria-pressed={!pinned}
            className={`flex-1 py-0.5 text-micro leading-none ${getSegmentClass(!pinned)}`}
          >
            {t('binDesigner.cutoutSocket.widthAuto', { u: socket.widthU })}
          </Button>
          {socket.fittingWidthsU.map((u) => (
            <Button
              key={u}
              type="button"
              variant="ghost"
              disabled={disabled}
              onClick={() => setWidth(u)}
              aria-pressed={pinned && override === u}
              className={`flex-1 py-0.5 text-micro leading-none ${getSegmentClass(
                pinned && override === u
              )}`}
            >
              {t('binDesigner.cutoutSocket.widthU', { u })}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-micro text-text-muted">{t('binDesigner.cutoutSocket.icon')}</span>
        <LabelIconPicker
          value={cutout.labelIcon ?? null}
          onChange={(icon) => onUpdate({ labelIcon: icon ?? undefined })}
          ownerName={cutoutOwnerName(cutout)}
        />
      </div>

      {orientationGroup}
    </div>
  );
}

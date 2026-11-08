/**
 * Split pocket for the selected cutout: a line drawn across it on the canvas
 * cuts each side to its own depth. Side A keeps the pocket's own depth; side B
 * gets its depth here.
 */

import type { Cutout, CutoutDepthMode, CutoutSplit } from '@/features/bin-designer/types';
import { Button } from '@/design-system';
import { useTranslation } from '@/i18n';
import { splitSideB } from '@/shared/utils/cutoutDepth';
import { patchSplit, splitBlockedReason } from '@/shared/utils/cutoutSplit';
import { CutoutDepthControl } from '../panel/CutoutsSection/CutoutDepthControl';
import { FieldLabel } from '@/shared/components/PanelText';

const SIDE_B_MODES: readonly CutoutDepthMode[] = ['fixed', 'floor'];

/** What the inspector needs from the canvas's split tool. */
export interface SplitTool {
  /** The cutout a line is being drawn across, if any. */
  readonly drawingId: string | null;
  readonly onDraw: (id: string) => void;
  readonly onChange: (id: string, split: CutoutSplit | null) => void;
}

export interface CutoutSplitControlsProps {
  /** The cutout with any live preview merged in. */
  readonly cutout: Cutout;
  readonly maxCutDepth: number;
  /** The canvas is waiting for a line across this cutout. */
  readonly drawing: boolean;
  /** Starts drawing a line, or stops when one is being drawn. */
  readonly onDraw: () => void;
  /** A side B depth edit, or null to remove the split. */
  readonly onChange: (split: CutoutSplit | null) => void;
  readonly disabled?: boolean;
}

export function CutoutSplitControls({
  cutout,
  maxCutDepth,
  drawing,
  onDraw,
  onChange,
  disabled = false,
}: CutoutSplitControlsProps) {
  const t = useTranslation();
  const blocked = splitBlockedReason(cutout);
  if (blocked === 'shape') return null;
  const { split } = cutout;

  if (!split) {
    const hint = drawing
      ? t('binDesigner.cutouts.split.drawHint')
      : blocked !== null
        ? t(`binDesigner.cutouts.split.blocked.${blocked}`)
        : t('binDesigner.cutouts.split.addHint');
    return (
      <div className="space-y-1">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="w-full"
          disabled={disabled || (blocked !== null && !drawing)}
          aria-pressed={drawing}
          onClick={onDraw}
        >
          {t(drawing ? 'binDesigner.cutouts.split.cancel' : 'binDesigner.cutouts.split.add')}
        </Button>
        <p className="text-micro text-content-tertiary">{hint}</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <FieldLabel info={t('binDesigner.cutouts.split.nameDetail')}>
        {t('binDesigner.cutouts.split.name')}
      </FieldLabel>
      {blocked !== null && (
        <p role="alert" className="text-label leading-snug text-warning">
          {t(`binDesigner.cutouts.split.paused.${blocked}`)}
        </p>
      )}
      <CutoutDepthControl
        cutouts={[splitSideB(cutout)]}
        maxCutDepth={maxCutDepth}
        modes={SIDE_B_MODES}
        label={t('binDesigner.cutouts.split.sideBDepth')}
        onUpdate={(updates) => {
          const patch = updates.get(cutout.id);
          if (patch) onChange(patchSplit(split, patch));
        }}
        disabled={disabled}
      />
      <div className="grid grid-cols-2 gap-1">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={disabled}
          aria-pressed={drawing}
          onClick={onDraw}
        >
          {t(drawing ? 'binDesigner.cutouts.split.cancel' : 'binDesigner.cutouts.split.redraw')}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={disabled}
          onClick={() => onChange(null)}
        >
          {t('binDesigner.cutouts.split.remove')}
        </Button>
      </div>
      <p className="text-micro text-content-tertiary">
        {t(drawing ? 'binDesigner.cutouts.split.drawHint' : 'binDesigner.cutouts.split.sidesHint')}
      </p>
    </div>
  );
}

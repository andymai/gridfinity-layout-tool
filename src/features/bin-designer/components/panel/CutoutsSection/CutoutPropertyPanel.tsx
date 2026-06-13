/**
 * Property panel for editing selected cutout dimensions and position.
 *
 * Shows number inputs for single selection, or summary + bulk actions
 * for multi-selection.
 */

import type { Cutout } from '@/features/bin-designer/types';
import { Button, Collapsible, SliderInput } from '@/design-system';
import { useTranslation } from '@/i18n';
import { clampRotationToBounds, flipCutoutHorizontal, flipCutoutVertical } from './geometry';
import { CutoutScoopControls } from '../../CutoutWorkspace/CutoutScoopControls';
import { CutoutShapeControls } from './CutoutShapeControls';
import { CutoutFitControls } from './CutoutFitControls';
import { CutoutShapeBadge } from './CutoutShapeBadge';
import { hasFitControls, formatFitSummary, canArray } from './cutoutSectionVisibility';
import { CutoutArrayControls } from './CutoutArrayControls';
import { arrayInstanceCount } from '@/shared/utils/cutoutArray';
import type { FitCue } from './cutoutSectionVisibility';

interface CutoutPropertyPanelProps {
  readonly cutout: Cutout;
  readonly maxWidth: number;
  readonly maxDepth: number;
  readonly maxCutDepth: number;
  readonly onUpdate: (id: string, updates: Partial<Cutout>) => void;
  readonly onRemove: (id: string) => void;
  readonly onDuplicate: (ids: readonly string[]) => void;
  readonly disabled?: boolean;
  /** Notifies the editor which insertion-fit cue (if any) to draw on the canvas. */
  readonly onFitCue?: (cue: FitCue) => void;
  /** Flatten the cutout's array into independent cutouts. */
  readonly onFlattenArray?: (id: string) => void;
}

export function CutoutPropertyPanel({
  cutout,
  maxWidth,
  maxDepth,
  maxCutDepth,
  onUpdate,
  onRemove,
  onDuplicate,
  disabled = false,
  onFitCue,
  onFlattenArray,
}: CutoutPropertyPanelProps) {
  const t = useTranslation();

  return (
    <div className="space-y-2.5 rounded border border-stroke-subtle bg-surface-elevated p-3">
      <div className="border-b border-stroke-subtle pb-2">
        <CutoutShapeBadge cutout={cutout} />
      </div>
      <Collapsible title={t('binDesigner.cutouts.section.transform')} size="sm">
        <div className="space-y-1">
          <SliderInput
            label={t('binDesigner.cutouts.positionX')}
            value={cutout.x}
            onChange={(x) => onUpdate(cutout.id, { x })}
            min={0}
            max={maxWidth - cutout.width}
            step={0.5}
            unit="mm"
            disabled={disabled}
          />
          <SliderInput
            label={t('binDesigner.cutouts.positionY')}
            value={cutout.y}
            onChange={(y) => onUpdate(cutout.id, { y })}
            min={0}
            max={maxDepth - cutout.depth}
            step={0.5}
            unit="mm"
            disabled={disabled}
          />
          {cutout.shape !== 'path' && (
            <>
              <SliderInput
                label={t('binDesigner.cutouts.width')}
                value={cutout.width}
                onChange={(width) => onUpdate(cutout.id, { width })}
                min={2}
                max={maxWidth}
                step={0.5}
                unit="mm"
                disabled={disabled}
              />
              <SliderInput
                label={t('binDesigner.cutouts.depth')}
                value={cutout.depth}
                onChange={(depth) => onUpdate(cutout.id, { depth })}
                min={2}
                max={maxDepth}
                step={0.5}
                unit="mm"
                disabled={disabled}
              />
            </>
          )}
          <SliderInput
            label={t('binDesigner.cutouts.cutDepth')}
            value={cutout.cutDepth}
            onChange={(cutDepth) => onUpdate(cutout.id, { cutDepth })}
            min={0.5}
            max={maxCutDepth}
            step={0.5}
            unit="mm"
            disabled={disabled}
          />
          <SliderInput
            label={t('binDesigner.cutouts.rotation')}
            value={cutout.rotation}
            onChange={(rotation) => {
              const clamped = clampRotationToBounds(cutout, rotation, maxWidth, maxDepth);
              onUpdate(cutout.id, { rotation: clamped });
            }}
            min={0}
            max={359}
            step={1}
            unit="°"
            disabled={disabled}
          />
        </div>
      </Collapsible>

      <Collapsible title={t('binDesigner.cutouts.section.shape')} size="sm">
        <div className="space-y-1">
          {cutout.shape === 'rectangle' && (
            <SliderInput
              label={t('binDesigner.cutouts.cornerRadius')}
              value={cutout.cornerRadius}
              onChange={(cornerRadius) => onUpdate(cutout.id, { cornerRadius })}
              min={0}
              max={Math.min(cutout.width, cutout.depth) / 2}
              step={0.5}
              unit="mm"
              disabled={disabled}
            />
          )}
          <CutoutShapeControls
            cutout={cutout}
            maxWidth={maxWidth}
            maxDepth={maxDepth}
            onUpdate={(patch) => onUpdate(cutout.id, patch)}
            disabled={disabled}
          />
          <CutoutScoopControls
            key={cutout.id}
            cutout={cutout}
            disabled={disabled}
            onUpdate={(patch) => onUpdate(cutout.id, patch)}
          />
        </div>
      </Collapsible>

      {hasFitControls(cutout) && (
        <Collapsible
          title={t('binDesigner.cutouts.section.fit')}
          size="sm"
          defaultExpanded={false}
          summary={formatFitSummary(cutout, {
            clearance: t('binDesigner.cutouts.clearance'),
            chamfer: t('binDesigner.cutouts.chamfer'),
            none: t('binDesigner.cutouts.fitNone'),
          })}
        >
          <CutoutFitControls
            cutout={cutout}
            onUpdate={(patch) => onUpdate(cutout.id, patch)}
            onCueChange={onFitCue}
            disabled={disabled}
          />
        </Collapsible>
      )}

      {canArray(cutout) && (
        <Collapsible
          title={t('binDesigner.cutouts.section.array')}
          size="sm"
          defaultExpanded={false}
          summary={
            cutout.array
              ? t('binDesigner.cutouts.array.instances', {
                  count: arrayInstanceCount(cutout.array),
                })
              : t('binDesigner.cutouts.array.off')
          }
        >
          <CutoutArrayControls
            cutout={cutout}
            binWidth={maxWidth}
            binDepth={maxDepth}
            onUpdate={(patch) => onUpdate(cutout.id, patch)}
            onFlatten={() => onFlattenArray?.(cutout.id)}
            disabled={disabled}
          />
        </Collapsible>
      )}

      <div className="space-y-2">
        <div className="flex gap-1.5 pt-1">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            touchTarget={false}
            className="text-content-secondary"
            leftIcon={
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M7 1v12M3 4l-2 3 2 3M11 4l2 3-2 3" />
              </svg>
            }
            onClick={() => onUpdate(cutout.id, flipCutoutHorizontal(cutout))}
            disabled={disabled || cutout.locked}
            title={t('binDesigner.cutouts.flipHorizontal')}
          >
            {t('binDesigner.cutouts.flipHorizontal')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            touchTarget={false}
            className="text-content-secondary"
            leftIcon={
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M1 7h12M4 3L7 1l3 2M4 11l3 2 3-2" />
              </svg>
            }
            onClick={() => onUpdate(cutout.id, flipCutoutVertical(cutout))}
            disabled={disabled || cutout.locked}
            title={t('binDesigner.cutouts.flipVertical')}
          >
            {t('binDesigner.cutouts.flipVertical')}
          </Button>
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            fullWidth
            touchTarget={false}
            className="flex-1 text-content-secondary"
            onClick={() => onDuplicate([cutout.id])}
            disabled={disabled}
          >
            {t('common.duplicate')}
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            touchTarget={false}
            onClick={() => onRemove(cutout.id)}
            disabled={disabled}
          >
            {t('common.delete')}
          </Button>
        </div>
      </div>
    </div>
  );
}

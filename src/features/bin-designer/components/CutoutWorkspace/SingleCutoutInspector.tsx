/**
 * Single-selection body of the FloatingInspector: the shape pill plus the
 * Transform / Shape / Fit / Array / Label sections. Split out of
 * FloatingInspector to keep that file under the line cap and to isolate the
 * single-cutout property surface from the panel's positioning logic.
 */

import type { Cutout, CutoutTextSide } from '@/features/bin-designer/types';
import { TEXT_MAX_LENGTH } from '@/features/bin-designer/types';
import { useTranslation } from '@/i18n';
import { SliderInput } from '@/features/bin-designer/components/controls/SliderInput';
import { CompactNumberInput } from '@/shared/components/CompactNumberInput';
import { getSegmentClass, SEGMENT_GROUP_CLASS } from '@/shared/components/segmentedControlClasses';
import { clampRotationToBounds } from '../panel/CutoutsSection/geometry';
import { CutoutScoopControls } from './CutoutScoopControls';
import { CutoutShapeControls } from '../panel/CutoutsSection/CutoutShapeControls';
import { CutoutFitControls } from '../panel/CutoutsSection/CutoutFitControls';
import { CutoutShapeBadge } from '../panel/CutoutsSection/CutoutShapeBadge';
import {
  hasFitControls,
  formatFitSummary,
  canArray,
} from '../panel/CutoutsSection/cutoutSectionVisibility';
import type { FitCue } from '../panel/CutoutsSection/cutoutSectionVisibility';
import { CutoutArrayControls } from '../panel/CutoutsSection/CutoutArrayControls';
import { arrayInstanceCount } from '@/shared/utils/cutoutArray';
import { CollapsibleSection } from '@/shared/components/CollapsibleSection';
import { Checkbox, Input } from '@/design-system';

const SIDE_OPTIONS: readonly { readonly side: CutoutTextSide; readonly glyph: string }[] = [
  { side: 'top', glyph: '↑' },
  { side: 'bottom', glyph: '↓' },
  { side: 'left', glyph: '←' },
  { side: 'right', glyph: '→' },
] as const;

/** Effective field value, merging this cutout's live preview override. */
function getEffective<K extends keyof Cutout>(
  cutout: Cutout,
  preview: ReadonlyMap<string, Partial<Cutout>>,
  key: K
): Cutout[K] {
  const override = preview.get(cutout.id);
  if (override && key in override) return override[key] as Cutout[K];
  return cutout[key];
}

interface SingleCutoutInspectorProps {
  readonly cutout: Cutout;
  readonly preview: ReadonlyMap<string, Partial<Cutout>>;
  readonly binWidth: number;
  readonly binDepth: number;
  readonly maxCutDepth: number;
  readonly onUpdate: (id: string, updates: Partial<Cutout>) => void;
  readonly onFitCue?: (cue: FitCue) => void;
  readonly onFlattenArray?: (id: string) => void;
  readonly disabled: boolean;
}

export function SingleCutoutInspector({
  cutout,
  preview,
  binWidth,
  binDepth,
  maxCutDepth,
  onUpdate,
  onFitCue,
  onFlattenArray,
  disabled,
}: SingleCutoutInspectorProps) {
  const t = useTranslation();
  return (
    <div className="space-y-2.5">
      <div className="border-b border-stroke-subtle pb-2">
        <CutoutShapeBadge cutout={cutout} />
      </div>
      <CollapsibleSection title={t('binDesigner.cutouts.section.transform')} variant="small">
        <div className="space-y-1.5">
          <div className="grid grid-cols-2 gap-1">
            <CompactNumberInput
              label="X"
              value={getEffective(cutout, preview, 'x')}
              onChange={(x) => onUpdate(cutout.id, { x })}
              min={0}
              max={binWidth - cutout.width}
              step={0.5}
              unit="mm"
              disabled={disabled}
            />
            <CompactNumberInput
              label="Y"
              value={getEffective(cutout, preview, 'y')}
              onChange={(y) => onUpdate(cutout.id, { y })}
              min={0}
              max={binDepth - cutout.depth}
              step={0.5}
              unit="mm"
              disabled={disabled}
            />
            <CompactNumberInput
              label="W"
              value={getEffective(cutout, preview, 'width')}
              onChange={(width) => onUpdate(cutout.id, { width })}
              min={2}
              max={binWidth}
              step={0.5}
              unit="mm"
              disabled={disabled}
            />
            <CompactNumberInput
              label="H"
              value={getEffective(cutout, preview, 'depth')}
              onChange={(depth) => onUpdate(cutout.id, { depth })}
              min={2}
              max={binDepth}
              step={0.5}
              unit="mm"
              disabled={disabled}
            />
          </div>
          <SliderInput
            label={t('binDesigner.cutouts.rotation')}
            value={getEffective(cutout, preview, 'rotation')}
            onChange={(rotation) => {
              const clamped = clampRotationToBounds(cutout, rotation, binWidth, binDepth);
              onUpdate(cutout.id, { rotation: clamped });
            }}
            min={0}
            max={359}
            step={1}
            unit="°"
            disabled={disabled}
          />
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
        </div>
      </CollapsibleSection>

      <CollapsibleSection title={t('binDesigner.cutouts.section.shape')} variant="small">
        <div className="space-y-1.5">
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
            maxWidth={binWidth}
            maxDepth={binDepth}
            onUpdate={(patch) => onUpdate(cutout.id, patch)}
            disabled={disabled}
          />
          <CutoutScoopControls
            key={cutout.id}
            cutout={cutout}
            preview={preview.get(cutout.id)}
            disabled={disabled}
            onUpdate={(patch) => onUpdate(cutout.id, patch)}
          />
        </div>
      </CollapsibleSection>

      {hasFitControls(cutout) && (
        <CollapsibleSection
          title={t('binDesigner.cutouts.section.fit')}
          variant="small"
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
        </CollapsibleSection>
      )}

      {canArray(cutout) && (
        <CollapsibleSection
          title={t('binDesigner.cutouts.section.array')}
          variant="small"
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
            onUpdate={(patch) => onUpdate(cutout.id, patch)}
            onFlatten={() => onFlattenArray?.(cutout.id)}
            disabled={disabled}
          />
        </CollapsibleSection>
      )}

      <CollapsibleSection
        title={t('binDesigner.cutouts.section.label')}
        variant="small"
        defaultExpanded={false}
      >
        <CutoutEngraveLabelControls
          key={`${cutout.id}-text`}
          cutout={cutout}
          disabled={disabled}
          onUpdate={(patch) => onUpdate(cutout.id, patch)}
        />
      </CollapsibleSection>
    </div>
  );
}

interface CutoutEngraveLabelControlsProps {
  readonly cutout: Cutout;
  readonly disabled: boolean;
  readonly onUpdate: (patch: Partial<Cutout>) => void;
}

/**
 * Compact engraved-label controls: toggle, text input, and side picker. Mode +
 * font + depth use the design-level `textDefaults`; per-instance overrides are
 * deferred to a follow-up.
 */
function CutoutEngraveLabelControls({
  cutout,
  disabled,
  onUpdate,
}: CutoutEngraveLabelControlsProps) {
  const t = useTranslation();
  const enabled = cutout.engraveLabel === true;
  const side = cutout.textSide ?? 'top';
  return (
    <div className="flex flex-col gap-1.5 border-t border-stroke-subtle pt-2">
      <label className="flex items-center gap-2 text-xs text-content-secondary cursor-pointer">
        <Checkbox
          checked={enabled}
          onChange={(checked) => onUpdate({ engraveLabel: checked })}
          disabled={disabled}
          aria-label={t('binDesigner.cutoutEngraveLabel')}
        />
        <span>{t('binDesigner.cutoutEngraveLabel')}</span>
      </label>
      {enabled && (
        <>
          <Input
            type="text"
            size="sm"
            value={cutout.label}
            maxLength={TEXT_MAX_LENGTH}
            onChange={(e) => onUpdate({ label: e.target.value })}
            disabled={disabled}
            placeholder={t('binDesigner.cutoutEngraveLabelPlaceholder')}
            aria-label={t('binDesigner.cutoutEngraveLabel')}
          />
          <div>
            <span className="mb-1 block text-[10px] uppercase tracking-wide text-content-tertiary">
              {t('binDesigner.cutoutTextSide')}
            </span>
            <div
              role="group"
              aria-label={t('binDesigner.cutoutTextSide')}
              className={SEGMENT_GROUP_CLASS}
            >
              {SIDE_OPTIONS.map(({ side: opt, glyph }) => (
                <button
                  key={opt}
                  type="button"
                  disabled={disabled}
                  onClick={() => onUpdate({ textSide: opt })}
                  aria-pressed={side === opt}
                  aria-label={t(`binDesigner.cutoutTextSide.${opt}`)}
                  title={t(`binDesigner.cutoutTextSide.${opt}`)}
                  className={`flex-1 leading-none ${getSegmentClass(side === opt)}`}
                >
                  {glyph}
                </button>
              ))}
            </div>
          </div>
          <p className="text-[10px] text-content-tertiary">
            {t('binDesigner.cutoutEngraveLabelEngraveOnly')}
          </p>
        </>
      )}
    </div>
  );
}

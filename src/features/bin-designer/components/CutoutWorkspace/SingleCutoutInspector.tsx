/**
 * Single-selection body of the cutout inspector: the shape pill plus the
 * Transform / Shape / Fit / Array / Label sections. Rendered by InspectorContent
 * inside the docked InspectorDock; isolated here to keep files under the line cap.
 */

import type {
  Cutout,
  CutoutArrayConfig,
  CutoutTextSide,
  TextMode,
} from '@/features/bin-designer/types';
import { TEXT_MAX_LENGTH } from '@/features/bin-designer/types';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useTranslation } from '@/i18n';
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
import { Button, Collapsible, Input, SliderInput } from '@/design-system';

const SIDE_OPTIONS: readonly CutoutTextSide[] = ['top', 'bottom', 'left', 'right'] as const;
/** Cutout labels support recessed + raised text; through-cut would punch the floor. */
const CUTOUT_TEXT_MODES: readonly Extract<TextMode, 'engrave' | 'emboss'>[] = [
  'engrave',
  'emboss',
] as const;

/**
 * Compact at-a-glance array summary, e.g. `6×3 · 18` (grid) or `⟳ 8` (radial).
 * Numbers + symbols only, so it reads identically across locales.
 */
function formatArraySummary(config: CutoutArrayConfig): string {
  const count = arrayInstanceCount(config);
  if (config.mode === 'radial') return `⟳ ${count}`;
  return `${config.cols}×${config.rows} · ${count}`;
}

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
    <>
      <div className="-mx-4 border-b border-stroke-subtle px-4 py-3">
        <CutoutShapeBadge cutout={cutout} />
      </div>
      <div className="-mx-4 border-b border-stroke-subtle px-4 pt-2 pb-3">
        <Collapsible title={t('binDesigner.cutouts.section.transform')} size="sm">
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
            <CompactNumberInput
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
            <CompactNumberInput
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
        </Collapsible>
      </div>

      <div className="-mx-4 border-b border-stroke-subtle px-4 pt-2 pb-3">
        <Collapsible title={t('binDesigner.cutouts.section.shape')} size="sm">
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
        </Collapsible>
      </div>

      {hasFitControls(cutout) && (
        <div className="-mx-4 border-b border-stroke-subtle px-4 pt-2 pb-3">
          <Collapsible
            title={t('binDesigner.cutouts.section.fit')}
            size="sm"
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
        </div>
      )}

      {canArray(cutout) && (
        <div className="-mx-4 border-b border-stroke-subtle px-4 pt-2 pb-3">
          <Collapsible
            title={t('binDesigner.cutouts.section.array')}
            size="sm"
            summary={
              cutout.array ? formatArraySummary(cutout.array) : t('binDesigner.cutouts.array.off')
            }
          >
            <CutoutArrayControls
              cutout={cutout}
              binWidth={binWidth}
              binDepth={binDepth}
              onUpdate={(patch) => onUpdate(cutout.id, patch)}
              onFlatten={() => onFlattenArray?.(cutout.id)}
              disabled={disabled}
            />
          </Collapsible>
        </div>
      )}

      <div className="-mx-4 border-b border-stroke-subtle px-4 pt-2 pb-3">
        <Collapsible title={t('binDesigner.cutouts.section.label')} size="sm">
          <CutoutEngraveLabelControls
            key={`${cutout.id}-text`}
            cutout={cutout}
            disabled={disabled}
            onUpdate={(patch) => onUpdate(cutout.id, patch)}
          />
        </Collapsible>
      </div>
    </>
  );
}

interface CutoutEngraveLabelControlsProps {
  readonly cutout: Cutout;
  readonly disabled: boolean;
  readonly onUpdate: (patch: Partial<Cutout>) => void;
}

/**
 * Compact label controls: text input, style (engrave/emboss) picker, and side
 * picker. Style + font + depth use the design-level `textDefaults`; per-instance
 * overrides are deferred to a follow-up. Through-cut is omitted here — it would
 * punch bin-top text through the floor, so the generator degrades it to engrave.
 */
function CutoutEngraveLabelControls({
  cutout,
  disabled,
  onUpdate,
}: CutoutEngraveLabelControlsProps) {
  const t = useTranslation();
  const side = cutout.textSide ?? 'top';
  const textMode = useDesignerStore((s) => s.params.textDefaults.mode);
  const setTextDefaults = useDesignerStore((s) => s.setTextDefaults);
  // Through-cut isn't offered for cutouts; show it as engrave so the picker
  // reflects what the generator will actually produce.
  const effectiveMode: 'engrave' | 'emboss' = textMode === 'emboss' ? 'emboss' : 'engrave';

  const handleTextChange = (text: string) => {
    onUpdate({ label: text, engraveLabel: text.length > 0 });
  };

  return (
    <div className="space-y-2">
      <Input
        type="text"
        size="sm"
        value={cutout.label}
        maxLength={TEXT_MAX_LENGTH}
        onChange={(e) => handleTextChange(e.target.value)}
        disabled={disabled}
        placeholder={t('binDesigner.cutoutEngraveLabelPlaceholder')}
        aria-label={t('binDesigner.cutoutEngraveLabel')}
      />
      <div role="group" aria-label={t('binDesigner.textMode')} className={SEGMENT_GROUP_CLASS}>
        {CUTOUT_TEXT_MODES.map((opt) => (
          <Button
            key={opt}
            type="button"
            variant="ghost"
            disabled={disabled}
            onClick={() => setTextDefaults({ mode: opt })}
            aria-pressed={effectiveMode === opt}
            className={`flex-1 py-0.5 text-[10px] leading-none ${getSegmentClass(effectiveMode === opt)}`}
          >
            {t(`binDesigner.textMode.${opt}`)}
          </Button>
        ))}
      </div>
      <div
        role="group"
        aria-label={t('binDesigner.cutoutTextSide')}
        className={SEGMENT_GROUP_CLASS}
      >
        {SIDE_OPTIONS.map((opt) => (
          <Button
            key={opt}
            type="button"
            variant="ghost"
            disabled={disabled}
            onClick={() => onUpdate({ textSide: opt })}
            aria-pressed={side === opt}
            className={`flex-1 py-0.5 text-[10px] leading-none ${getSegmentClass(side === opt)}`}
          >
            {t(`binDesigner.cutoutTextSide.${opt}`)}
          </Button>
        ))}
      </div>
    </div>
  );
}

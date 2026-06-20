/**
 * Single-selection body of the cutout inspector: the shape pill plus the
 * Transform / Shape / Fit / Array / Label sections. Rendered by InspectorContent
 * inside the docked InspectorDock; isolated here to keep files under the line cap.
 */

import type {
  Cutout,
  CutoutArrayConfig,
  CutoutTextAnchor,
  TextMode,
} from '@/features/bin-designer/types';
import { TEXT_MAX_LENGTH } from '@/features/bin-designer/types';
import { useDesignerStore } from '@/features/bin-designer/store';
import { resolveCutoutTextAnchor } from '@/shared/utils/cutoutLabel';
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

/** 3×3 anchor grid in reading order; the glyph hints the position, the
 *  i18n'd aria-label names it. `center` = label sits over the cutout face. */
const ANCHOR_GRID: readonly { anchor: CutoutTextAnchor; glyph: string }[] = [
  { anchor: 'top-left', glyph: '↖' },
  { anchor: 'top', glyph: '↑' },
  { anchor: 'top-right', glyph: '↗' },
  { anchor: 'left', glyph: '←' },
  { anchor: 'center', glyph: '▣' },
  { anchor: 'right', glyph: '→' },
  { anchor: 'bottom-left', glyph: '↙' },
  { anchor: 'bottom', glyph: '↓' },
  { anchor: 'bottom-right', glyph: '↘' },
] as const;
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
            binWidth={binWidth}
            binDepth={binDepth}
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
  readonly binWidth: number;
  readonly binDepth: number;
  readonly disabled: boolean;
  readonly onUpdate: (patch: Partial<Cutout>) => void;
}

/**
 * Compact label controls: text input, style (engrave/emboss) picker, 9-point
 * anchor grid, free X/Y nudge, and label angle. Style + font + depth use the
 * design-level `textDefaults`; placement (anchor/offset/angle) is per-cutout and
 * flows through `cutoutLabelPlacement` to the engraved geometry. Through-cut is
 * omitted — it would punch bin-top text through the floor, so the generator
 * degrades it to engrave.
 */
function CutoutEngraveLabelControls({
  cutout,
  binWidth,
  binDepth,
  disabled,
  onUpdate,
}: CutoutEngraveLabelControlsProps) {
  const t = useTranslation();
  const anchor = resolveCutoutTextAnchor(cutout);
  const offset = cutout.textOffset ?? { x: 0, y: 0 };
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
      <div className="space-y-1">
        <span className="text-[10px] text-text-muted">{t('binDesigner.cutoutTextAnchor')}</span>
        <div
          role="group"
          aria-label={t('binDesigner.cutoutTextAnchor')}
          className="grid w-fit grid-cols-3 gap-0.5"
        >
          {ANCHOR_GRID.map(({ anchor: opt, glyph }) => (
            <Button
              key={opt}
              type="button"
              variant="ghost"
              disabled={disabled}
              onClick={() => onUpdate({ textAnchor: opt })}
              aria-pressed={anchor === opt}
              aria-label={t(`binDesigner.cutoutTextAnchor.${opt}`)}
              className={`h-6 w-6 p-0 text-xs leading-none ${getSegmentClass(anchor === opt)}`}
            >
              {glyph}
            </Button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1">
        <CompactNumberInput
          label={t('binDesigner.cutoutTextOffsetX')}
          value={offset.x}
          onChange={(x) => onUpdate({ textOffset: { x, y: offset.y } })}
          min={-binWidth}
          max={binWidth}
          step={0.5}
          unit="mm"
          disabled={disabled}
        />
        <CompactNumberInput
          label={t('binDesigner.cutoutTextOffsetY')}
          value={offset.y}
          onChange={(y) => onUpdate({ textOffset: { x: offset.x, y } })}
          min={-binDepth}
          max={binDepth}
          step={0.5}
          unit="mm"
          disabled={disabled}
        />
        <CompactNumberInput
          label={t('binDesigner.cutoutTextAngle')}
          value={cutout.textAngle ?? 0}
          onChange={(angle) => onUpdate({ textAngle: ((angle % 360) + 360) % 360 })}
          min={0}
          max={359}
          step={1}
          unit="°"
          disabled={disabled}
        />
      </div>
    </div>
  );
}

/**
 * Compact label controls: how the label is realised (engraved into the board
 * or carried on a swappable plate), the caption, the 9-point anchor grid and a
 * free X/Y nudge.
 *
 * Anchor and nudge are shared by both modes: they place the label either way.
 * The rest is mode-specific: engraving takes style, angle, relief depth and
 * font size from the design-level `textDefaults`, while a socket takes plate
 * width, icon and a horizontal/vertical toggle. Through-cut is offered for
 * neither: it would punch bin-top text through the floor, so the generator
 * degrades it to engrave.
 */

import type {
  Cutout,
  CutoutLabelMode,
  CutoutTextAnchor,
  TextMode,
} from '@/features/bin-designer/types';
import {
  CUTOUT_LABEL_MODES,
  TEXT_MAX_LENGTH,
  withExactLabelSize,
} from '@/features/bin-designer/types';
import { useDesignerStore } from '@/features/bin-designer/store';
import {
  cutoutLabelPlacement,
  DEFAULT_TEXT_ELEMENT_SIZE,
  expandBandToInterior,
  fitLabelRoom,
  hasExplicitLabelSize,
  resolveCutoutTextAnchor,
  withCenteredTextPlacement,
} from '@/shared/utils/cutoutLabel';
import { useTranslation } from '@/i18n';
import { CompactNumberInput } from '@/shared/components/CompactNumberInput';
import { getSegmentClass, SEGMENT_GROUP_CLASS } from '@/shared/components/segmentedControlClasses';
import { CutoutRepeatLabels } from './CutoutRepeatLabels';
import { LabelSizeControl } from '../controls';
import { Button, Input } from '@/design-system';
import { CutoutSocketControls } from './CutoutSocketControls';
import { useCutoutSocketPlan } from '@/features/bin-designer/hooks/useCutoutSocketPlan';
import { TYPE_BOUNDS } from '../panel/TypeSection/useTypeSection';
import { fitLabelFontSize } from '../panel/CutoutsSection/renderer/cutoutLabelFit';

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

interface CutoutEngraveLabelControlsProps {
  readonly cutout: Cutout;
  readonly binWidth: number;
  readonly binDepth: number;
  readonly disabled: boolean;
  readonly onUpdate: (patch: Partial<Cutout>) => void;
}

export function CutoutEngraveLabelControls({
  cutout,
  binWidth,
  binDepth,
  disabled,
  onUpdate,
}: CutoutEngraveLabelControlsProps) {
  const t = useTranslation();
  const socketPlan = useCutoutSocketPlan();
  const anchor = resolveCutoutTextAnchor(cutout);
  const offset = cutout.textOffset ?? { x: 0, y: 0 };
  // A text element IS its caption: no plate to socket, no anchor to pick, no
  // separate angle — the element's own transform does all of that.
  const isTextElement = cutout.shape === 'text';
  const labelMode: CutoutLabelMode =
    cutout.labelMode === 'socket' && !isTextElement ? 'socket' : 'engrave';
  const isSocket = labelMode === 'socket';
  const textDefaults = useDesignerStore((s) => s.params.textDefaults);
  const setTextDefaults = useDesignerStore((s) => s.setTextDefaults);
  const setCutoutArray = useDesignerStore((s) => s.setCutoutArray);
  const { mode: textMode, depth: textDepth } = textDefaults;

  // The size an explicit request would print at, mirrored from the engraver's
  // own fit so the seed and the limited-note tell the truth. Also the value
  // shown while Auto is active would seed from.
  const explicitSize = hasExplicitLabelSize(cutout);
  const requestedSize = cutout.textStyle?.fixedSize ?? textDefaults.fixedSize;
  const trimmedLabel = cutout.label.trim();
  const placement =
    trimmedLabel === ''
      ? null
      : cutoutLabelPlacement(withCenteredTextPlacement(cutout), binWidth, binDepth);
  let renderedSize: number | null = null;
  if (placement) {
    const banded = explicitSize
      ? expandBandToInterior(placement, binWidth, binDepth)
      : { ...placement, ...fitLabelRoom(placement.availW, placement.availD, cutout.array) };
    renderedSize = fitLabelFontSize(trimmedLabel, banded, textDefaults, cutout);
  }
  const sizeValue = explicitSize ? requestedSize : cutout.textStyle?.fontSizeOverride;
  const sizeLimited = explicitSize && renderedSize !== null && renderedSize + 0.05 < requestedSize;
  const setLabelSize = (size: number | null) => {
    onUpdate({ textStyle: withExactLabelSize(cutout.textStyle, size) });
  };
  // Through-cut isn't offered for cutouts; show it as engrave so the picker
  // reflects what the generator will actually produce.
  const effectiveMode: 'engrave' | 'emboss' = textMode === 'emboss' ? 'emboss' : 'engrave';

  // Only the engraved path keys off an empty caption: a blank plate is a
  // legitimate design (print the socket now, letter the plate later), so
  // clearing the text must not take the pocket away with it.
  const handleTextChange = (text: string) => {
    onUpdate(isSocket ? { label: text } : { label: text, engraveLabel: text.length > 0 });
  };

  // Switching to socket mode asserts the label switch too: the section is
  // reachable from a cutout that never had an engraving.
  const handleModeChange = (mode: CutoutLabelMode) => {
    onUpdate(mode === 'socket' ? { labelMode: 'socket', engraveLabel: true } : { labelMode: mode });
  };

  return (
    <div className="space-y-2">
      {!isTextElement && (
        <div
          role="group"
          aria-label={t('binDesigner.cutoutLabelMode')}
          className={SEGMENT_GROUP_CLASS}
        >
          {CUTOUT_LABEL_MODES.map((opt) => (
            <Button
              key={opt}
              type="button"
              variant="ghost"
              disabled={disabled}
              onClick={() => handleModeChange(opt)}
              aria-pressed={labelMode === opt}
              className={`flex-1 py-0.5 text-micro leading-none ${getSegmentClass(labelMode === opt)}`}
            >
              {t(`binDesigner.cutoutLabelMode.${opt}`)}
            </Button>
          ))}
        </div>
      )}
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
      {/* A repeat can caption each hole separately, but only when it engraves:
          the socket planner cuts ONE pocket spanning the whole array, so a
          socket repeat has a single plate to letter. Say so rather than
          offering a list the plate cannot carry. */}
      {cutout.array &&
        (isSocket ? (
          <p className="text-micro leading-snug text-content-tertiary">
            {t('binDesigner.cutouts.repeat.labels.socketNote')}
          </p>
        ) : (
          <CutoutRepeatLabels
            cutout={cutout}
            disabled={disabled}
            onChange={(config) => setCutoutArray(cutout.id, config)}
          />
        ))}
      {isSocket && (
        <CutoutSocketControls
          cutout={cutout}
          plan={socketPlan}
          disabled={disabled}
          onUpdate={onUpdate}
        />
      )}
      {!isSocket && (
        <>
          <div role="group" aria-label={t('binDesigner.textMode')} className={SEGMENT_GROUP_CLASS}>
            {CUTOUT_TEXT_MODES.map((opt) => (
              <Button
                key={opt}
                type="button"
                variant="ghost"
                disabled={disabled}
                onClick={() => setTextDefaults({ mode: opt })}
                aria-pressed={effectiveMode === opt}
                className={`flex-1 py-0.5 text-micro leading-none ${getSegmentClass(effectiveMode === opt)}`}
              >
                {t(`binDesigner.textMode.${opt}`)}
              </Button>
            ))}
          </div>
          <CompactNumberInput
            label={t(
              effectiveMode === 'emboss'
                ? 'binDesigner.cutoutTextDepth.emboss'
                : 'binDesigner.cutoutTextDepth.engrave'
            )}
            value={textDepth}
            onChange={(depth) => setTextDefaults({ depth })}
            min={TYPE_BOUNDS.depth.min}
            max={TYPE_BOUNDS.depth.max}
            step={TYPE_BOUNDS.depth.step}
            unit="mm"
            disabled={disabled}
            info={t('binDesigner.cutoutTextDepth.hint')}
          />
        </>
      )}
      {!isTextElement && (
        <div className="space-y-1">
          <span className="text-micro text-text-muted">{t('binDesigner.cutoutTextAnchor')}</span>
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
                // A socket sits over solid material, and `center` sits over the
                // cutout's own cavity, so there would be nothing to cut it into.
                disabled={disabled || (isSocket && opt === 'center')}
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
      )}
      {!isTextElement && (
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
          {!isSocket && (
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
          )}
        </div>
      )}
      {!isSocket && (
        <>
          <LabelSizeControl
            variant="exact"
            value={isTextElement ? (sizeValue ?? DEFAULT_TEXT_ELEMENT_SIZE) : sizeValue}
            onChange={setLabelSize}
            min={TYPE_BOUNDS.fixedSize.min}
            max={TYPE_BOUNDS.fixedSize.max}
            manualSeed={renderedSize ?? undefined}
            allowAuto={!isTextElement}
            disabled={disabled}
          />
          {sizeLimited && renderedSize !== null && (
            <p role="alert" className="text-micro leading-snug text-warning">
              {t('binDesigner.textSizeLimited', { size: renderedSize.toFixed(1) })}
            </p>
          )}
        </>
      )}
    </div>
  );
}

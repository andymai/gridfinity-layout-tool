/**
 * Single-selection body of the cutout inspector: the shape pill plus the
 * Transform / Shape / Fit / Array / Label sections. Rendered by InspectorContent
 * inside the docked InspectorDock; isolated here to keep files under the line cap.
 */

import type { Cutout, CutoutArrayConfig } from '@/features/bin-designer/types';
import { LEAN_SHAPES, MAX_CUTOUT_LEAN_DEG, snapKnifeRotation } from '@/features/bin-designer/types';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useTranslation } from '@/i18n';
import { clampRotationToBounds } from '../panel/CutoutsSection/geometry';
import { resizeAroundCenter } from '../panel/CutoutsSection/cutoutHelpers';
import { cutoutDepthShortfall } from '../panel/CutoutsSection/cutoutDepthShortfall';
import { CutoutScoopControls } from './CutoutScoopControls';
import { CutoutShapeControls } from '../panel/CutoutsSection/CutoutShapeControls';
import { CutoutFitControls } from '../panel/CutoutsSection/CutoutFitControls';
import { CutoutShapeBadge } from '../panel/CutoutsSection/CutoutShapeBadge';
import {
  hasFitControls,
  hasKnifeControls,
  formatFitSummary,
  repeatBlockedReason,
} from '../panel/CutoutsSection/cutoutSectionVisibility';
import type { FitCue } from '../panel/CutoutsSection/cutoutSectionVisibility';
import { CutoutArrayControls } from '../panel/CutoutsSection/CutoutArrayControls';
import { CutoutColorControls } from './CutoutColorControls';
import { CutoutKnifeControls } from './CutoutKnifeControls';
import { CutoutEngraveLabelControls } from './CutoutEngraveLabelControls';
import { arrayInstanceCount } from '@/shared/utils/cutoutArray';
import { Collapsible, SliderInput, NumberField } from '@/design-system';

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
  /**
   * The host cuts clean through, so `cutDepth` and the scoop fillets are inert on
   * a lid's plate: there is no floor for a pocket to stop at or a fillet to curve
   * against. Hidden rather than disabled, because a disabled stepper still shows a
   * number the geometry does not use.
   */
  readonly throughOnly?: boolean;
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
  throughOnly = false,
  onUpdate,
  onFitCue,
  onFlattenArray,
  disabled,
}: SingleCutoutInspectorProps) {
  const t = useTranslation();
  const ungroupCutouts = useDesignerStore((s) => s.ungroupCutouts);
  const setCutoutArray = useDesignerStore((s) => s.setCutoutArray);
  // maxCutDepth is the remaining fill on a bin host; a through-cut host has no
  // depth to fall short of.
  // The fields display preview-merged values, so anything computed FROM them
  // has to read the same box — a center taken from the stored x/width while an
  // override is live would re-anchor on a position the user cannot see.
  const live = { ...cutout, ...preview.get(cutout.id) };
  const depthShortfall = throughOnly
    ? null
    : cutoutDepthShortfall(live, binWidth, binDepth, maxCutDepth);
  return (
    <>
      <div className="-mx-4 border-b border-stroke-subtle px-4 py-3">
        <CutoutShapeBadge cutout={cutout} />
      </div>
      <div className="-mx-4 border-b border-stroke-subtle px-4 pt-2 pb-3">
        <Collapsible title={t('binDesigner.cutouts.section.transform')} size="sm">
          <div className="grid grid-cols-2 gap-1">
            {/* A cutout wider than the board leaves no valid offset, and a
                negative ceiling would report a nonsense aria-valuemax — pin the
                axis to 0 until the board grows or the cutout shrinks. */}
            <NumberField
              label="X"
              value={getEffective(cutout, preview, 'x')}
              onChange={(x) => onUpdate(cutout.id, { x })}
              min={0}
              max={Math.max(0, binWidth - cutout.width)}
              step={0.5}
              unit="mm"
              disabled={disabled}
            />
            <NumberField
              label="Y"
              value={getEffective(cutout, preview, 'y')}
              onChange={(y) => onUpdate(cutout.id, { y })}
              min={0}
              max={Math.max(0, binDepth - cutout.depth)}
              step={0.5}
              unit="mm"
              disabled={disabled}
            />
            {/* softMax: W/H hold a measured dimension, so a typed value past the
                board is kept and the off-board banner offers to grow the bin
                (#3061) — truncating it silently shipped wrong-sized pockets.
                Anchored on the center, matching every other size control here
                (polygon across-flats, circle diameter, knife presets): a typed
                size is a measurement of the thing going in the pocket, not an
                instruction to move it. Handle drags stay edge-anchored — that
                edge is what the cursor is holding. */}
            <NumberField
              label="W"
              value={getEffective(cutout, preview, 'width')}
              onChange={(width) => onUpdate(cutout.id, resizeAroundCenter(live, { width }))}
              min={2}
              max={binWidth}
              softMax
              step={0.5}
              unit="mm"
              disabled={
                disabled ||
                cutout.shape === 'mesh' ||
                cutout.shape === 'text' ||
                cutout.shape === 'knifeSlot'
              }
            />
            <NumberField
              label="H"
              value={getEffective(cutout, preview, 'depth')}
              onChange={(depth) => onUpdate(cutout.id, resizeAroundCenter(live, { depth }))}
              min={2}
              max={binDepth}
              softMax
              step={0.5}
              unit="mm"
              disabled={
                disabled ||
                cutout.shape === 'mesh' ||
                cutout.shape === 'text' ||
                cutout.shape === 'knifeSlot'
              }
            />
            <NumberField
              label={t('binDesigner.cutouts.rotation')}
              value={getEffective(cutout, preview, 'rotation')}
              onChange={(rotation) => {
                // A knife slot only works wall-aligned, so its angle snaps to a
                // quarter turn and skips the fit clamp — a blade too long to lie
                // across the bin lands off the board (where the grow banner takes
                // it) rather than being bent to a broken off-axis angle.
                if (cutout.shape === 'knifeSlot') {
                  onUpdate(cutout.id, { rotation: snapKnifeRotation(rotation) });
                  return;
                }
                const clamped = clampRotationToBounds(cutout, rotation, binWidth, binDepth);
                onUpdate(cutout.id, { rotation: clamped });
              }}
              min={0}
              max={359}
              step={cutout.shape === 'knifeSlot' ? 90 : 1}
              unit="°"
              disabled={disabled}
            />
            {/* A text element has no cavity, so neither the depth field nor
                the through-cut hint applies to it. */}
            {cutout.shape !== 'text' &&
              (throughOnly ? (
                <p className="text-xs text-content-tertiary">
                  {t('binDesigner.cutouts.throughDepthHint', {
                    depth: maxCutDepth.toFixed(1),
                  })}
                </p>
              ) : (
                <NumberField
                  label={t('binDesigner.cutouts.cutDepth')}
                  value={cutout.cutDepth}
                  onChange={(cutDepth) => onUpdate(cutout.id, { cutDepth })}
                  min={0.5}
                  max={maxCutDepth}
                  step={0.5}
                  unit="mm"
                  disabled={disabled}
                />
              ))}
            {depthShortfall && (
              <p role="alert" className="pt-0.5 text-label leading-snug text-warning">
                {t('binDesigner.cutouts.depthShortfall', {
                  achievable: depthShortfall.achievable.toFixed(1),
                  requested: depthShortfall.requested.toFixed(1),
                })}
              </p>
            )}
          </div>
        </Collapsible>
      </div>

      {/* A text element's shape IS its caption — sizing lives in the Label
          section, so an empty Shape section would only puzzle. */}
      {cutout.shape !== 'text' && (
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
              {LEAN_SHAPES.includes(cutout.shape) && !throughOnly && (
                <div className="space-y-0.5">
                  <SliderInput
                    label={t('binDesigner.cutouts.lean')}
                    value={cutout.leanDeg ?? 0}
                    onChange={(leanDeg) =>
                      onUpdate(cutout.id, { leanDeg: leanDeg === 0 ? undefined : leanDeg })
                    }
                    min={-MAX_CUTOUT_LEAN_DEG}
                    max={MAX_CUTOUT_LEAN_DEG}
                    step={1}
                    unit="°"
                    disabled={disabled}
                  />
                  {(cutout.leanDeg ?? 0) !== 0 && (
                    <p className="text-micro text-text-muted">
                      {t('binDesigner.cutouts.leanHint')}
                    </p>
                  )}
                </div>
              )}
              {cutout.shape !== 'mesh' && !throughOnly && (
                <CutoutScoopControls
                  key={cutout.id}
                  cutout={cutout}
                  preview={preview.get(cutout.id)}
                  disabled={disabled}
                  onUpdate={(patch) => onUpdate(cutout.id, patch)}
                />
              )}
            </div>
          </Collapsible>
        </div>
      )}

      {/* Directly under Shape: for a knife slot these measurements ARE the
          shape — width, thickness and depth are all derived from them. */}
      {hasKnifeControls(cutout) && (
        <div className="-mx-4 border-b border-stroke-subtle px-4 pt-2 pb-3">
          <Collapsible title={t('binDesigner.cutouts.section.knife')} size="sm">
            <CutoutKnifeControls
              key={cutout.id}
              cutout={cutout}
              binWidth={binWidth}
              binDepth={binDepth}
              throughOnly={throughOnly}
              disabled={disabled}
              onUpdate={(patch) => onUpdate(cutout.id, patch)}
            />
          </Collapsible>
        </div>
      )}

      {/* Above Color and Fit: repeating a shape is a placement decision, so it
          belongs next to the two sections used while placing one. */}
      <div className="-mx-4 border-b border-stroke-subtle px-4 pt-2 pb-3">
        <Collapsible
          title={t('binDesigner.cutouts.section.repeat')}
          size="sm"
          summary={
            cutout.array ? formatArraySummary(cutout.array) : t('binDesigner.cutouts.repeat.empty')
          }
        >
          <CutoutArrayControls
            box={live}
            array={cutout.array}
            binWidth={binWidth}
            binDepth={binDepth}
            onChange={(config) => setCutoutArray(cutout.id, config)}
            onFlatten={() => onFlattenArray?.(cutout.id)}
            disabled={disabled}
            blockedReason={repeatBlockedReason(cutout)}
            onUngroup={() => ungroupCutouts([cutout.id])}
          />
        </Collapsible>
      </div>

      {/* Colour is bin-only and cavity-only. `applyLidCutouts` tags every hole
          with the flat `FeatureTag.CUTOUT` rather than a per-cutout colour tag,
          so on a lid the swatch would silently switch the design into
          multi-colour mode for a zone nothing paints; a text element has no
          cavity to paint at all (its glyphs are the design-wide TEXT zone). */}
      {!throughOnly && cutout.shape !== 'text' && (
        <div className="-mx-4 border-b border-stroke-subtle px-4 pt-2 pb-3">
          <Collapsible title={t('binDesigner.cutouts.section.color')} size="sm">
            <CutoutColorControls
              key={cutout.id}
              ids={[cutout.id]}
              color={cutout.color}
              colorScope={cutout.colorScope}
              disabled={disabled}
            />
          </Collapsible>
        </div>
      )}

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

      {/* Ordinary cutouts have no label path on a lid (`applyLidCutouts` cuts
          holes only), but a text element IS its label — the lid pipeline
          engraves it — so the section stays for text on either host. */}
      {(!throughOnly || cutout.shape === 'text') && (
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
      )}
    </>
  );
}

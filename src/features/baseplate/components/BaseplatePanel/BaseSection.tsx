/**
 * Section 3 of the baseplate panel: connectors (when split), magnet holes,
 * solid floor, mount-down screw holes, and corner radius. While stacking,
 * magnets, the solid floor and the screws are stripped so they hide, but
 * connectors stay reachable (dovetail styles stack fine) and corner rounding
 * stays too, since a radius now shapes the stacked tiles. The group only
 * renders when it still has content, so it never shows as an empty collapsible
 * group.
 */

import { useSettingsStore } from '@/core/store/settings';
import {
  SOLID_FLOOR_DEFAULT_MM,
  SOLID_FLOOR_MIN_MM,
  SOLID_FLOOR_MAX_MM,
  SCREW_HOLE_DEFAULT_DIAMETER_MM,
  SCREW_HOLE_MIN_DIAMETER_MM,
  SCREW_HOLE_MAX_DIAMETER_MM,
  SCREW_HEAD_MIN_DIAMETER_MM,
  SCREW_HEAD_MAX_DIAMETER_MM,
  SCREW_COUNTERBORE_DEFAULT_DEPTH_MM,
  SCREW_COUNTERBORE_MAX_DEPTH_MM,
  SCREWS_PER_PIECE_DEFAULT,
  SCREWS_PER_PIECE_MIN,
  SCREWS_PER_PIECE_MAX,
} from '@/core/baseplateDefaults';
import { NOZZLE_BASELINE } from '@/shared/printSettings/connectorScaling';
import { resolveScrewHeadDiameter } from '@/shared/generation/screwHolePlan';
import { useFeatureFlag } from '@/shared/hooks/useFeatureFlag';
import { Checkbox } from '@/design-system/Checkbox/Checkbox';
import { useTranslation } from '@/i18n';
import { StickyGroupHeader } from '@/shared/components/StickyGroupHeader';
import { SettingsRow } from '@/shared/components/SettingsRow';
import { FeatureToggle } from '@/shared/components/FeatureToggle';
import { SegmentedControl, SliderInput } from '@/design-system';
import { useBaseplatePageStore } from '../../store/baseplatePageStore';
import { CornerRadiusControl } from './CornerRadiusControl';
import { ConnectorSampleButton } from './ConnectorSampleButton';
import { ConnectorPicker } from './ConnectorPicker';
import type { ConnectorChoice } from './ConnectorPicker';
import { isSeatedConnectorStyle } from '@/shared/types/bin';
import { maxCornerRadiusMm } from '../../utils/buildFullParams';
import type { ScrewHeadStyle, ScrewHoleParams } from '@/core/types';
import { Stepper } from '@/design-system/Stepper';
import {
  CONNECTOR_FIT_OFFSET_MIN,
  CONNECTOR_FIT_OFFSET_MAX,
  CONNECTOR_FIT_OFFSET_STEP,
} from '@/shared/constants/connectors';
import { mm } from '@/core/types';
import {
  updateBaseplateParam as updateParam,
  updateBaseplateParams as updateParams,
  useBaseplatePanelDerived,
} from './panelState';

/** Snap a connector fit offset to its step and clamp to the allowed range,
 * absorbing IEEE-754 drift from repeated ±0.05 button clicks. */
function snapConnectorFitOffset(value: number): number {
  const snapped = Math.round(value / CONNECTOR_FIT_OFFSET_STEP) * CONNECTOR_FIT_OFFSET_STEP;
  const clamped = Math.max(CONNECTOR_FIT_OFFSET_MIN, Math.min(CONNECTOR_FIT_OFFSET_MAX, snapped));
  // Round to 2dp so values like 0.30000000000000004 don't leak into the UI/cache.
  return Math.round(clamped * 100) / 100;
}

/** Signed label for the connector fit offset, e.g. "+0.05", "0". The "mm" unit is rendered outside the stepper. */
function formatConnectorFitOffset(value: number): string {
  if (value === 0) return '0';
  const sign = value > 0 ? '+' : '−'; // U+2212 minus for typographic consistency
  return `${sign}${Math.abs(value)}`;
}

export function BaseSection() {
  const t = useTranslation();
  const { baseplateParams, stackEnabled, outlineActive, totalWidthMm, totalDepthMm } =
    useBaseplatePanelDerived();
  const tiling = useBaseplatePageStore((s) => s.tiling);
  const nozzleSizeMm = useSettingsStore((s) => s.settings.printSettings.nozzleSizeMm);
  const screwHolesAvailable = useFeatureFlag('baseplate_screw_holes');

  // Render when the section has any content: connectors (split), magnets/floor
  // (not stacking), or the corner-radius control (no drawn shape) — which now
  // shows under stacking too, since a radius shapes the stacked tiles.
  if (!(tiling?.isSplit || !stackEnabled || !outlineActive)) return null;

  const screwHoles = baseplateParams.screwHoles;
  const screwHolesOn = screwHoles?.enabled === true;
  const screwDiameter = screwHoles?.diameter ?? mm(SCREW_HOLE_DEFAULT_DIAMETER_MM);
  const screwHeadStyle: ScrewHeadStyle = screwHoles?.headStyle ?? 'countersink';
  const screwsPerPiece = screwHoles?.screwsPerPiece ?? SCREWS_PER_PIECE_DEFAULT;
  const screwSummary = t('baseplate.screwHoles.summary', {
    diameter: screwDiameter,
    count: screwsPerPiece,
  });

  const updateScrewHoles = (patch: Partial<ScrewHoleParams>): void => {
    updateParam('screwHoles', {
      enabled: true,
      diameter: mm(SCREW_HOLE_DEFAULT_DIAMETER_MM),
      headStyle: 'countersink',
      ...screwHoles,
      ...patch,
    });
  };

  const summaryParts: string[] = [];
  if (!stackEnabled && baseplateParams.magnetHoles) {
    summaryParts.push(`ø${baseplateParams.magnetDiameter}mm × ${baseplateParams.magnetDepth}mm`);
  }
  if (!stackEnabled && screwHolesAvailable && screwHolesOn) {
    summaryParts.push(screwSummary);
  }

  return (
    <StickyGroupHeader
      title={t('baseplate.sectionBase')}
      summary={summaryParts.length > 0 ? summaryParts.join(' · ') : undefined}
    >
      <div className="space-y-3 px-4 py-3">
        {tiling?.isSplit && (
          <ConnectorPicker
            value={
              // Snap clip is stripped while stacking, so show it as None
              // (the effective state); the stored style returns on toggle-off.
              stackEnabled && baseplateParams.connectorStyle === 'snapClip'
                ? 'none'
                : baseplateParams.connectorNubs === true
                  ? (baseplateParams.connectorStyle ?? 'dovetail')
                  : 'none'
            }
            disabledOptions={
              stackEnabled ? { snapClip: t('baseplate.connectors.snapClipNoStack') } : undefined
            }
            onChange={(v: ConnectorChoice) => {
              if (v === 'none') {
                updateParams({ connectorNubs: false, connectorStyle: undefined });
                return;
              }
              // 'dovetail' is the default, stored as undefined.
              updateParams({
                connectorNubs: true,
                connectorStyle:
                  v === 'dovetailKey' || v === 'snapClip' || v === 'puzzle' ? v : undefined,
              });
            }}
            renderExpanded={(style) =>
              style === 'none' ? null : (
                <div className="space-y-3">
                  <SettingsRow
                    label={t('baseplate.connectorFit.label')}
                    tooltip={t('baseplate.connectorFit.info')}
                    unit="mm"
                  >
                    <Stepper
                      size="sm"
                      value={baseplateParams.connectorFitOffset ?? 0}
                      onStep={(delta) => {
                        const next = snapConnectorFitOffset(
                          (baseplateParams.connectorFitOffset ?? 0) +
                            delta * CONNECTOR_FIT_OFFSET_STEP
                        );
                        updateParam('connectorFitOffset', next === 0 ? undefined : next);
                      }}
                      min={CONNECTOR_FIT_OFFSET_MIN}
                      max={CONNECTOR_FIT_OFFSET_MAX}
                      step={CONNECTOR_FIT_OFFSET_STEP}
                      displayValue={formatConnectorFitOffset(
                        baseplateParams.connectorFitOffset ?? 0
                      )}
                      aria-label={t('baseplate.connectorFit.label')}
                    />
                  </SettingsRow>
                  {(style === 'dovetail' || style === 'puzzle') &&
                    baseplateParams.preferIdenticalPieces !== true && (
                      <Checkbox
                        checked={baseplateParams.invertDovetails === true}
                        onChange={(checked) => updateParam('invertDovetails', checked || undefined)}
                        label={t('baseplate.dovetails.invert')}
                      />
                    )}
                  {/* Both-female styles only: an integral tongue on an exterior
                      edge would protrude past the drawer-facing wall (#2866).
                      Same predicate the geometry uses, so the gate can't drift. */}
                  {isSeatedConnectorStyle(style) && (
                    <div className="space-y-1">
                      <Checkbox
                        checked={baseplateParams.connectorSlotsAllEdges === true}
                        onChange={(checked) =>
                          updateParam('connectorSlotsAllEdges', checked || undefined)
                        }
                        label={t('baseplate.connectorSlotsAllEdges')}
                      />
                      <p className="text-label leading-relaxed text-content-tertiary pl-6">
                        {t('baseplate.connectorSlotsAllEdgesHint')}
                      </p>
                    </div>
                  )}
                  <Checkbox
                    checked={baseplateParams.preferIdenticalPieces === true}
                    onChange={(checked) =>
                      updateParam('preferIdenticalPieces', checked || undefined)
                    }
                    label={t('baseplate.preferIdenticalPieces')}
                  />
                  <ConnectorSampleButton />
                  {nozzleSizeMm > NOZZLE_BASELINE && (
                    <p className="text-label leading-relaxed text-content-tertiary">
                      {t('baseplate.connectorNozzleNotice', { nozzle: nozzleSizeMm })}
                    </p>
                  )}
                </div>
              )
            }
          />
        )}
        {!stackEnabled && (
          <>
            <div className="border-t border-stroke-subtle pt-3">
              <FeatureToggle
                label={t('baseplate.magnetHoles')}
                checked={baseplateParams.magnetHoles}
                onChange={() => updateParam('magnetHoles', !baseplateParams.magnetHoles)}
                valueSummary={`ø${baseplateParams.magnetDiameter}mm × ${baseplateParams.magnetDepth}mm`}
              >
                <SliderInput
                  label={t('baseplate.magnetDiameter')}
                  value={baseplateParams.magnetDiameter}
                  onChange={(v) => updateParam('magnetDiameter', mm(v))}
                  min={1}
                  max={20}
                  step={0.1}
                  unit="mm"
                  info={t('baseplate.magnetDiameterInfo')}
                />
                <SliderInput
                  label={t('baseplate.magnetDepth')}
                  value={baseplateParams.magnetDepth}
                  onChange={(v) => updateParam('magnetDepth', mm(v))}
                  min={0.5}
                  max={10}
                  step={0.1}
                  unit="mm"
                  info={t('baseplate.magnetDepthInfo')}
                />
              </FeatureToggle>
            </div>
            <div className="border-t border-stroke-subtle pt-3">
              <FeatureToggle
                label={t('baseplate.solidFloor')}
                // Independent of magnets — the floor is added below the grid
                // (and below the magnet layer when present), keeping the
                // underside continuous. Thickness is customizable either way.
                checked={baseplateParams.solidFloor === true}
                onChange={() => updateParam('solidFloor', !baseplateParams.solidFloor)}
                primaryControls={
                  <SliderInput
                    label={t('baseplate.solidFloorThickness')}
                    value={baseplateParams.solidFloorThickness ?? SOLID_FLOOR_DEFAULT_MM}
                    onChange={(v) => updateParam('solidFloorThickness', mm(v))}
                    min={SOLID_FLOOR_MIN_MM}
                    max={SOLID_FLOOR_MAX_MM}
                    step={0.1}
                    unit="mm"
                    info={t('baseplate.solidFloorHeightNote')}
                  />
                }
              />
            </div>
            {screwHolesAvailable && (
              <div className="border-t border-stroke-subtle pt-3">
                <FeatureToggle
                  label={t('baseplate.screwHoles.label')}
                  checked={screwHolesOn}
                  onChange={() => updateScrewHoles({ enabled: !screwHolesOn })}
                  valueSummary={screwSummary}
                  primaryControls={
                    <p className="text-label leading-relaxed text-content-tertiary">
                      {t('baseplate.screwHoles.info')}
                    </p>
                  }
                >
                  <SliderInput
                    label={t('baseplate.screwHoles.diameter.label')}
                    value={screwDiameter}
                    onChange={(v) => updateScrewHoles({ diameter: mm(v) })}
                    min={SCREW_HOLE_MIN_DIAMETER_MM}
                    max={SCREW_HOLE_MAX_DIAMETER_MM}
                    step={0.1}
                    unit="mm"
                    info={t('baseplate.screwHoles.diameter.info')}
                  />
                  <SettingsRow
                    label={t('baseplate.screwHoles.headStyle.label')}
                    tooltip={t('baseplate.screwHoles.headStyle.info')}
                  >
                    <SegmentedControl<ScrewHeadStyle>
                      aria-label={t('baseplate.screwHoles.headStyle.label')}
                      size="sm"
                      options={[
                        {
                          value: 'countersink',
                          label: t('baseplate.screwHoles.headStyle.countersink'),
                        },
                        {
                          value: 'counterbore',
                          label: t('baseplate.screwHoles.headStyle.counterbore'),
                        },
                      ]}
                      value={screwHeadStyle}
                      // Head width is dropped with the style: the two defaults
                      // differ (ø8 cone vs ø5.5 pocket), so carrying an explicit
                      // countersink width into a counterbore oversizes the pocket.
                      onChange={(style) =>
                        updateScrewHoles({ headStyle: style, headDiameter: undefined })
                      }
                    />
                  </SettingsRow>
                  <SliderInput
                    label={t('baseplate.screwHoles.headDiameter.label')}
                    value={resolveScrewHeadDiameter(screwHeadStyle, screwHoles?.headDiameter)}
                    onChange={(v) => updateScrewHoles({ headDiameter: mm(v) })}
                    min={SCREW_HEAD_MIN_DIAMETER_MM}
                    max={SCREW_HEAD_MAX_DIAMETER_MM}
                    step={0.1}
                    unit="mm"
                    info={t('baseplate.screwHoles.headDiameter.info')}
                  />
                  {screwHeadStyle === 'counterbore' && (
                    <SliderInput
                      label={t('baseplate.screwHoles.counterboreDepth.label')}
                      value={screwHoles?.counterboreDepth ?? SCREW_COUNTERBORE_DEFAULT_DEPTH_MM}
                      onChange={(v) => updateScrewHoles({ counterboreDepth: mm(v) })}
                      min={1}
                      max={SCREW_COUNTERBORE_MAX_DEPTH_MM}
                      step={0.1}
                      unit="mm"
                      info={t('baseplate.screwHoles.counterboreDepth.info')}
                    />
                  )}
                  <SliderInput
                    label={t('baseplate.screwHoles.perPiece.label')}
                    value={screwsPerPiece}
                    onChange={(v) => updateScrewHoles({ screwsPerPiece: v })}
                    min={SCREWS_PER_PIECE_MIN}
                    max={SCREWS_PER_PIECE_MAX}
                    step={1}
                    info={t('baseplate.screwHoles.perPiece.info')}
                  />
                </FeatureToggle>
              </div>
            )}
          </>
        )}
        {/* Corner rounding is zeroed whenever an outline is active (the shape
            carries its own corners), so show the control only for an unshaped
            plate — including while stacking, where a radius now shapes the
            stacked tiles (#3113) rather than being stripped. */}
        {!outlineActive && (
          <div className="border-t border-stroke-subtle pt-3">
            <CornerRadiusControl
              cornerRadius={baseplateParams.cornerRadius}
              cornerRadii={baseplateParams.cornerRadii}
              // Geometric max (up to a pill shape), floored to the slider's 0.5
              // step. Radii beyond the plain rounding limit become a radius-cut
              // outline downstream, which trims or drops the sockets the arc
              // consumes.
              maxRadius={Math.max(
                0,
                Math.floor(maxCornerRadiusMm(totalWidthMm, totalDepthMm) * 2) / 2
              )}
              onUniformChange={(r) => {
                updateParam('cornerRadius', mm(r));
                updateParam('cornerRadii', undefined);
              }}
              onPerCornerChange={(radii) => {
                updateParam('cornerRadii', {
                  tl: mm(radii.tl),
                  tr: mm(radii.tr),
                  bl: mm(radii.bl),
                  br: mm(radii.br),
                });
              }}
            />
          </div>
        )}
      </div>
    </StickyGroupHeader>
  );
}

/**
 * Section 3 of the baseplate panel: connectors (when split), magnet holes,
 * solid floor, and corner radius. While stacking, magnets and corner rounding
 * are stripped so they hide, but connectors stay reachable (dovetail styles
 * stack fine); the group only renders when it still has content, so it never
 * shows as an empty collapsible group.
 */

import { useSettingsStore } from '@/core/store/settings';
import { SOLID_FLOOR_DEFAULT_MM, SOLID_FLOOR_MIN_MM, SOLID_FLOOR_MAX_MM } from '@/core/constants';
import { NOZZLE_BASELINE } from '@/shared/printSettings/connectorScaling';
import { Checkbox } from '@/design-system/Checkbox/Checkbox';
import { useTranslation } from '@/i18n';
import { StickyGroupHeader } from '@/shared/components/StickyGroupHeader';
import { SettingsRow } from '@/shared/components/SettingsRow';
import { FeatureToggle } from '@/shared/components/FeatureToggle';
import { SliderInput } from '@/design-system';
import { useBaseplatePageStore } from '../../store/baseplatePageStore';
import { CornerRadiusControl } from './CornerRadiusControl';
import { ConnectorSampleButton } from './ConnectorSampleButton';
import { ConnectorPicker } from './ConnectorPicker';
import type { ConnectorChoice } from './ConnectorPicker';
import { maxCornerRadiusMm } from '../../utils/buildFullParams';
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

  if (!(tiling?.isSplit || !stackEnabled)) return null;

  return (
    <StickyGroupHeader
      title={t('baseplate.sectionBase')}
      summary={
        !stackEnabled && baseplateParams.magnetHoles
          ? `ø${baseplateParams.magnetDiameter}mm × ${baseplateParams.magnetDepth}mm`
          : undefined
      }
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
                      edge would protrude past the drawer-facing wall (#2866). */}
                  {(style === 'dovetailKey' || style === 'snapClip') && (
                    <div className="space-y-1">
                      <Checkbox
                        checked={baseplateParams.connectorSlotsAllEdges === true}
                        onChange={(checked) =>
                          updateParam('connectorSlotsAllEdges', checked || undefined)
                        }
                        label={t('baseplate.connectorSlotsAllEdges')}
                      />
                      <p className="text-[11px] leading-relaxed text-content-tertiary pl-6">
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
                    <p className="text-[11px] leading-relaxed text-content-tertiary">
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
            {/* Corner rounding is zeroed whenever an outline is active
                (the shape carries its own corners), so show the control
                only for an unshaped rectangular plate. */}
            {!outlineActive && (
              <div className="border-t border-stroke-subtle pt-3">
                <CornerRadiusControl
                  cornerRadius={baseplateParams.cornerRadius}
                  cornerRadii={baseplateParams.cornerRadii}
                  // Geometric max (up to a pill shape), floored to the
                  // slider's 0.5 step. Radii beyond the plain rounding
                  // limit become a radius-cut outline downstream, which
                  // trims or drops the sockets the arc consumes.
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
          </>
        )}
      </div>
    </StickyGroupHeader>
  );
}

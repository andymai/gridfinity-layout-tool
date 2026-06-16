/**
 * Lip renders as a single color row — the per-corner UI is rolled back
 * pending a fix. The underlying 4-corner schema is preserved: the single
 * picker mirrors the chosen hex to every corner so geometry, preview,
 * and 3MF export keep working unchanged. When per-corner editing is
 * restored, LipZoneRow / LipCornerDiagram are still available.
 *
 * Hidden-feature zones don't render at all — no greyed-out rows. The
 * zone editors are gated on the per-design featureColors.enabled toggle
 * exposed at the section header.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useToastStore } from '@/core/store';
import { DEFAULT_FEATURE_COLOR_CONFIG } from '@/features/bin-designer/constants/defaults';
import {
  LIP_CORNERS,
  computeActiveZones,
  lipCornerZone,
} from '@/features/bin-designer/types/featureColors';
import type { ColorZone, FeatureColorConfig } from '@/features/bin-designer/types/featureColors';
import type { SavedColorPalette } from '@/core/store/settings.types';
import { useTranslation } from '@/i18n';
import { PipetteIcon } from '@/design-system/Icon';
import { IconButton } from '@/design-system';
import { SEGMENT_ACTIVE, SEGMENT_INACTIVE } from '@/shared/components/segmentedControlClasses';
import { useSwapZoneWithToast } from '@/features/bin-designer/hooks/useSwapZoneWithToast';
import { FeatureToggle } from '../FeatureToggle';
import { ExperimentalBadge } from '@/shared/components/ExperimentalBadge';
import { ColorZoneRow } from './ColorZoneRow';
import { ColorGroup } from './ColorGroup';
import { ColorsHintBanner } from './ColorsHintBanner';
import { ColorsActionsMenu } from './ColorsActionsMenu';

const RECENT_COLORS_LIMIT = 8;

function buildOtherColors(zone: ColorZone, colorsByZone: ReadonlyMap<ColorZone, string>): string[] {
  const current = colorsByZone.get(zone);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const [z, c] of colorsByZone) {
    if (z === zone) continue;
    const key = c.toLowerCase();
    if (key === current?.toLowerCase()) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(c);
  }
  return result;
}

export function ColorsSection() {
  const t = useTranslation();
  const [recentColors, setRecentColors] = useState<readonly string[]>([]);

  const {
    featureColors: rawColors,
    baseStyle,
    stackingLip,
    labelEnabled,
    scoopEnabled,
    lidEnabled,
    cells,
    colorTool,
  } = useDesignerStore(
    useShallow((s) => ({
      featureColors: s.params.featureColors,
      baseStyle: s.params.base.style,
      stackingLip: s.params.base.stackingLip,
      labelEnabled: s.params.label.enabled,
      scoopEnabled: s.params.scoop.enabled,
      lidEnabled: s.params.lid.enabled,
      cells: s.params.compartments.cells,
      colorTool: s.ui.colorTool,
    }))
  );
  const setColorTool = useDesignerStore((s) => s.setColorTool);
  const swapZoneWithToast = useSwapZoneWithToast();
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- featureColors typed required but legacy persisted configs may omit it; preserve runtime fallback
  const multiColorEnabled = rawColors?.enabled ?? false;

  const activeZones = useMemo(
    () =>
      computeActiveZones({
        base: { style: baseStyle, stackingLip },
        label: { enabled: labelEnabled },
        scoop: { enabled: scoopEnabled },
        lid: { enabled: lidEnabled },
        compartments: { cells },
      }),
    [baseStyle, stackingLip, labelEnabled, scoopEnabled, lidEnabled, cells]
  );
  const hasLip = activeZones.has('lip:frontLeft');
  const hasLabelTabs = activeZones.has('labelTab');
  const hasBase = activeZones.has('base');
  const hasScoop = activeZones.has('scoop');
  const hasDividers = activeZones.has('dividers');
  const hasLid = activeZones.has('lid');

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- featureColors is typed required but legacy persisted configs may omit it; preserve the runtime fallback
  const featureColors: FeatureColorConfig = rawColors ?? DEFAULT_FEATURE_COLOR_CONFIG;
  const updateFeatureColors = useDesignerStore((s) => s.updateFeatureColors);
  const setHoveredColorZone = useDesignerStore((s) => s.setHoveredColorZone);
  const startTransaction = useDesignerStore((s) => s.startTransaction);
  const commitTransaction = useDesignerStore((s) => s.commitTransaction);

  useEffect(() => () => setHoveredColorZone(null), [setHoveredColorZone]);

  // Local LRU of recently-committed colors so the picker can offer them
  // as quick-pick swatches even on a fresh, all-body design.
  const remember = useCallback((hex: string) => {
    const lower = hex.toLowerCase();
    setRecentColors((prev) => {
      const next = [lower, ...prev.filter((c) => c !== lower)];
      return next.slice(0, RECENT_COLORS_LIMIT);
    });
  }, []);

  // Canonical lip color shown in the single-color picker. Reading from
  // frontLeft means a saved design with mismatched corners snaps to a
  // single hex on the next user edit (mirrored across all four corners)
  // without us mutating the store on mount.
  const lipColor = featureColors.lip.frontLeft;

  const colorsByZone = useMemo(() => {
    const map = new Map<ColorZone, string>();
    map.set('body', featureColors.body);
    if (hasBase) map.set('base', featureColors.base);
    if (hasLip) {
      for (const corner of LIP_CORNERS) {
        map.set(lipCornerZone(corner), featureColors.lip[corner]);
      }
    }
    if (hasLabelTabs) map.set('labelTab', featureColors.labelTab);
    if (hasScoop) map.set('scoop', featureColors.scoop);
    if (hasDividers) map.set('dividers', featureColors.dividers);
    if (hasLid) map.set('lid', featureColors.lid);
    return map;
  }, [featureColors, hasBase, hasLip, hasLabelTabs, hasScoop, hasDividers, hasLid]);

  // Bump a tick whenever a group's visible-zone count grows. ColorGroup
  // auto-opens on each tick change so a newly-enabled feature is never
  // trapped behind a stale collapsed header.
  const interiorCount = (hasScoop ? 1 : 0) + (hasDividers ? 1 : 0);
  const addonsCount = (hasLabelTabs ? 1 : 0) + (hasLid ? 1 : 0);
  const [interiorGrowthTick, setInteriorGrowthTick] = useState(0);
  const [addonsGrowthTick, setAddonsGrowthTick] = useState(0);
  const prevInteriorCountRef = useRef(interiorCount);
  const prevAddonsCountRef = useRef(addonsCount);
  useEffect(() => {
    if (interiorCount > prevInteriorCountRef.current) {
      setInteriorGrowthTick((t) => t + 1);
    }
    prevInteriorCountRef.current = interiorCount;
  }, [interiorCount]);
  useEffect(() => {
    if (addonsCount > prevAddonsCountRef.current) {
      setAddonsGrowthTick((t) => t + 1);
    }
    prevAddonsCountRef.current = addonsCount;
  }, [addonsCount]);

  // When the swap flow is active, intercept the row click so it acts as a
  // pick instead of opening the picker (clean path: the store advances the
  // swap state machine and the picker stays closed).
  const swapActive = colorTool === 'swap-pick-first' || colorTool === 'swap-pick-second';

  const renderZone = (
    zone: ColorZone,
    label: string,
    color: string,
    defaultColor: string,
    onChange: (hex: string) => void
  ) => (
    <ColorZoneRow
      zone={zone}
      label={label}
      color={color}
      defaultColor={defaultColor}
      otherColors={buildOtherColors(zone, colorsByZone)}
      bodyColor={featureColors.body}
      recentColors={recentColors}
      onChange={(hex) => {
        remember(hex);
        onChange(hex);
      }}
      onHover={setHoveredColorZone}
      onGestureStart={startTransaction}
      onGestureEnd={commitTransaction}
      onClickOverride={swapActive ? () => swapZoneWithToast(zone) : undefined}
    />
  );

  const addToast = useToastStore((s) => s.addToast);
  const handleMatchAllToBody = useCallback(() => {
    startTransaction();
    updateFeatureColors({
      lip: {
        frontLeft: featureColors.body,
        frontRight: featureColors.body,
        backRight: featureColors.body,
        backLeft: featureColors.body,
      },
      labelTab: featureColors.body,
      base: featureColors.body,
      scoop: featureColors.body,
      dividers: featureColors.body,
    });
    commitTransaction();
    addToast({
      message: t('binDesigner.colors.matchAllToBody.toast'),
      type: 'success',
      duration: 2500,
    });
  }, [startTransaction, commitTransaction, updateFeatureColors, featureColors.body, addToast, t]);

  const handleApplyPalette = useCallback(
    (palette: SavedColorPalette) => {
      startTransaction();
      updateFeatureColors({
        body: palette.colors.body,
        lip: palette.colors.lip,
        labelTab: palette.colors.labelTab,
        base: palette.colors.base,
        scoop: palette.colors.scoop,
        dividers: palette.colors.dividers,
      });
      commitTransaction();
    },
    [startTransaction, commitTransaction, updateFeatureColors]
  );

  const handleToggleMultiColor = useCallback(() => {
    updateFeatureColors({ enabled: !multiColorEnabled });
  }, [multiColorEnabled, updateFeatureColors]);

  return (
    <div className="space-y-2">
      <FeatureToggle
        label={t('binDesigner.group.colors')}
        checked={multiColorEnabled}
        onChange={handleToggleMultiColor}
        badge={<ExperimentalBadge />}
        primaryControls={
          <>
            <div className="flex items-center justify-end gap-2">
              <IconButton
                variant="ghost"
                size="sm"
                touchTarget={false}
                type="button"
                onClick={() => setColorTool(colorTool === 'eyedropper' ? null : 'eyedropper')}
                pressed={colorTool === 'eyedropper'}
                aria-label={t('binDesigner.colors.eyedropper.enter')}
                title={t('binDesigner.colors.eyedropper.enter')}
                className={`flex h-6 w-6 items-center justify-center rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset ${
                  colorTool === 'eyedropper' ? SEGMENT_ACTIVE : SEGMENT_INACTIVE
                }`}
              >
                <PipetteIcon size="sm" />
              </IconButton>
              <ColorsActionsMenu
                featureColors={featureColors}
                onMatchAllToBody={handleMatchAllToBody}
                onApplyPalette={handleApplyPalette}
              />
            </div>

            <ColorsHintBanner />

            <ColorGroup title={t('binDesigner.colors.group.exterior')}>
              {renderZone(
                'body',
                t('binDesigner.colors.body'),
                featureColors.body,
                DEFAULT_FEATURE_COLOR_CONFIG.body,
                (hex) => updateFeatureColors({ body: hex })
              )}
              {hasLip && (
                // Lip uses the umbrella 'lip' hover target so the whole lip
                // glows on row hover. The picker writes the chosen hex into
                // all four corner slots — the per-corner schema stays valid
                // and the per-corner UI can be restored without a migration.
                <ColorZoneRow
                  zone="lip"
                  label={t('binDesigner.colors.lip')}
                  color={lipColor}
                  defaultColor={DEFAULT_FEATURE_COLOR_CONFIG.lip.frontLeft}
                  otherColors={buildOtherColors('lip:frontLeft', colorsByZone)}
                  bodyColor={featureColors.body}
                  recentColors={recentColors}
                  onChange={(hex) => {
                    remember(hex);
                    updateFeatureColors({
                      lip: {
                        frontLeft: hex,
                        frontRight: hex,
                        backRight: hex,
                        backLeft: hex,
                      },
                    });
                  }}
                  onHover={setHoveredColorZone}
                  onGestureStart={startTransaction}
                  onGestureEnd={commitTransaction}
                  // During swap mode, route the lip click into the state machine
                  // through `lip:frontLeft` — the canonical representative for
                  // the now-single-color lip (mirror-on-write means picking any
                  // corner spreads to all four). Without this override the row
                  // would open the picker mid-swap.
                  onClickOverride={
                    swapActive ? () => swapZoneWithToast('lip:frontLeft') : undefined
                  }
                />
              )}
              {hasBase &&
                renderZone(
                  'base',
                  t('binDesigner.colors.base'),
                  featureColors.base,
                  DEFAULT_FEATURE_COLOR_CONFIG.base,
                  (hex) => updateFeatureColors({ base: hex })
                )}
            </ColorGroup>

            <ColorGroup
              title={t('binDesigner.colors.group.interior')}
              visible={hasScoop || hasDividers}
              growthTick={interiorGrowthTick}
            >
              {hasScoop &&
                renderZone(
                  'scoop',
                  t('binDesigner.colors.scoop'),
                  featureColors.scoop,
                  DEFAULT_FEATURE_COLOR_CONFIG.scoop,
                  (hex) => updateFeatureColors({ scoop: hex })
                )}
              {hasDividers &&
                renderZone(
                  'dividers',
                  t('binDesigner.colors.dividers'),
                  featureColors.dividers,
                  DEFAULT_FEATURE_COLOR_CONFIG.dividers,
                  (hex) => updateFeatureColors({ dividers: hex })
                )}
            </ColorGroup>

            <ColorGroup
              title={t('binDesigner.colors.group.addons')}
              visible={hasLabelTabs || hasLid}
              growthTick={addonsGrowthTick}
            >
              {hasLabelTabs &&
                renderZone(
                  'labelTab',
                  t('binDesigner.colors.labelTab'),
                  featureColors.labelTab,
                  DEFAULT_FEATURE_COLOR_CONFIG.labelTab,
                  (hex) => updateFeatureColors({ labelTab: hex })
                )}
              {hasLid &&
                renderZone(
                  'lid',
                  t('binDesigner.colors.lid'),
                  featureColors.lid,
                  DEFAULT_FEATURE_COLOR_CONFIG.lid,
                  (hex) => updateFeatureColors({ lid: hex })
                )}
            </ColorGroup>
          </>
        }
      />
      {!multiColorEnabled && (
        <p className="text-[11px] text-content-tertiary leading-snug">
          {t('binDesigner.multiColor.enableHint')}
        </p>
      )}
    </div>
  );
}

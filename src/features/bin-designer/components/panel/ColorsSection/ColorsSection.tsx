/**
 * Lip renders as a single expandable row that fans out into four
 * per-corner sub-rows. Hidden-feature zones don't render at all — no
 * greyed-out rows. The zone editors are gated on the per-design
 * featureColors.enabled toggle exposed at the section header.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useToastStore } from '@/core/store';
import { DEFAULT_FEATURE_COLOR_CONFIG } from '@/features/bin-designer/constants/defaults';
import {
  LIP_CORNERS,
  computeActiveZones,
  getZoneColor,
  lipCornerZone,
} from '@/features/bin-designer/types/featureColors';
import type {
  ColorZone,
  FeatureColorConfig,
  LipCorner,
} from '@/features/bin-designer/types/featureColors';
import type { SavedColorPalette } from '@/core/store/settings.types';
import { useTranslation } from '@/i18n';
import { ColorZoneRow } from './ColorZoneRow';
import { LipZoneRow } from './LipZoneRow';
import { LipCornerDiagram } from './LipCornerDiagram';
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
  const [lipExpanded, setLipExpanded] = useState(false);
  const [recentColors, setRecentColors] = useState<readonly string[]>([]);
  const lipCornersId = useId();

  const {
    featureColors: rawColors,
    baseStyle,
    stackingLip,
    labelEnabled,
    scoopEnabled,
    cells,
    hoveredColorZone,
  } = useDesignerStore(
    useShallow((s) => ({
      featureColors: s.params.featureColors,
      baseStyle: s.params.base.style,
      stackingLip: s.params.base.stackingLip,
      labelEnabled: s.params.label.enabled,
      scoopEnabled: s.params.scoop.enabled,
      cells: s.params.compartments.cells,
      hoveredColorZone: s.ui.hoveredColorZone,
    }))
  );
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- featureColors typed required but legacy persisted configs may omit it; preserve runtime fallback
  const multiColorEnabled = rawColors?.enabled ?? false;

  const activeZones = useMemo(
    () =>
      computeActiveZones({
        base: { style: baseStyle, stackingLip },
        label: { enabled: labelEnabled },
        scoop: { enabled: scoopEnabled },
        compartments: { cells },
      }),
    [baseStyle, stackingLip, labelEnabled, scoopEnabled, cells]
  );
  const hasLip = activeZones.has('lip:frontLeft');
  const hasLabelTabs = activeZones.has('labelTab');
  const hasBase = activeZones.has('base');
  const hasScoop = activeZones.has('scoop');
  const hasDividers = activeZones.has('dividers');

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
    return map;
  }, [featureColors, hasBase, hasLip, hasLabelTabs, hasScoop, hasDividers]);

  // Bump a tick whenever a group's visible-zone count grows. ColorGroup
  // auto-opens on each tick change so a newly-enabled feature is never
  // trapped behind a stale collapsed header.
  const interiorCount = (hasScoop ? 1 : 0) + (hasDividers ? 1 : 0);
  const addonsCount = hasLabelTabs ? 1 : 0;
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
    />
  );

  const lipCornerLabel: Record<LipCorner, string> = {
    frontLeft: t('binDesigner.colors.lip.frontLeft'),
    frontRight: t('binDesigner.colors.lip.frontRight'),
    backRight: t('binDesigner.colors.lip.backRight'),
    backLeft: t('binDesigner.colors.lip.backLeft'),
  };

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

  const enableLabel = t('binDesigner.multiColor.enableLabel');
  const handleToggleMultiColor = useCallback(() => {
    updateFeatureColors({ enabled: !multiColorEnabled });
  }, [multiColorEnabled, updateFeatureColors]);

  return (
    <div className="space-y-2">
      {/* Top toggle row — gates the zone editor below */}
      <div className="flex items-center justify-between py-1.5">
        <span className="text-xs text-content-secondary">{enableLabel}</span>
        <div className="flex items-center gap-2">
          {multiColorEnabled && (
            <ColorsActionsMenu
              featureColors={featureColors}
              onMatchAllToBody={handleMatchAllToBody}
              onApplyPalette={handleApplyPalette}
            />
          )}
          <button
            type="button"
            role="switch"
            aria-checked={multiColorEnabled}
            aria-label={enableLabel}
            onClick={handleToggleMultiColor}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${
              multiColorEnabled ? 'bg-accent' : 'bg-stroke-subtle'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                multiColorEnabled ? 'translate-x-6' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      {!multiColorEnabled && (
        <p className="text-[11px] text-content-tertiary leading-snug">
          {t('binDesigner.multiColor.enableHint')}
        </p>
      )}

      {multiColorEnabled && (
        <>
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
              <>
                <LipZoneRow
                  label={t('binDesigner.colors.lip')}
                  corners={featureColors.lip}
                  isExpanded={lipExpanded}
                  onToggleExpand={() => setLipExpanded((v) => !v)}
                  onHover={setHoveredColorZone}
                  cornersId={lipCornersId}
                />
                {lipExpanded && (
                  <div id={lipCornersId} className="flex gap-3 pl-2 pr-1">
                    <div className="flex-1 space-y-0.5">
                      {LIP_CORNERS.map((corner) => {
                        const zone = lipCornerZone(corner);
                        return (
                          <ColorZoneRow
                            key={corner}
                            zone={zone}
                            label={lipCornerLabel[corner]}
                            color={getZoneColor(featureColors, zone)}
                            defaultColor={DEFAULT_FEATURE_COLOR_CONFIG.lip[corner]}
                            otherColors={buildOtherColors(zone, colorsByZone)}
                            bodyColor={featureColors.body}
                            recentColors={recentColors}
                            onChange={(hex) => {
                              remember(hex);
                              updateFeatureColors({ lip: { [corner]: hex } });
                            }}
                            onHover={setHoveredColorZone}
                            onGestureStart={startTransaction}
                            onGestureEnd={commitTransaction}
                          />
                        );
                      })}
                    </div>
                    <LipCornerDiagram corners={featureColors.lip} hovered={hoveredColorZone} />
                  </div>
                )}
              </>
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
            visible={hasLabelTabs}
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
          </ColorGroup>
        </>
      )}
    </div>
  );
}

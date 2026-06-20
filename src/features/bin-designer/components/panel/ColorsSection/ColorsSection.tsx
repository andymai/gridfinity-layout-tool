/**
 * The lip is edited by `LipColorEditor` — a Corners × Bands grid (see that
 * component). All other zones render as single `ColorZoneRow`s.
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
  activeLipCells,
  computeActiveZones,
  lipCellZone,
  makeUniformLipCells,
  normalizePaletteLip,
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
import { LipColorEditor } from './LipColorEditor';

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
    lipCorners,
    lipBands,
    hoveredColorZone,
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
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- featureColors is typed required but legacy persisted configs may omit it
      lipCorners: s.params.featureColors?.lip.corners ?? 1,
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- featureColors is typed required but legacy persisted configs may omit it
      lipBands: s.params.featureColors?.lip.bands ?? 1,
      hoveredColorZone: s.ui.hoveredColorZone,
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
        featureColors: { lip: { corners: lipCorners, bands: lipBands } },
      }),
    [baseStyle, stackingLip, labelEnabled, scoopEnabled, lidEnabled, cells, lipCorners, lipBands]
  );
  const hasLip = activeZones.has(lipCellZone('frontLeft', 0));
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

  const colorsByZone = useMemo(() => {
    const map = new Map<ColorZone, string>();
    map.set('body', featureColors.body);
    if (hasBase) map.set('base', featureColors.base);
    if (hasLip) {
      for (const cell of activeLipCells({ corners: lipCorners, bands: lipBands })) {
        map.set(cell, featureColors.lip.cells[cell] ?? featureColors.body);
      }
    }
    if (hasLabelTabs) map.set('labelTab', featureColors.labelTab);
    if (hasScoop) map.set('scoop', featureColors.scoop);
    if (hasDividers) map.set('dividers', featureColors.dividers);
    if (hasLid) map.set('lid', featureColors.lid);
    return map;
  }, [
    featureColors,
    hasBase,
    hasLip,
    hasLabelTabs,
    hasScoop,
    hasDividers,
    hasLid,
    lipCorners,
    lipBands,
  ]);

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
      lip: { cells: makeUniformLipCells(featureColors.body) },
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
        // Tolerate legacy (4-corner) and current (grid) persisted palettes.
        lip: normalizePaletteLip(palette.colors.lip, palette.colors.body),
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
                <LipColorEditor
                  lip={featureColors.lip}
                  bodyColor={featureColors.body}
                  hovered={hoveredColorZone}
                  recentColors={recentColors}
                  swapActive={swapActive}
                  otherColorsFor={(zone) => buildOtherColors(zone, colorsByZone)}
                  onSetCorners={(corners) => updateFeatureColors({ lip: { corners } })}
                  onSetBands={(bands) => updateFeatureColors({ lip: { bands } })}
                  onChangeCell={(zone, hex) => {
                    remember(hex);
                    updateFeatureColors({ lip: { cells: { [zone]: hex } } });
                  }}
                  onHover={setHoveredColorZone}
                  onGestureStart={startTransaction}
                  onGestureEnd={commitTransaction}
                  onSwap={(zone) => swapZoneWithToast(zone)}
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

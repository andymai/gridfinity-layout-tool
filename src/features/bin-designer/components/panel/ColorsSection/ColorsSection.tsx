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
import { useSettingsStore, useToastStore } from '@/core/store';
import {
  DEFAULT_ACCENT_BAND,
  DEFAULT_FEATURE_COLOR_CONFIG,
} from '@/features/bin-designer/constants/defaults';
import {
  activeLipCells,
  computeActiveZones,
  lidLipCellZone,
  lipCellZone,
  parseLidLipCell,
  makeUniformLipCells,
  normalizePaletteLip,
} from '@/features/bin-designer/types/featureColors';
import type {
  AccentBandConfig,
  ColorZone,
  FeatureColorConfig,
} from '@/features/bin-designer/types/featureColors';
import type { SavedColorPalette } from '@/core/store/settings.types';
import { useTranslation } from '@/i18n';
import { PipetteIcon } from '@/design-system/Icon';
import { IconButton } from '@/design-system';
import { SEGMENT_ACTIVE, SEGMENT_INACTIVE } from '@/shared/components/segmentedControlClasses';
import { useSwapZoneWithToast } from '@/features/bin-designer/hooks/useSwapZoneWithToast';
import { FeatureToggle } from '../FeatureToggle';
import { SubHeader } from '../shared';
import { ExperimentalBadge } from '@/shared/components/ExperimentalBadge';
import { ColorZoneRow } from './ColorZoneRow';
import { ColorGroup } from './ColorGroup';
import { ColorsHintBanner } from './ColorsHintBanner';
import { ColorsActionsMenu } from './ColorsActionsMenu';
import { LipColorEditor } from './LipColorEditor';
import { AccentBandsEditor } from './AccentBandsEditor';

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
    binHeight,
    heightUnitMm,
    extraWallHeightMm,
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
      binHeight: s.params.height,
      heightUnitMm: s.params.heightUnitMm,
      extraWallHeightMm: s.params.extraWallHeightMm,
      lipCorners: s.params.featureColors.lip.corners,
      lipBands: s.params.featureColors.lip.bands,
      hoveredColorZone: s.ui.hoveredColorZone,
      colorTool: s.ui.colorTool,
    }))
  );
  const setColorTool = useDesignerStore((s) => s.setColorTool);
  const swapZoneWithToast = useSwapZoneWithToast();
  const multiColorEnabled = rawColors.enabled;
  const topAccent = rawColors.topAccent ?? DEFAULT_FEATURE_COLOR_CONFIG.topAccent;
  const bottomAccent = rawColors.bottomAccent;
  // Cap a band at the wall top — nominal height (units × mm/unit) plus any
  // exterior-wall collar — so it can't exceed the bin yet still reaches the top
  // of a collared bin. Floor of 1mm keeps the slider usable; the finite guard
  // keeps a corrupt NaN param from poisoning the slider's max/clamp.
  const rawMaxMm = binHeight * heightUnitMm + Math.max(0, extraWallHeightMm ?? 0);
  const accentMaxMm = Number.isFinite(rawMaxMm) ? Math.max(1, rawMaxMm) : 1;
  const { accentBandUnit, layerHeightMm, updateSetting } = useSettingsStore(
    useShallow((s) => ({
      accentBandUnit: s.settings.accentBandUnit,
      layerHeightMm: s.settings.printSettings.layerHeightMm,
      updateSetting: s.updateSetting,
    }))
  );

  const activeZones = useMemo(
    () =>
      computeActiveZones({
        base: { style: baseStyle, stackingLip },
        label: { enabled: labelEnabled },
        scoop: { enabled: scoopEnabled },
        lid: { enabled: lidEnabled },
        compartments: { cells },
        featureColors: {
          lip: { corners: lipCorners, bands: lipBands },
          topAccent: { enabled: topAccent.enabled, heightMm: topAccent.heightMm },
          bottomAccent: bottomAccent
            ? { enabled: bottomAccent.enabled, heightMm: bottomAccent.heightMm }
            : undefined,
        },
      }),
    [
      baseStyle,
      stackingLip,
      labelEnabled,
      scoopEnabled,
      lidEnabled,
      cells,
      lipCorners,
      lipBands,
      topAccent.enabled,
      topAccent.heightMm,
      bottomAccent,
    ]
  );
  const hasLip = activeZones.has(lipCellZone('frontLeft', 0));
  const hasLabelTabs = activeZones.has('labelTab');
  const hasBase = activeZones.has('base');
  const hasScoop = activeZones.has('scoop');
  const hasDividers = activeZones.has('dividers');
  const hasLid = activeZones.has('lid');
  const hasLidLip = activeZones.has(lidLipCellZone('frontLeft', 0));

  const featureColors: FeatureColorConfig = rawColors;
  // Absent grid means "inherits the lid colour", so the editor is seeded with a
  // uniform grid rather than being hidden — the user needs somewhere to start.
  const lidLipConfig = featureColors.lidLip ?? {
    corners: 1 as const,
    bands: 1 as const,
    cells: makeUniformLipCells(featureColors.lid),
  };
  const updateFeatureColors = useDesignerStore((s) => s.updateFeatureColors);
  const setHoveredColorZone = useDesignerStore((s) => s.setHoveredColorZone);
  const startTransaction = useDesignerStore((s) => s.startTransaction);
  const commitTransaction = useDesignerStore((s) => s.commitTransaction);

  useEffect(() => () => setHoveredColorZone(null), [setHoveredColorZone]);

  // Clamp the *stored* band height when the wall cap drops (e.g. the user shrinks
  // the bin after setting a tall band). Preview/export read the stored heightMm
  // directly, so without this a stale over-cap value would recolor the whole bin
  // until the slider is touched. Guarded so it only fires when actually over-cap
  // (post-clamp the condition is false → no loop).
  //
  // This is a DIFFERENT clamp from the one in `accentCutPlanes`, and only this
  // one writes back. The bin-height cap has to, because a band taller than its
  // bin renders the same either way (it covers everything) and the slider would
  // otherwise sit past its own max — so growing the bin again does not restore
  // the authored height. The top/bottom OVERLAP clamp resolves at render time
  // and never touches params, which is what makes that one reversible.
  useEffect(() => {
    if (topAccent.enabled && topAccent.heightMm > accentMaxMm) {
      updateFeatureColors({ topAccent: { heightMm: accentMaxMm } });
    }
  }, [topAccent.enabled, topAccent.heightMm, accentMaxMm, updateFeatureColors]);
  useEffect(() => {
    if (bottomAccent?.enabled === true && bottomAccent.heightMm > accentMaxMm) {
      updateFeatureColors({ bottomAccent: { heightMm: accentMaxMm } });
    }
  }, [bottomAccent, accentMaxMm, updateFeatureColors]);

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
    // Key off `enabled` (not hasTopAccent, which also requires heightMm > 0) so
    // this matches when the color row actually renders — otherwise an enabled
    // 0mm band shows a row whose otherColors filtering can't find its own color.
    if (topAccent.enabled) map.set('topAccent', topAccent.color);
    if (bottomAccent?.enabled === true) map.set('bottomAccent', bottomAccent.color);
    return map;
  }, [
    featureColors,
    hasBase,
    hasLip,
    hasLabelTabs,
    hasScoop,
    hasDividers,
    hasLid,
    topAccent.enabled,
    topAccent.color,
    bottomAccent,
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

  const handleChangeTopAccent = useCallback(
    (patch: Partial<AccentBandConfig>) => updateFeatureColors({ topAccent: patch }),
    [updateFeatureColors]
  );
  const handleChangeBottomAccent = useCallback(
    (patch: Partial<AccentBandConfig>) => updateFeatureColors({ bottomAccent: patch }),
    [updateFeatureColors]
  );

  return (
    <div className="space-y-2">
      <SubHeader>{t('binDesigner.style.section.color')}</SubHeader>
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

            {/* Accent bands are plane cuts, not geometry: each recolours the
                outermost N mm of the bin body at one end and wins over every
                zone it covers. They carry a height as well as a colour, so they
                render as their own delimited subsection right after the exterior
                swatches rather than as two more rows. */}
            <AccentBandsEditor
              top={topAccent}
              bottom={bottomAccent}
              defaultBand={DEFAULT_ACCENT_BAND}
              maxMm={accentMaxMm}
              unit={accentBandUnit}
              layerHeightMm={layerHeightMm}
              recentColors={recentColors}
              swapActive={swapActive}
              otherColorsFor={(zone) => buildOtherColors(zone, colorsByZone)}
              bodyColor={featureColors.body}
              onUnitChange={(unit) => updateSetting('accentBandUnit', unit)}
              onChangeTop={handleChangeTopAccent}
              onChangeBottom={handleChangeBottomAccent}
              onHover={setHoveredColorZone}
              onGestureStart={startTransaction}
              onGestureEnd={commitTransaction}
              onSwap={(zone) => swapZoneWithToast(zone)}
              onRememberColor={remember}
            />

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
              {/* The lid's OWN top lip (its stack grid), directly under the lid
                  swatch it inherits from. Only present on a stackable lid — a
                  flat-topped lid builds no LID_LIP geometry to paint. */}
              {hasLidLip && (
                <LipColorEditor
                  variant="lid"
                  lip={lidLipConfig}
                  bodyColor={featureColors.lid}
                  hovered={hoveredColorZone}
                  recentColors={recentColors}
                  swapActive={swapActive}
                  otherColorsFor={(zone) => buildOtherColors(zone, colorsByZone)}
                  onSetCorners={(corners) => updateFeatureColors({ lidLip: { corners } })}
                  onSetBands={(bands) => updateFeatureColors({ lidLip: { bands } })}
                  onChangeCell={(zone, hex) => {
                    remember(hex);
                    // Re-formed to the `lip:...` key `lidLip.cells` is stored
                    // under; writing the `lidLip:...` zone id would create a key
                    // nothing reads.
                    const cell = parseLidLipCell(zone);
                    if (!cell) return;
                    updateFeatureColors({
                      lidLip: { cells: { [lipCellZone(cell.corner, cell.band)]: hex } },
                    });
                  }}
                  onHover={setHoveredColorZone}
                  onGestureStart={startTransaction}
                  onGestureEnd={commitTransaction}
                  onSwap={(zone) => swapZoneWithToast(zone)}
                />
              )}
            </ColorGroup>
          </>
        }
      />
      {!multiColorEnabled && (
        <p className="text-label text-content-tertiary leading-snug">
          {t('binDesigner.multiColor.enableHint')}
        </p>
      )}
    </div>
  );
}

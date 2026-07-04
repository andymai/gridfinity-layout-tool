/**
 * Parameter panel for the standalone baseplate page.
 *
 * Top-to-bottom information hierarchy:
 * 1. Dimensions: sync-with-layout toggle + grid steppers (the unit readout)
 *    + click-to-edit mm summary + spatial padding schematic. Single unified section.
 * 2. Base: magnet holes, dovetails (when split), corner radius
 * 3. Print Settings: grid unit, print bed size (rarely changed)
 * 4. Split pieces mini-map (only when baseplate is split across print beds)
 */

import { useCallback, useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store/layout';
import { useSettingsStore } from '@/core/store/settings';
import { useToastStore } from '@/core/store/toast';
import { FractionalEdgeToggle } from '@/shared/components/FractionalEdgeToggle';
import {
  DEFAULT_BASEPLATE_PARAMS,
  CONSTRAINTS,
  MARGIN_MIN_DETACH_MM,
  SOLID_FLOOR_DEFAULT_MM,
  SOLID_FLOOR_MIN_MM,
  SOLID_FLOOR_MAX_MM,
} from '@/core/constants';
import { PRINT_SETTINGS_CONSTRAINTS } from '@/shared/printSettings';
import { NOZZLE_BASELINE } from '@/shared/printSettings/connectorScaling';
import { useHalfGridModeStore } from '@/core/store/halfGridMode';
import { Checkbox } from '@/design-system/Checkbox/Checkbox';
import { RulerIcon, RotateCcwIcon } from '@/design-system/Icon';
import { useTranslation } from '@/i18n';
import { StickyGroupHeader } from '@/shared/components/StickyGroupHeader';
import { SettingsRow } from '@/shared/components/SettingsRow';
import { DeferredNumberInput } from '@/shared/components/DeferredNumberInput';
import { PrintBedInput } from '@/shared/components/PrintBedInput';
import { FeatureToggle } from '@/shared/components/FeatureToggle';
import { SliderInput, Button, ConfirmDialog, CheckboxRow, SegmentedControl } from '@/design-system';
import { UserDock } from '@/shared/components/UserDock';
import { AttributionFooter } from '@/shared/components/AttributionFooter';
import { useFeatureFlag } from '@/shared/hooks/useFeatureFlag';
import { HelpTargetMarker } from '@/shared/help/HelpTargetMarker';
import { helpJumpEventName } from '@/shared/help/helpJumpDispatcher';
import { useBaseplatePageStore } from '../../store/baseplatePageStore';
import { EditableDimensions } from './EditableDimensions';
import { PaddingSchematic } from './PaddingSchematic';
import { SplitViewStrip } from './SplitViewStrip';
import { CornerRadiusControl } from './CornerRadiusControl';
import { GridDimensionStepper } from './GridDimensionStepper';
import { ConnectorSampleButton } from './ConnectorSampleButton';
import { StackPrintSection } from './StackPrintSection';
import { ConnectorPicker } from './ConnectorPicker';
import type { ConnectorChoice } from './ConnectorPicker';
import { resolveOverTileStatus } from '../../utils/overTileStatus';
import type { StackPrintParams } from '@/core/types';
import { PADDING_MAX } from '../PaddingStepper';
import { Stepper } from '@/design-system/Stepper';
import {
  CONNECTOR_FIT_OFFSET_MIN,
  CONNECTOR_FIT_OFFSET_MAX,
  CONNECTOR_FIT_OFFSET_STEP,
} from '@/shared/constants/connectors';
import type { StoredBaseplateParams } from '@/core/types';
import { gridUnits, mm } from '@/core/types';
import { isSeamConnectorStyle } from '@/shared/types/bin';

/** How the drawer-fit padding margin is filled. */
type MarginFillMode = 'solid' | 'tile' | 'halfGrid';

/** How the sub-21mm leftover after half-grid packing is rendered. */
type LeftoverMode = 'grid' | 'solid';

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

export function BaseplatePanel() {
  const t = useTranslation();
  const cloudSyncEnabled = useFeatureFlag('cloud_sync');

  const {
    drawerWidth,
    drawerDepth,
    drawerFractionalEdgeX,
    drawerFractionalEdgeY,
    gridUnitMm,
    printBedSize,
    printBedDepth,
    baseplateParams,
  } = useLayoutStore(
    useShallow((state) => ({
      drawerWidth: state.layout.drawer.width,
      drawerDepth: state.layout.drawer.depth,
      drawerFractionalEdgeX: state.layout.drawer.fractionalEdgeX ?? 'end',
      drawerFractionalEdgeY: state.layout.drawer.fractionalEdgeY ?? 'end',
      gridUnitMm: state.layout.gridUnitMm,
      printBedSize: state.layout.printBedSize,
      printBedDepth: state.layout.printBedDepth,
      baseplateParams: state.layout.baseplateParams ?? DEFAULT_BASEPLATE_PARAMS,
    }))
  );

  const { tiling, hoveredPieceLabel, selectedPieceLabel, exportFormat } = useBaseplatePageStore(
    useShallow((s) => ({
      tiling: s.tiling,
      hoveredPieceLabel: s.hoveredPieceLabel,
      selectedPieceLabel: s.selectedPieceLabel,
      exportFormat: s.exportFileNameConfig.format,
    }))
  );
  const setHoveredPieceLabel = useBaseplatePageStore((s) => s.setHoveredPieceLabel);
  const setSelectedPieceLabel = useBaseplatePageStore((s) => s.setSelectedPieceLabel);

  const nozzleSizeMm = useSettingsStore((s) => s.settings.printSettings.nozzleSizeMm);
  const handleNozzleChange = useCallback((value: number) => {
    const current = useSettingsStore.getState().settings.printSettings;
    useSettingsStore.getState().updateSetting('printSettings', { ...current, nozzleSizeMm: value });
  }, []);
  const maxPrintHeightMm = useSettingsStore((s) => s.settings.printSettings.maxPrintHeightMm);
  const handleMaxHeightChange = useCallback((value: number) => {
    const current = useSettingsStore.getState().settings.printSettings;
    useSettingsStore
      .getState()
      .updateSetting('printSettings', { ...current, maxPrintHeightMm: value });
  }, []);

  const updateParams = useCallback((patch: Partial<StoredBaseplateParams>) => {
    const current = useLayoutStore.getState().layout.baseplateParams ?? DEFAULT_BASEPLATE_PARAMS;
    useLayoutStore.getState().setBaseplateParams({ ...current, ...patch });
  }, []);

  const updateParam = useCallback(
    <K extends keyof StoredBaseplateParams>(key: K, value: StoredBaseplateParams[K]) => {
      updateParams({ [key]: value });
    },
    [updateParams]
  );

  const halfGridMode = useHalfGridModeStore((s) => s.halfGridMode);
  const [printSettingsExpanded, setPrintSettingsExpanded] = useState(true);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  const handleReset = useCallback(() => {
    useLayoutStore.getState().setBaseplateParams({ ...DEFAULT_BASEPLATE_PARAMS });
    useToastStore.getState().addToast(t('toast.baseplateReset'), 'success', 3000);
    setResetConfirmOpen(false);
  }, [t]);

  // Stacking strips connectors functionally (in buildFullParams), not by
  // mutating stored params — so the user's connector settings return intact
  // when stacking is turned off. The connector controls are hidden meanwhile.
  const setStackPrint = useCallback(
    (next: StackPrintParams | undefined) => updateParams({ stackPrint: next }),
    [updateParams]
  );
  // STEP never stacks, so the controls stacking would strip (magnets, corner
  // rounding) stay live for STEP exports — mirror BaseplatePage's stackEnabled.
  const stackEnabled =
    baseplateParams.stackPrint?.enabled === true && (exportFormat ?? 'stl') !== 'step';

  useEffect(() => {
    const handler = () => setPrintSettingsExpanded(true);
    const eventName = helpJumpEventName('baseplate:print-settings');
    window.addEventListener(eventName, handler);
    return () => window.removeEventListener(eventName, handler);
  }, []);

  const synced = baseplateParams.syncWithLayout !== false;
  const effectiveWidth = synced ? drawerWidth : (baseplateParams.baseplateWidth ?? drawerWidth);
  const effectiveDepth = synced ? drawerDepth : (baseplateParams.baseplateDepth ?? drawerDepth);

  const handleSyncToggle = useCallback(
    (checked: boolean) => {
      const layoutState = useLayoutStore.getState().layout;
      const current = layoutState.baseplateParams ?? DEFAULT_BASEPLATE_PARAMS;
      if (checked) {
        useLayoutStore.getState().setBaseplateParams({ ...current, syncWithLayout: true });
      } else {
        useLayoutStore.getState().setBaseplateParams({
          ...current,
          syncWithLayout: false,
          baseplateWidth: drawerWidth,
          baseplateDepth: drawerDepth,
          fractionalEdgeX: layoutState.drawer.fractionalEdgeX ?? 'end',
          fractionalEdgeY: layoutState.drawer.fractionalEdgeY ?? 'end',
        });
      }
    },
    [drawerWidth, drawerDepth]
  );

  const handleFractionalEdgeChange = useCallback(
    (axis: 'x' | 'y', edge: 'start' | 'end') => {
      if (baseplateParams.syncWithLayout !== false) {
        useLayoutStore
          .getState()
          .updateDrawer(axis === 'x' ? { fractionalEdgeX: edge } : { fractionalEdgeY: edge });
      } else {
        updateParam(axis === 'x' ? 'fractionalEdgeX' : 'fractionalEdgeY', edge);
      }
    },
    [baseplateParams.syncWithLayout, updateParam]
  );

  const gridWidthMm = effectiveWidth * gridUnitMm;
  const gridDepthMm = effectiveDepth * gridUnitMm;

  const totalWidthMm = gridWidthMm + baseplateParams.paddingLeft + baseplateParams.paddingRight;
  const totalDepthMm = gridDepthMm + baseplateParams.paddingFront + baseplateParams.paddingBack;
  const hasPadding =
    baseplateParams.paddingLeft > 0 ||
    baseplateParams.paddingRight > 0 ||
    baseplateParams.paddingFront > 0 ||
    baseplateParams.paddingBack > 0;
  const overTileStatus = resolveOverTileStatus(baseplateParams);
  // Derive the toggle from the STORED flags, not a canOverTile-clamped mode, so
  // the user can still turn fill OFF when padding temporarily shrinks below the
  // tile threshold — disabling the whole switch there would strand an enabled
  // flag that silently re-applies once padding grows again.
  const fillOn = baseplateParams.overTile === true;
  const halfGridOn = fillOn && baseplateParams.overTileHalfGrid === true;
  const setMarginFillMode = useCallback(
    (mode: MarginFillMode) => {
      updateParams({
        overTile: mode !== 'solid',
        overTileHalfGrid: mode === 'halfGrid' ? true : undefined,
      });
    },
    [updateParams]
  );
  const leftoverMode: LeftoverMode =
    halfGridOn && baseplateParams.overTileHalfGridSolidLeftover === true ? 'solid' : 'grid';
  const setLeftoverMode = useCallback(
    (mode: LeftoverMode) => {
      // Store undefined (not false) for the default Grid so identical geometry
      // keeps one serialized/cache identity — matches overTileHalfGrid above.
      updateParam('overTileHalfGridSolidLeftover', mode === 'solid' ? true : undefined);
    },
    [updateParam]
  );

  // Detach margins: each side with padding ≥ threshold prints as its own rail.
  // Mutually exclusive with stack-print (stacking wins) — keyed on the stored
  // flag, not the export-format-aware `stackEnabled` above.
  const stackPrintOn = baseplateParams.stackPrint?.enabled === true;
  const canDetach =
    baseplateParams.paddingLeft >= MARGIN_MIN_DETACH_MM ||
    baseplateParams.paddingRight >= MARGIN_MIN_DETACH_MM ||
    baseplateParams.paddingFront >= MARGIN_MIN_DETACH_MM ||
    baseplateParams.paddingBack >= MARGIN_MIN_DETACH_MM;
  // Reflect the STORED opt-in in the toggle (it's preserved across stack-print),
  // so when stack-print suppresses detach the switch reads as on-but-disabled
  // rather than silently off.
  const detachStored = baseplateParams.detachMargins === true;
  const marginConnectorStored = baseplateParams.detachMarginConnector === true;
  // The seam connector reuses the body's tongue/groove; snapClip/dovetailKey
  // seams would need a separate clip part, so they stay friction-fit (#2414).
  // `undefined` is the stored default for dovetail, so it counts.
  const marginConnectorStyleOk = isSeamConnectorStyle(baseplateParams.connectorStyle);

  const hasFractionalWidth = effectiveWidth % 1 !== 0;
  const hasFractionalDepth = effectiveDepth % 1 !== 0;
  const fractionalEdgeX = synced
    ? drawerFractionalEdgeX
    : (baseplateParams.fractionalEdgeX ?? 'end');
  const fractionalEdgeY = synced
    ? drawerFractionalEdgeY
    : (baseplateParams.fractionalEdgeY ?? 'end');

  const minMm = CONSTRAINTS.GRID_MIN * gridUnitMm;
  const maxMm = CONSTRAINTS.GRID_MAX * gridUnitMm + PADDING_MAX * 2;

  /**
   * When the user enters target mm dimensions:
   * 1. Snap down to the largest valid grid size that fits (half-unit or whole-unit)
   * 2. Distribute remaining mm evenly as padding (left=right, front=back)
   * 3. Auto-uncheck "Sync with layout"
   */
  const handleDimensionCommit = useCallback(
    (targetWidthMm: number, targetDepthMm: number) => {
      const step = halfGridMode ? 0.5 : 1;

      const rawWidthUnits = targetWidthMm / gridUnitMm;
      const rawDepthUnits = targetDepthMm / gridUnitMm;

      // Floor so the grid never exceeds the target — remainder becomes positive padding
      const snappedWidth = Math.max(
        CONSTRAINTS.GRID_MIN,
        Math.min(CONSTRAINTS.GRID_MAX, Math.floor(rawWidthUnits / step) * step)
      );
      const snappedDepth = Math.max(
        CONSTRAINTS.GRID_MIN,
        Math.min(CONSTRAINTS.GRID_MAX, Math.floor(rawDepthUnits / step) * step)
      );

      const remainderWidth = Math.max(0, targetWidthMm - snappedWidth * gridUnitMm);
      const remainderDepth = Math.max(0, targetDepthMm - snappedDepth * gridUnitMm);

      const halfPadWidth = Math.floor((remainderWidth / 2) * 100) / 100;
      const halfPadDepth = Math.floor((remainderDepth / 2) * 100) / 100;

      const layoutState = useLayoutStore.getState().layout;
      const current = layoutState.baseplateParams ?? DEFAULT_BASEPLATE_PARAMS;
      useLayoutStore.getState().setBaseplateParams({
        ...current,
        syncWithLayout: false,
        baseplateWidth: gridUnits(snappedWidth),
        baseplateDepth: gridUnits(snappedDepth),
        fractionalEdgeX: layoutState.drawer.fractionalEdgeX ?? 'end',
        fractionalEdgeY: layoutState.drawer.fractionalEdgeY ?? 'end',
        paddingLeft: mm(halfPadWidth),
        paddingRight: mm(halfPadWidth),
        paddingFront: mm(halfPadDepth),
        paddingBack: mm(halfPadDepth),
      });
    },
    [gridUnitMm, halfGridMode]
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {/* 1. Dimensions — sync toggle + grid steppers (steppers = units readout) + mm summary */}
        <StickyGroupHeader title={t('baseplate.sectionDimensions')}>
          <div className="space-y-3 px-4 py-3">
            <Checkbox
              checked={synced}
              onChange={handleSyncToggle}
              label={t('baseplate.syncWithLayout')}
            />
            <div className="grid grid-cols-2 gap-x-3 gap-y-2">
              <GridDimensionStepper
                label={t('baseplate.gridWidth')}
                value={effectiveWidth}
                onChange={(v) => updateParam('baseplateWidth', gridUnits(v))}
                halfGridMode={halfGridMode}
                disabled={synced}
              />
              <GridDimensionStepper
                label={t('baseplate.gridDepth')}
                value={effectiveDepth}
                onChange={(v) => updateParam('baseplateDepth', gridUnits(v))}
                halfGridMode={halfGridMode}
                disabled={synced}
              />
            </div>
            {/* Fractional edge position — shown when the effective dimensions are half-unit */}
            {(hasFractionalWidth || hasFractionalDepth) && (
              <div className="space-y-1.5">
                <div className="text-content-tertiary text-[10px] mb-1">
                  {t('sidebar.halfUnitEdgePosition')}
                </div>
                {hasFractionalWidth && (
                  <FractionalEdgeToggle
                    axis="x"
                    label={t('common.width')}
                    value={fractionalEdgeX}
                    onChange={handleFractionalEdgeChange}
                    startTitle={t('sidebar.halfBinLeft')}
                    startLabel={t('sidebar.left')}
                    endTitle={t('sidebar.halfBinRight')}
                    endLabel={t('sidebar.right')}
                  />
                )}
                {hasFractionalDepth && (
                  <FractionalEdgeToggle
                    axis="y"
                    label={t('common.depth')}
                    value={fractionalEdgeY}
                    onChange={handleFractionalEdgeChange}
                    startTitle={t('sidebar.halfBinBottom')}
                    startLabel={t('sidebar.bottom')}
                    endTitle={t('sidebar.halfBinTop')}
                    endLabel={t('sidebar.top')}
                  />
                )}
              </div>
            )}

            {/* mm summary under steppers — matches the layout-mode drawer dimensions pattern.
                When padding > 0, show a trailing 'incl. padding' note so users see the total
                is grid + padding, not grid alone. */}
            <div className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 pt-1 text-content-tertiary">
              <div className="flex items-center gap-1">
                <RulerIcon size="xs" className="flex-shrink-0" />
                <EditableDimensions
                  widthMm={totalWidthMm}
                  depthMm={totalDepthMm}
                  minMm={minMm}
                  maxMm={maxMm}
                  onCommit={handleDimensionCommit}
                  aria-label={t('baseplate.editDimensions')}
                  widthLabel={t('baseplate.editDimensionsWidth')}
                  depthLabel={t('baseplate.editDimensionsDepth')}
                  variant="secondary"
                />
              </div>
              {hasPadding && (
                <span className="text-[11px] italic text-content-tertiary">
                  {t('baseplate.inclPadding')}
                </span>
              )}
            </div>

            {/* Padding — spatial schematic */}
            <div className="space-y-2 border-t border-stroke-subtle pt-3">
              <div className="text-[11px] font-medium uppercase tracking-wide text-content-tertiary">
                {t('baseplate.padding')}
              </div>
              <PaddingSchematic
                baseplateParams={baseplateParams}
                updateParam={updateParam}
                updateParams={updateParams}
              />
              {hasPadding && (
                <div className="border-t border-stroke-subtle pt-3">
                  <FeatureToggle
                    label={t('baseplate.overTile')}
                    checked={fillOn}
                    onChange={() => setMarginFillMode(fillOn ? 'solid' : 'tile')}
                    disabledReason={
                      !fillOn && !overTileStatus.canOverTile
                        ? t('baseplate.overTileTooSmall')
                        : undefined
                    }
                    primaryControls={
                      <div className="space-y-1.5">
                        {overTileStatus.canOverTile ? (
                          <>
                            <CheckboxRow
                              label={t('baseplate.preferHalfGrid')}
                              checked={halfGridOn}
                              onChange={(checked) =>
                                setMarginFillMode(checked ? 'halfGrid' : 'tile')
                              }
                              indent
                            />
                            {halfGridOn && (
                              <div className="ml-4 flex items-center justify-between gap-2 border-l border-stroke-subtle pl-3">
                                <span className="text-xs text-content-secondary">
                                  {t('baseplate.leftoverLabel')}
                                </span>
                                <SegmentedControl
                                  aria-label={t('baseplate.leftoverLabel')}
                                  size="sm"
                                  options={[
                                    { value: 'grid', label: t('baseplate.leftoverGrid') },
                                    { value: 'solid', label: t('baseplate.leftoverSolid') },
                                  ]}
                                  value={leftoverMode}
                                  onChange={setLeftoverMode}
                                />
                              </div>
                            )}
                            <div className="space-y-1 text-[11px] leading-relaxed">
                              <p className="text-content-tertiary">
                                {t(
                                  halfGridOn
                                    ? leftoverMode === 'solid'
                                      ? 'baseplate.halfGridHintSolid'
                                      : 'baseplate.halfGridHint'
                                    : 'baseplate.overTileHint'
                                )}
                              </p>
                              {overTileStatus.tiled.length > 0 && (
                                <p className="text-content-secondary">
                                  {t('baseplate.overTileFills', {
                                    sides: overTileStatus.tiled
                                      .map((e) => t(e.labelKey))
                                      .join(', '),
                                  })}
                                </p>
                              )}
                              {overTileStatus.tooSmall.length > 0 && (
                                <p className="text-content-tertiary">
                                  {t('baseplate.overTileKeptSolid', {
                                    sides: overTileStatus.tooSmall
                                      .map((e) => t(e.labelKey))
                                      .join(', '),
                                  })}
                                </p>
                              )}
                            </div>
                          </>
                        ) : (
                          // Fill is on but no edge can fit a tile right now — keep the
                          // toggle enabled (so it can be turned off) and explain why.
                          <p className="text-[11px] leading-relaxed text-content-tertiary">
                            {t('baseplate.overTileTooSmall')}
                          </p>
                        )}
                      </div>
                    }
                  />
                </div>
              )}
              {hasPadding && (
                <div className="border-t border-stroke-subtle pt-3">
                  <FeatureToggle
                    label={t('baseplate.detachMargins')}
                    checked={detachStored}
                    onChange={() => updateParam('detachMargins', !detachStored)}
                    disabledReason={
                      stackPrintOn
                        ? t('baseplate.detachMarginsStackConflict')
                        : !detachStored && !canDetach
                          ? t('baseplate.detachMarginsTooSmall')
                          : undefined
                    }
                    primaryControls={
                      // On but nothing meets the threshold → no rails are emitted,
                      // so say so rather than imply they will.
                      !canDetach ? (
                        <p className="text-[11px] leading-relaxed text-content-tertiary">
                          {t('baseplate.detachMarginsTooSmall')}
                        </p>
                      ) : (
                        <div className="space-y-1">
                          <CheckboxRow
                            label={t('baseplate.detachMarginConnector')}
                            checked={marginConnectorStored && marginConnectorStyleOk}
                            onChange={(checked) => updateParam('detachMarginConnector', checked)}
                            disabled={!marginConnectorStyleOk}
                            indent
                          />
                          <p className="text-[11px] leading-relaxed text-content-tertiary pl-6">
                            {marginConnectorStyleOk
                              ? t('baseplate.detachMarginConnectorHint')
                              : t('baseplate.detachMarginConnectorStyle')}
                          </p>
                        </div>
                      )
                    }
                  />
                </div>
              )}
            </div>
          </div>
        </StickyGroupHeader>

        {/* 2. Stack for printing — experimental. Placed above Base because
            enabling it strips and hides the Base controls below. */}
        <StackPrintSection stackPrint={baseplateParams.stackPrint} onChange={setStackPrint} />

        {/* 3. Base — connectors, magnets, corner radius. While stacking, magnets
            and corner rounding are stripped so they hide, but connectors stay
            reachable (dovetail styles stack fine); the group only renders when it
            still has content, so it never shows as an empty collapsible group. */}
        {(tiling?.isSplit || !stackEnabled) && (
          <StickyGroupHeader
            title={t('baseplate.sectionBase')}
            summary={
              !stackEnabled && baseplateParams.magnetHoles
                ? `\u00f8${baseplateParams.magnetDiameter}mm \u00d7 ${baseplateParams.magnetDepth}mm`
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
                    stackEnabled
                      ? { snapClip: t('baseplate.connectors.snapClipNoStack') }
                      : undefined
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
                              onChange={(checked) =>
                                updateParam('invertDovetails', checked || undefined)
                              }
                              label={t('baseplate.dovetails.invert')}
                            />
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
                      valueSummary={`\u00f8${baseplateParams.magnetDiameter}mm \u00d7 ${baseplateParams.magnetDepth}mm`}
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
                  <div className="border-t border-stroke-subtle pt-3">
                    <CornerRadiusControl
                      cornerRadius={baseplateParams.cornerRadius}
                      cornerRadii={baseplateParams.cornerRadii}
                      maxRadius={
                        gridUnitMm / 2 +
                        Math.min(
                          Math.min(baseplateParams.paddingLeft, baseplateParams.paddingRight),
                          Math.min(baseplateParams.paddingFront, baseplateParams.paddingBack)
                        )
                      }
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
                </>
              )}
            </div>
          </StickyGroupHeader>
        )}

        {/* 4. Physical Units — grid unit, print bed, nozzle, build height. Mirrors the
            "Physical Units" section in the bin designer and layout sidebars. */}
        <StickyGroupHeader
          title={t('common.physicalUnits')}
          summary={formatPrintSettingsSummary(
            gridUnitMm,
            printBedSize,
            printBedDepth ?? printBedSize
          )}
          expanded={printSettingsExpanded}
          onExpandedChange={setPrintSettingsExpanded}
        >
          <div className="space-y-3 px-4 py-3">
            <div className="text-xs text-content-secondary space-y-2">
              <SettingsRow
                label={t('baseplate.gridUnit')}
                htmlFor="bp-gridUnit"
                unit="mm"
                tooltip={t('baseplate.gridUnitTooltip')}
              >
                <DeferredNumberInput
                  id="bp-gridUnit"
                  value={gridUnitMm}
                  onChange={(mm) => useLayoutStore.getState().setGridUnitMm(mm)}
                  min={1}
                  max={200}
                  className="input w-14 py-0.5 px-1 text-xs text-right"
                />
              </SettingsRow>
              <HelpTargetMarker id="bp-print-bed-size">
                <SettingsRow
                  label={t('baseplate.printBedSize')}
                  htmlFor="bp-printBedSize"
                  unit="mm"
                  tooltip={t('baseplate.printBedTooltip')}
                >
                  <PrintBedInput
                    id="bp-printBedSize"
                    width={printBedSize}
                    depth={printBedDepth ?? printBedSize}
                    onChange={(w, d) => useLayoutStore.getState().setPrintBedSize(w, d)}
                    variant="compact"
                  />
                </SettingsRow>
              </HelpTargetMarker>
              <SettingsRow
                label={t('settings.nozzleSize')}
                htmlFor="bp-nozzleSize"
                tooltip={t('baseplate.nozzleSizeTooltip')}
                unit="mm"
              >
                <DeferredNumberInput
                  id="bp-nozzleSize"
                  value={nozzleSizeMm}
                  onChange={handleNozzleChange}
                  min={PRINT_SETTINGS_CONSTRAINTS.NOZZLE_SIZE_MIN}
                  max={PRINT_SETTINGS_CONSTRAINTS.NOZZLE_SIZE_MAX}
                  step={PRINT_SETTINGS_CONSTRAINTS.NOZZLE_SIZE_STEP}
                  className="input w-14 py-0.5 px-1 text-xs text-right"
                  aria-label={t('settings.nozzleSize')}
                />
              </SettingsRow>
              <SettingsRow
                label={t('baseplate.maxPrintHeight')}
                htmlFor="bp-maxPrintHeight"
                unit="mm"
                tooltip={t('baseplate.maxPrintHeightTooltip')}
              >
                <DeferredNumberInput
                  id="bp-maxPrintHeight"
                  value={maxPrintHeightMm}
                  onChange={handleMaxHeightChange}
                  min={PRINT_SETTINGS_CONSTRAINTS.MAX_PRINT_HEIGHT_MIN}
                  max={PRINT_SETTINGS_CONSTRAINTS.MAX_PRINT_HEIGHT_MAX}
                  step={PRINT_SETTINGS_CONSTRAINTS.MAX_PRINT_HEIGHT_STEP}
                  className="input w-14 py-0.5 px-1 text-xs text-right"
                  aria-label={t('baseplate.maxPrintHeight')}
                />
              </SettingsRow>
            </div>
          </div>
        </StickyGroupHeader>

        {/* 4. Split pieces mini-map — only when baseplate is split */}
        {tiling?.isSplit && (
          <SplitViewStrip
            tiling={tiling}
            hoveredPieceLabel={hoveredPieceLabel}
            selectedPieceLabel={selectedPieceLabel}
            onHoverPiece={setHoveredPieceLabel}
            onSelectPiece={setSelectedPieceLabel}
            printBedSize={printBedSize}
          />
        )}

        <HelpTargetMarker id="bp-reset" className="px-3 pt-2">
          <Button
            variant="ghost"
            size="sm"
            fullWidth
            leftIcon={<RotateCcwIcon />}
            onClick={() => setResetConfirmOpen(true)}
          >
            {t('baseplate.reset')}
          </Button>
        </HelpTargetMarker>

        <AttributionFooter />
      </div>
      {cloudSyncEnabled && <UserDock />}
      <ConfirmDialog
        isOpen={resetConfirmOpen}
        title={t('baseplate.resetConfirmTitle')}
        message={t('baseplate.resetConfirmMessage')}
        confirmText={t('baseplate.resetConfirmButton')}
        cancelText={t('common.cancel')}
        destructive
        onConfirm={handleReset}
        onCancel={() => setResetConfirmOpen(false)}
      />
    </div>
  );
}
/** Print Settings header summary: "{gridUnit}mm · {bed}mm" or "{gridUnit}mm · {w}×{d}mm" for asymmetric beds. */
function formatPrintSettingsSummary(gridUnitMm: number, bedW: number, bedD: number): string {
  const bed = bedW === bedD ? `${bedW}mm` : `${bedW}\u00d7${bedD}mm`;
  return `${gridUnitMm}mm \u00b7 ${bed}`;
}

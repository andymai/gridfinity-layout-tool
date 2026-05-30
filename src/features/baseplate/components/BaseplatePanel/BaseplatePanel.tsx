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
import { DEFAULT_BASEPLATE_PARAMS, CONSTRAINTS } from '@/core/constants';
import { useHalfGridModeStore } from '@/core/store/halfGridMode';
import { Checkbox } from '@/design-system/Checkbox/Checkbox';
import { Select } from '@/design-system/Select';
import { RulerIcon, LayoutGridIcon } from '@/design-system/Icon';
import { Stepper } from '@/design-system/Stepper';
import { useTranslation } from '@/i18n';
import { StickyGroupHeader } from '@/shared/components/StickyGroupHeader';
import { SettingsRow } from '@/shared/components/SettingsRow';
import { DeferredNumberInput } from '@/shared/components/DeferredNumberInput';
import { PrintBedInput } from '@/shared/components/PrintBedInput';
import { FeatureToggle } from '@/shared/components/FeatureToggle';
import { SliderInput } from '@/shared/components/SliderInput';
import { UserDock } from '@/shared/components/UserDock';
import { useFeatureFlag } from '@/shared/hooks/useFeatureFlag';
import { HelpTargetMarker } from '@/shared/help/HelpTargetMarker';
import { helpJumpEventName } from '@/shared/help/helpJumpDispatcher';
import { useBaseplatePageStore } from '../../store/baseplatePageStore';
import { EditableDimensions } from './EditableDimensions';
import { PaddingSchematic } from './PaddingSchematic';
import { SplitViewStrip } from './SplitViewStrip';
import { resolveOverTileStatus } from '../../utils/overTileStatus';
import { PADDING_MAX } from '../PaddingStepper';
import type { BaseplateParams } from '@/core/types';
import { gridUnits, mm } from '@/core/types';

export function BaseplatePanel() {
  const t = useTranslation();
  const cloudSyncEnabled = useFeatureFlag('cloud_sync');

  const { drawerWidth, drawerDepth, gridUnitMm, printBedSize, printBedDepth, baseplateParams } =
    useLayoutStore(
      useShallow((state) => ({
        drawerWidth: state.layout.drawer.width,
        drawerDepth: state.layout.drawer.depth,
        gridUnitMm: state.layout.gridUnitMm,
        printBedSize: state.layout.printBedSize,
        printBedDepth: state.layout.printBedDepth,
        baseplateParams: state.layout.baseplateParams ?? DEFAULT_BASEPLATE_PARAMS,
      }))
    );

  const { tiling, hoveredPieceLabel, selectedPieceLabel } = useBaseplatePageStore(
    useShallow((s) => ({
      tiling: s.tiling,
      hoveredPieceLabel: s.hoveredPieceLabel,
      selectedPieceLabel: s.selectedPieceLabel,
    }))
  );
  const setHoveredPieceLabel = useBaseplatePageStore((s) => s.setHoveredPieceLabel);
  const setSelectedPieceLabel = useBaseplatePageStore((s) => s.setSelectedPieceLabel);

  const updateParams = useCallback((patch: Partial<BaseplateParams>) => {
    const current = useLayoutStore.getState().layout.baseplateParams ?? DEFAULT_BASEPLATE_PARAMS;
    useLayoutStore.getState().setBaseplateParams({ ...current, ...patch });
  }, []);

  const updateParam = useCallback(
    <K extends keyof BaseplateParams>(key: K, value: BaseplateParams[K]) => {
      updateParams({ [key]: value });
    },
    [updateParams]
  );

  const halfGridMode = useHalfGridModeStore((s) => s.halfGridMode);
  const [printSettingsExpanded, setPrintSettingsExpanded] = useState(true);

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
      const current = useLayoutStore.getState().layout.baseplateParams ?? DEFAULT_BASEPLATE_PARAMS;
      if (checked) {
        useLayoutStore.getState().setBaseplateParams({ ...current, syncWithLayout: true });
      } else {
        useLayoutStore.getState().setBaseplateParams({
          ...current,
          syncWithLayout: false,
          baseplateWidth: drawerWidth,
          baseplateDepth: drawerDepth,
        });
      }
    },
    [drawerWidth, drawerDepth]
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
  const overTileOn = baseplateParams.overTile === true && overTileStatus.canOverTile;

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

      const current = useLayoutStore.getState().layout.baseplateParams ?? DEFAULT_BASEPLATE_PARAMS;
      useLayoutStore.getState().setBaseplateParams({
        ...current,
        syncWithLayout: false,
        baseplateWidth: gridUnits(snappedWidth),
        baseplateDepth: gridUnits(snappedDepth),
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
                    badge={<LayoutGridIcon size="xs" className="text-content-tertiary" />}
                    checked={overTileOn}
                    onChange={() => updateParam('overTile', baseplateParams.overTile !== true)}
                    disabledReason={
                      overTileStatus.canOverTile ? undefined : t('baseplate.overTileTooSmall')
                    }
                    primaryControls={
                      <div className="space-y-1 text-[11px] leading-relaxed">
                        <p className="text-content-tertiary">{t('baseplate.overTileHint')}</p>
                        {overTileStatus.tiled.length > 0 && (
                          <p className="text-content-secondary">
                            {t('baseplate.overTileFills', {
                              sides: overTileStatus.tiled.map((e) => t(e.labelKey)).join(', '),
                            })}
                          </p>
                        )}
                        {overTileStatus.tooSmall.length > 0 && (
                          <p className="text-content-tertiary">
                            {t('baseplate.overTileKeptSolid', {
                              sides: overTileStatus.tooSmall.map((e) => t(e.labelKey)).join(', '),
                            })}
                          </p>
                        )}
                      </div>
                    }
                  />
                </div>
              )}
            </div>
          </div>
        </StickyGroupHeader>

        {/* 2. Base — magnet holes, dovetails, corner radius */}
        <StickyGroupHeader
          title={t('baseplate.sectionBase')}
          summary={
            baseplateParams.magnetHoles
              ? `\u00f8${baseplateParams.magnetDiameter}mm \u00d7 ${baseplateParams.magnetDepth}mm`
              : undefined
          }
        >
          <div className="space-y-3 px-4 py-3">
            {tiling?.isSplit && (
              <>
                <FeatureToggle
                  label={t('baseplate.connectorNubs')}
                  checked={baseplateParams.connectorNubs === true}
                  onChange={() =>
                    updateParam('connectorNubs', baseplateParams.connectorNubs !== true)
                  }
                />
                {baseplateParams.connectorNubs === true && (
                  <>
                    <SettingsRow label={t('baseplate.connectorStyle.label')}>
                      <Select
                        size="sm"
                        value={baseplateParams.connectorStyle ?? 'dovetail'}
                        onValueChange={(v) =>
                          updateParam(
                            'connectorStyle',
                            v === 'dovetailKey' ? 'dovetailKey' : undefined
                          )
                        }
                        options={[
                          { id: 'dovetail', name: t('baseplate.connectorStyle.dovetail') },
                          { id: 'dovetailKey', name: t('baseplate.connectorStyle.dovetailKey') },
                        ]}
                        aria-label={t('baseplate.connectorStyle.label')}
                      />
                    </SettingsRow>
                    {baseplateParams.connectorStyle !== 'dovetailKey' &&
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
                  </>
                )}
              </>
            )}
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
        </StickyGroupHeader>

        {/* 3. Print Settings — advanced, rarely changed */}
        <StickyGroupHeader
          title={t('baseplate.sectionPrintSettings')}
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
      </div>
      {cloudSyncEnabled && <UserDock />}
    </div>
  );
}
/** Corner radius controls with optional per-corner mode. */
function CornerRadiusControl({
  cornerRadius,
  cornerRadii,
  maxRadius,
  onUniformChange,
  onPerCornerChange,
}: {
  readonly cornerRadius: number | undefined;
  readonly cornerRadii:
    | { readonly tl: number; readonly tr: number; readonly bl: number; readonly br: number }
    | undefined;
  readonly maxRadius: number;
  readonly onUniformChange: (r: number) => void;
  readonly onPerCornerChange: (radii: { tl: number; tr: number; bl: number; br: number }) => void;
}) {
  const t = useTranslation();
  const perCorner = cornerRadii !== undefined;
  const uniformR = cornerRadius ?? 2.5;

  return (
    <>
      <SliderInput
        label={t('baseplate.cornerRadius')}
        value={uniformR}
        onChange={onUniformChange}
        min={0}
        max={maxRadius}
        step={0.5}
        unit="mm"
        info={t('baseplate.cornerRadiusInfo')}
        disabled={perCorner}
      />
      <Checkbox
        label={t('baseplate.cornerRadiusUnlink')}
        checked={perCorner}
        onChange={() => {
          if (perCorner) {
            onUniformChange(cornerRadii.tl);
          } else {
            onPerCornerChange({ tl: uniformR, tr: uniformR, bl: uniformR, br: uniformR });
          }
        }}
      />
      {perCorner && (
        <>
          <SliderInput
            label={t('baseplate.cornerRadiusTL')}
            value={cornerRadii.tl}
            onChange={(v) => onPerCornerChange({ ...cornerRadii, tl: v })}
            min={0}
            max={maxRadius}
            step={0.5}
            unit="mm"
          />
          <SliderInput
            label={t('baseplate.cornerRadiusTR')}
            value={cornerRadii.tr}
            onChange={(v) => onPerCornerChange({ ...cornerRadii, tr: v })}
            min={0}
            max={maxRadius}
            step={0.5}
            unit="mm"
          />
          <SliderInput
            label={t('baseplate.cornerRadiusBL')}
            value={cornerRadii.bl}
            onChange={(v) => onPerCornerChange({ ...cornerRadii, bl: v })}
            min={0}
            max={maxRadius}
            step={0.5}
            unit="mm"
          />
          <SliderInput
            label={t('baseplate.cornerRadiusBR')}
            value={cornerRadii.br}
            onChange={(v) => onPerCornerChange({ ...cornerRadii, br: v })}
            min={0}
            max={maxRadius}
            step={0.5}
            unit="mm"
          />
        </>
      )}
    </>
  );
}

/** Print Settings header summary: "{gridUnit}mm · {bed}mm" or "{gridUnit}mm · {w}×{d}mm" for asymmetric beds. */
function formatPrintSettingsSummary(gridUnitMm: number, bedW: number, bedD: number): string {
  const bed = bedW === bedD ? `${bedW}mm` : `${bedW}\u00d7${bedD}mm`;
  return `${gridUnitMm}mm \u00b7 ${bed}`;
}

interface GridDimensionStepperProps {
  readonly label: string;
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly halfGridMode: boolean;
  readonly disabled: boolean;
}

/** Compact stepper for a custom grid width or depth dimension (grid units). */
function GridDimensionStepper({
  label,
  value,
  onChange,
  halfGridMode,
  disabled,
}: GridDimensionStepperProps) {
  const step = halfGridMode ? 0.5 : 1;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-content-tertiary">{label}</span>
      <Stepper
        size="sm"
        value={value}
        onChange={onChange}
        onStep={(delta) =>
          onChange(
            Math.min(CONSTRAINTS.GRID_MAX, Math.max(CONSTRAINTS.GRID_MIN, value + delta * step))
          )
        }
        disabled={disabled}
        min={CONSTRAINTS.GRID_MIN}
        max={CONSTRAINTS.GRID_MAX}
        step={step}
        aria-label={label}
      />
    </div>
  );
}

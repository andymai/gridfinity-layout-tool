/**
 * Parameter panel for the standalone baseplate page.
 *
 * Top-to-bottom information hierarchy:
 * 1. Hero dimensions strip (total mm primary, grid context secondary — always visible)
 * 2. Fit to Drawer: per-side padding steppers
 * 3. Base: magnet holes toggle with customize expand
 * 4. View: inline strip with assembled/exploded toggle + mini-map (conditional on split)
 * 5. Print Settings: grid unit, print bed size (rarely changed)
 *
 * Uses shared components (StickyGroupHeader, FeatureToggle, SliderInput,
 * SegmentedControl) for consistency with the bin designer.
 */

import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store/layout';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/constants';
import { Stepper } from '@/design-system/Stepper';
import { useTranslation } from '@/i18n';
import { StickyGroupHeader } from '@/shared/components/StickyGroupHeader';
import { SettingsRow } from '@/shared/components/SettingsRow';
import { DeferredNumberInput } from '@/shared/components/DeferredNumberInput';
import { FeatureToggle } from '@/shared/components/FeatureToggle';
import { SliderInput } from '@/shared/components/SliderInput';
import { useBaseplatePageStore } from '../../store/baseplatePageStore';
import { colToLetter } from '../../utils/splitPlanner';
import type { BaseplateParams } from '@/core/types';
import type { BaseplateTiling } from '../../types/tiling';

// ─── Main Component ──────────────────────────────────────────────────────────

export function BaseplatePanel() {
  const t = useTranslation();

  const { drawerWidth, drawerDepth, gridUnitMm, printBedSize, baseplateParams } = useLayoutStore(
    useShallow((state) => ({
      drawerWidth: state.layout.drawer.width,
      drawerDepth: state.layout.drawer.depth,
      gridUnitMm: state.layout.gridUnitMm,
      printBedSize: state.layout.printBedSize,
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

  const updateParam = useCallback(
    <K extends keyof BaseplateParams>(key: K, value: BaseplateParams[K]) => {
      const current = useLayoutStore.getState().layout.baseplateParams ?? DEFAULT_BASEPLATE_PARAMS;
      useLayoutStore.getState().setBaseplateParams({ ...current, [key]: value });
    },
    []
  );

  const handleGridUnitChange = useCallback((mm: number) => {
    useLayoutStore.getState().setGridUnitMm(mm);
  }, []);

  const handlePrintBedChange = useCallback((size: number) => {
    useLayoutStore.getState().setPrintBedSize(size);
  }, []);

  const gridWidthMm = drawerWidth * gridUnitMm;
  const gridDepthMm = drawerDepth * gridUnitMm;

  const totalWidthMm = gridWidthMm + baseplateParams.paddingLeft + baseplateParams.paddingRight;
  const totalDepthMm = gridDepthMm + baseplateParams.paddingFront + baseplateParams.paddingBack;
  const hasPadding =
    baseplateParams.paddingLeft > 0 ||
    baseplateParams.paddingRight > 0 ||
    baseplateParams.paddingFront > 0 ||
    baseplateParams.paddingBack > 0;

  // Padding section summary
  const paddingSummary = hasPadding
    ? `L:${baseplateParams.paddingLeft} R:${baseplateParams.paddingRight} F:${baseplateParams.paddingFront} B:${baseplateParams.paddingBack}`
    : undefined;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {/* 1. Dimensions strip — always visible, non-collapsible hero */}
        <div className="border-b border-stroke-subtle px-4 py-2.5">
          {hasPadding ? (
            <>
              <div className="text-sm font-semibold tabular-nums text-content">
                {t('baseplate.totalDimensions', {
                  width: Math.round(totalWidthMm),
                  depth: Math.round(totalDepthMm),
                })}
              </div>
              <div className="text-xs tabular-nums text-content-tertiary">
                {t('baseplate.gridPlusPadding', {
                  width: drawerWidth,
                  depth: drawerDepth,
                })}
              </div>
            </>
          ) : (
            <div className="flex items-baseline justify-between">
              <span className="text-xs tabular-nums text-content-secondary">
                {t('baseplate.dimensionsUnits', {
                  width: drawerWidth,
                  depth: drawerDepth,
                })}
              </span>
              <span className="text-sm font-semibold tabular-nums text-content">
                {Math.round(gridWidthMm)} &times; {Math.round(gridDepthMm)} mm
              </span>
            </div>
          )}
        </div>

        {/* 2. Drawer Fit — primary configuration */}
        <StickyGroupHeader title={t('baseplate.sectionFitToDrawer')} summary={paddingSummary}>
          <div className="space-y-3 px-4 py-3">
            <p className="text-xs text-content-tertiary">{t('baseplate.paddingHelp')}</p>
            {/* Per-side padding steppers — 2x2 grid */}
            <div className="grid grid-cols-2 gap-x-3 gap-y-2">
              <PaddingStepper
                label={t('baseplate.paddingLeft')}
                value={baseplateParams.paddingLeft}
                onChange={(v) => updateParam('paddingLeft', v)}
              />
              <PaddingStepper
                label={t('baseplate.paddingRight')}
                value={baseplateParams.paddingRight}
                onChange={(v) => updateParam('paddingRight', v)}
              />
              <PaddingStepper
                label={t('baseplate.paddingFront')}
                value={baseplateParams.paddingFront}
                onChange={(v) => updateParam('paddingFront', v)}
              />
              <PaddingStepper
                label={t('baseplate.paddingBack')}
                value={baseplateParams.paddingBack}
                onChange={(v) => updateParam('paddingBack', v)}
              />
            </div>
          </div>
        </StickyGroupHeader>

        {/* 3. Base — magnet holes toggle */}
        <StickyGroupHeader
          title={t('baseplate.sectionBase')}
          summary={
            baseplateParams.magnetHoles
              ? `\u00f8${baseplateParams.magnetDiameter}mm \u00d7 ${baseplateParams.magnetDepth}mm`
              : undefined
          }
        >
          <div className="space-y-3 px-4 py-3">
            <p className="text-xs text-content-tertiary">{t('baseplate.magnetHelp')}</p>
            <FeatureToggle
              label={t('baseplate.magnetHoles')}
              checked={baseplateParams.magnetHoles}
              onChange={() => updateParam('magnetHoles', !baseplateParams.magnetHoles)}
              valueSummary={`\u00f8${baseplateParams.magnetDiameter}mm \u00d7 ${baseplateParams.magnetDepth}mm`}
            >
              <SliderInput
                label={t('baseplate.magnetDiameter')}
                value={baseplateParams.magnetDiameter}
                onChange={(v) => updateParam('magnetDiameter', v)}
                min={1}
                max={20}
                step={0.1}
                unit="mm"
                info={t('baseplate.magnetDiameterInfo')}
              />
              <SliderInput
                label={t('baseplate.magnetDepth')}
                value={baseplateParams.magnetDepth}
                onChange={(v) => updateParam('magnetDepth', v)}
                min={0.5}
                max={10}
                step={0.1}
                unit="mm"
                info={t('baseplate.magnetDepthInfo')}
              />
            </FeatureToggle>
          </div>
        </StickyGroupHeader>

        {/* 4. Print Settings — advanced, rarely changed */}
        <StickyGroupHeader title={t('baseplate.sectionPrintSettings')}>
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
                  onChange={handleGridUnitChange}
                  min={1}
                  max={200}
                  className="input w-14 py-0.5 px-1 text-xs text-right"
                />
              </SettingsRow>
              <SettingsRow
                label={t('baseplate.printBedSize')}
                htmlFor="bp-printBedSize"
                unit="mm"
                tooltip={t('baseplate.printBedTooltip')}
              >
                <DeferredNumberInput
                  id="bp-printBedSize"
                  value={printBedSize}
                  onChange={handlePrintBedChange}
                  min={42}
                  max={500}
                  step={10}
                  className="input w-14 py-0.5 px-1 text-xs text-right"
                />
              </SettingsRow>
            </div>
          </div>
        </StickyGroupHeader>

        {/* 5. Split pieces mini-map — only when baseplate is split */}
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
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

/** Non-collapsible inline strip for the split view control. */
function SplitViewStrip({
  tiling,
  hoveredPieceLabel,
  selectedPieceLabel,
  onHoverPiece,
  onSelectPiece,
  printBedSize,
}: {
  tiling: BaseplateTiling;
  hoveredPieceLabel: string | null;
  selectedPieceLabel: string | null;
  onHoverPiece: (label: string | null) => void;
  onSelectPiece: (label: string | null) => void;
  printBedSize: number;
}) {
  const t = useTranslation();

  return (
    <div className="border-b border-stroke-subtle">
      {/* Info + reason */}
      <div className="flex items-baseline justify-between gap-2 px-4 pt-3 pb-1">
        <span className="text-xs text-content-secondary">
          {t('baseplate.splitInfo', { count: tiling.pieces.length })}
        </span>
        <span className="text-[11px] text-content-tertiary whitespace-nowrap">
          {t('baseplate.splitReason', { printBed: printBedSize })}
        </span>
      </div>

      {/* Piece mini-map */}
      <div className="px-4 pb-3">
        <div
          className="grid gap-1"
          aria-label={t('baseplate.sectionView')}
          style={{
            gridTemplateColumns: `repeat(${tiling.cols}, 1fr)`,
          }}
        >
          {Array.from({ length: tiling.rows }, (_, ri) => {
            // Flip Y so row 1 (front/bottom in 3D) is at the bottom of the mini-map
            const r = tiling.rows - 1 - ri;
            return Array.from({ length: tiling.cols }, (_, c) => {
              const label = `${colToLetter(c)}${r + 1}`;
              const isHovered = hoveredPieceLabel === label;
              const isSelected = selectedPieceLabel === label;

              return (
                <button
                  key={label}
                  type="button"
                  className={`flex items-center justify-center rounded border bg-surface-elevated py-1 text-[10px] font-mono transition-shadow ${
                    isSelected
                      ? 'ring-2 ring-accent border-accent text-content-primary'
                      : isHovered
                        ? 'ring-1 ring-accent/50 border-accent/50 text-content-secondary'
                        : 'border-stroke-subtle text-content-tertiary'
                  }`}
                  onPointerEnter={() => onHoverPiece(label)}
                  onPointerLeave={() => onHoverPiece(null)}
                  onClick={() => onSelectPiece(selectedPieceLabel === label ? null : label)}
                  aria-pressed={isSelected}
                  aria-label={t('baseplate.pieceLabel', { label })}
                >
                  {label}
                </button>
              );
            });
          })}
        </div>
      </div>
    </div>
  );
}

/** Compact stepper for a single padding value (mm). */
function PaddingStepper({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-content-tertiary">{label}</span>
      <Stepper
        size="sm"
        value={value}
        onChange={onChange}
        onStep={(delta) => onChange(Math.max(0, value + delta))}
        min={0}
        max={100}
        step={0.1}
        aria-label={label}
      />
    </div>
  );
}

/**
 * Parameter panel for the standalone baseplate page.
 *
 * Top-to-bottom information hierarchy:
 * 1. Dimensions strip (read-only context — always visible, non-collapsible)
 * 2. Fit to Drawer: per-side padding steppers
 * 3. Split Pieces: split info, toggle, mini-map (conditional on tiling)
 * 4. Magnets: magnet holes toggle with customize expand
 * 5. Print Settings: grid unit, print bed size, reset (rarely changed)
 *
 * Uses shared components (StickyGroupHeader, FeatureToggle, SliderInput,
 * SegmentedControl) for consistency with the bin designer.
 */

import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store/layout';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/constants';
import { Stepper } from '@/design-system/Stepper';
import { Button } from '@/design-system/Button';
import { RotateCcwIcon } from '@/design-system/Icon';
import { useTranslation } from '@/i18n';
import { StickyGroupHeader } from '@/shared/components/StickyGroupHeader';
import { SettingsRow } from '@/shared/components/SettingsRow';
import { DeferredNumberInput } from '@/shared/components/DeferredNumberInput';
import { FeatureToggle } from '@/shared/components/FeatureToggle';
import { SliderInput } from '@/shared/components/SliderInput';
import { SegmentedControl } from '@/shared/components/SegmentedControl';
import { useBaseplatePageStore } from '../../store/baseplatePageStore';
import { colToLetter } from '../../utils/splitPlanner';
import type { BaseplateParams } from '@/core/types';
import type { BaseplateTiling, BaseplatePiece } from '../../types/tiling';
import type { SplitViewMode } from '../../store/baseplatePageStore';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function paramsAreDefault(params: BaseplateParams): boolean {
  return (
    params.magnetHoles === DEFAULT_BASEPLATE_PARAMS.magnetHoles &&
    params.magnetDiameter === DEFAULT_BASEPLATE_PARAMS.magnetDiameter &&
    params.magnetDepth === DEFAULT_BASEPLATE_PARAMS.magnetDepth &&
    params.paddingLeft === DEFAULT_BASEPLATE_PARAMS.paddingLeft &&
    params.paddingRight === DEFAULT_BASEPLATE_PARAMS.paddingRight &&
    params.paddingFront === DEFAULT_BASEPLATE_PARAMS.paddingFront &&
    params.paddingBack === DEFAULT_BASEPLATE_PARAMS.paddingBack
  );
}

const VIEW_MODE_OPTIONS: ReadonlyArray<{ value: SplitViewMode; label: string }> = [
  { value: 'assembled', label: '' }, // labels filled at render time via t()
  { value: 'exploded', label: '' },
];

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

  const { tiling, splitViewMode, hoveredPieceLabel, selectedPieceLabel } = useBaseplatePageStore(
    useShallow((s) => ({
      tiling: s.tiling,
      splitViewMode: s.splitViewMode,
      hoveredPieceLabel: s.hoveredPieceLabel,
      selectedPieceLabel: s.selectedPieceLabel,
    }))
  );
  const setSplitViewMode = useBaseplatePageStore((s) => s.setSplitViewMode);
  const setHoveredPieceLabel = useBaseplatePageStore((s) => s.setHoveredPieceLabel);
  const setSelectedPieceLabel = useBaseplatePageStore((s) => s.setSelectedPieceLabel);

  const updateParam = useCallback(
    <K extends keyof BaseplateParams>(key: K, value: BaseplateParams[K]) => {
      const current = useLayoutStore.getState().layout.baseplateParams ?? DEFAULT_BASEPLATE_PARAMS;
      useLayoutStore.getState().setBaseplateParams({ ...current, [key]: value });
    },
    []
  );

  const handleReset = useCallback(() => {
    useLayoutStore.getState().setBaseplateParams(DEFAULT_BASEPLATE_PARAMS);
  }, []);

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

  const isDefault = paramsAreDefault(baseplateParams);

  // Build view-mode options with translated labels
  const viewModeOptions = VIEW_MODE_OPTIONS.map((opt) => ({
    ...opt,
    label: opt.value === 'assembled' ? t('baseplate.viewAssembled') : t('baseplate.viewExploded'),
  }));

  // Grid section summary
  const gridSummary = `${drawerWidth}\u00d7${drawerDepth} \u2014 ${Math.round(gridWidthMm)}\u00d7${Math.round(gridDepthMm)}mm`;

  // Padding section summary
  const paddingSummary = hasPadding
    ? `L:${baseplateParams.paddingLeft} R:${baseplateParams.paddingRight} F:${baseplateParams.paddingFront} B:${baseplateParams.paddingBack}`
    : undefined;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {/* 1. Dimensions strip — always visible, non-collapsible context */}
        <div className="border-b border-stroke-subtle px-4 py-2.5">
          <div className="text-xs tabular-nums text-content-secondary">{gridSummary}</div>
        </div>

        {/* 2. Drawer Fit — primary configuration */}
        <StickyGroupHeader title={t('baseplate.sectionFitToDrawer')} summary={paddingSummary}>
          <div className="space-y-3 px-4 py-3">
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

            {/* Total dimensions when padding is set */}
            {hasPadding && (
              <div className="text-[11px] tabular-nums text-content-tertiary">
                {t('baseplate.totalDimensions', {
                  width: Math.round(totalWidthMm),
                  depth: Math.round(totalDepthMm),
                })}
              </div>
            )}
          </div>
        </StickyGroupHeader>

        {/* 3. Split Pieces — conditional, directly after padding */}
        {tiling?.isSplit && (
          <StickyGroupHeader
            title={t('baseplate.sectionSplit')}
            summary={t('baseplate.splitInfo', {
              cols: tiling.cols,
              rows: tiling.rows,
              count: tiling.pieces.length,
            })}
          >
            <SplitInfoContent
              tiling={tiling}
              viewMode={splitViewMode}
              viewModeOptions={viewModeOptions}
              onViewModeChange={setSplitViewMode}
              hoveredPieceLabel={hoveredPieceLabel}
              selectedPieceLabel={selectedPieceLabel}
              onHoverPiece={setHoveredPieceLabel}
              onSelectPiece={setSelectedPieceLabel}
              gridUnitMm={gridUnitMm}
            />
          </StickyGroupHeader>
        )}

        {/* 4. Magnets — secondary toggle */}
        <StickyGroupHeader
          title={t('baseplate.sectionMagnets')}
          summary={
            baseplateParams.magnetHoles
              ? `\u00f8${baseplateParams.magnetDiameter}mm \u00d7 ${baseplateParams.magnetDepth}mm`
              : undefined
          }
        >
          <div className="px-4 py-3">
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
              />
              <SliderInput
                label={t('baseplate.magnetDepth')}
                value={baseplateParams.magnetDepth}
                onChange={(v) => updateParam('magnetDepth', v)}
                min={0.5}
                max={10}
                step={0.1}
                unit="mm"
              />
            </FeatureToggle>
          </div>
        </StickyGroupHeader>

        {/* 5. Print Settings — advanced, rarely changed */}
        <StickyGroupHeader title={t('baseplate.sectionPrintSettings')}>
          <div className="space-y-3 px-4 py-3">
            <div className="text-xs text-content-secondary space-y-2">
              <SettingsRow label={t('baseplate.gridUnit')} htmlFor="bp-gridUnit" unit="mm">
                <DeferredNumberInput
                  id="bp-gridUnit"
                  value={gridUnitMm}
                  onChange={handleGridUnitChange}
                  min={1}
                  max={200}
                  className="input w-14 py-0.5 px-1 text-xs text-right"
                />
              </SettingsRow>
              <SettingsRow label={t('baseplate.printBedSize')} htmlFor="bp-printBedSize" unit="mm">
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

            {/* Reset button */}
            {!isDefault && (
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<RotateCcwIcon size="xs" />}
                onClick={handleReset}
                aria-label={t('baseplate.resetParams')}
              >
                {t('common.reset')}
              </Button>
            )}
          </div>
        </StickyGroupHeader>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

/** Content for the split info section. */
function SplitInfoContent({
  tiling,
  viewMode,
  viewModeOptions,
  onViewModeChange,
  hoveredPieceLabel,
  selectedPieceLabel,
  onHoverPiece,
  onSelectPiece,
  gridUnitMm,
}: {
  tiling: BaseplateTiling;
  viewMode: SplitViewMode;
  viewModeOptions: ReadonlyArray<{ value: SplitViewMode; label: string }>;
  onViewModeChange: (mode: SplitViewMode) => void;
  hoveredPieceLabel: string | null;
  selectedPieceLabel: string | null;
  onHoverPiece: (label: string | null) => void;
  onSelectPiece: (label: string | null) => void;
  gridUnitMm: number;
}) {
  const t = useTranslation();

  const activePieceLabel = hoveredPieceLabel ?? selectedPieceLabel;
  const activePiece = activePieceLabel
    ? (tiling.pieces.find((p) => p.label === activePieceLabel) ?? null)
    : null;

  return (
    <div className="space-y-3 px-4 py-3">
      {/* Split info line */}
      <div className="text-xs tabular-nums text-content-secondary">
        {t('baseplate.splitInfo', {
          cols: tiling.cols,
          rows: tiling.rows,
          count: tiling.pieces.length,
        })}
      </div>

      {/* Assembled / Exploded toggle */}
      <SegmentedControl
        options={viewModeOptions}
        value={viewMode}
        onChange={onViewModeChange}
        ariaLabel={t('baseplate.sectionSplit')}
      />

      {/* Piece mini-map */}
      <div
        className="grid gap-1"
        aria-label={t('baseplate.sectionSplit')}
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

      {/* Piece detail strip */}
      {activePiece && <PieceDetailStrip piece={activePiece} gridUnitMm={gridUnitMm} />}
    </div>
  );
}

/** Shows dimensions for the active (hovered or selected) piece. */
function PieceDetailStrip({ piece, gridUnitMm }: { piece: BaseplatePiece; gridUnitMm: number }) {
  const t = useTranslation();
  const widthMm = Math.round(piece.widthUnits * gridUnitMm);
  const depthMm = Math.round(piece.depthUnits * gridUnitMm);

  return (
    <div className="flex items-center justify-between rounded bg-surface-elevated px-2 py-1.5 text-[11px] tabular-nums">
      <span className="font-mono font-medium text-content-primary">{piece.label}</span>
      <span className="text-content-tertiary">
        {t('baseplate.pieceDimensions', {
          width: piece.widthUnits,
          depth: piece.depthUnits,
          widthMm,
          depthMm,
        })}
      </span>
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
        step={0.5}
        aria-label={label}
      />
    </div>
  );
}

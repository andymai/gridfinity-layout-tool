/**
 * Parameter panel for the standalone baseplate page.
 *
 * Top-to-bottom information hierarchy:
 * 1. Hero dimensions strip (total mm primary, grid context secondary — always visible)
 * 2. Fit to Drawer: per-side padding steppers
 * 3. Base: magnet holes toggle with customize expand
 * 4. Print Settings: grid unit, print bed size (rarely changed)
 *
 * Uses shared components (StickyGroupHeader, FeatureToggle, SliderInput,
 * SegmentedControl) for consistency with the bin designer.
 */

import { useCallback, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store/layout';
import { DEFAULT_BASEPLATE_PARAMS, CONSTRAINTS } from '@/core/constants';
import { useHalfBinModeStore } from '@/core/store/halfBinMode';
import { Checkbox } from '@/design-system/Checkbox/Checkbox';
import { ChevronDownIcon } from '@/design-system/Icon';
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
import type { BaseplateTiling, PaddingReductionHint } from '../../types/tiling';

const PADDING_HINT_AXIS_KEYS: Record<PaddingReductionHint['axis'], string> = {
  x: 'baseplate.paddingHintAxisX',
  y: 'baseplate.paddingHintAxisY',
  both: 'baseplate.paddingHintAxisBoth',
};

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

  const halfBinMode = useHalfBinModeStore((s) => s.halfBinMode);
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
                  width: effectiveWidth,
                  depth: effectiveDepth,
                })}
              </div>
            </>
          ) : (
            <div className="flex items-baseline justify-between">
              <span className="text-xs tabular-nums text-content-secondary">
                {t('baseplate.dimensionsUnits', {
                  width: effectiveWidth,
                  depth: effectiveDepth,
                })}
              </span>
              <span className="text-sm font-semibold tabular-nums text-content">
                {Math.round(gridWidthMm)} &times; {Math.round(gridDepthMm)} mm
              </span>
            </div>
          )}
        </div>

        {/* 2. Grid Size — sync toggle + optional custom width/depth */}
        <StickyGroupHeader
          title={t('baseplate.sectionGridSize')}
          summary={`${effectiveWidth}×${effectiveDepth}`}
        >
          <div className="space-y-3 px-4 py-3">
            <Checkbox
              checked={synced}
              onChange={handleSyncToggle}
              label={t('baseplate.syncWithLayout')}
            />
            <div className={`grid grid-cols-2 gap-x-3 gap-y-2${synced ? ' opacity-50' : ''}`}>
              <GridDimensionStepper
                label={t('baseplate.gridWidth')}
                value={effectiveWidth}
                onChange={(v) => updateParam('baseplateWidth', v)}
                halfBinMode={halfBinMode}
                disabled={synced}
              />
              <GridDimensionStepper
                label={t('baseplate.gridDepth')}
                value={effectiveDepth}
                onChange={(v) => updateParam('baseplateDepth', v)}
                halfBinMode={halfBinMode}
                disabled={synced}
              />
            </div>
          </div>
        </StickyGroupHeader>

        {/* 3. Drawer Fit — primary configuration */}
        <StickyGroupHeader title={t('baseplate.sectionFitToDrawer')} summary={paddingSummary}>
          <div className="space-y-3 px-4 py-3">
            <p className="text-xs text-content-tertiary">{t('baseplate.paddingHelp')}</p>
            <PaddingSchematic
              baseplateParams={baseplateParams}
              updateParam={updateParam}
              totalWidthMm={totalWidthMm}
              totalDepthMm={totalDepthMm}
            />
          </div>
        </StickyGroupHeader>

        {/* Options divider — separates primary controls from rarely-changed settings */}
        <div className="flex items-center gap-3 px-4 py-2">
          <div className="h-px flex-1 bg-stroke-subtle" />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-content-tertiary">
            {t('baseplate.sectionOptions')}
          </span>
          <div className="h-px flex-1 bg-stroke-subtle" />
        </div>

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
            {tiling?.isSplit && (
              <FeatureToggle
                label={t('baseplate.connectorNubs')}
                checked={baseplateParams.connectorNubs === true}
                onChange={() =>
                  updateParam('connectorNubs', baseplateParams.connectorNubs !== true)
                }
              />
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
                  onChange={(mm) => useLayoutStore.getState().setGridUnitMm(mm)}
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
                  onChange={(size) => useLayoutStore.getState().setPrintBedSize(size)}
                  min={42}
                  max={500}
                  step={10}
                  className="input w-14 py-0.5 px-1 text-xs text-right"
                />
              </SettingsRow>
            </div>
          </div>
        </StickyGroupHeader>

        {/* 6. Split pieces mini-map — only when baseplate is split */}
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

interface SplitViewStripProps {
  readonly tiling: BaseplateTiling;
  readonly hoveredPieceLabel: string | null;
  readonly selectedPieceLabel: string | null;
  readonly onHoverPiece: (label: string | null) => void;
  readonly onSelectPiece: (label: string | null) => void;
  readonly printBedSize: number;
}

/** Non-collapsible inline strip for the split view control. */
function SplitViewStrip({
  tiling,
  hoveredPieceLabel,
  selectedPieceLabel,
  onHoverPiece,
  onSelectPiece,
  printBedSize,
}: SplitViewStripProps) {
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

      {/* Padding reduction hint */}
      {tiling.paddingReductionHint && (
        <div className="mx-4 mb-2 rounded bg-accent/10 px-2.5 py-1.5 text-[11px] text-accent">
          {t('baseplate.paddingHint', {
            axis: t(PADDING_HINT_AXIS_KEYS[tiling.paddingReductionHint.axis]),
            mm: tiling.paddingReductionHint.reductionMm,
            count: tiling.paddingReductionHint.piecesSaved,
          })}
        </div>
      )}

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

interface PaddingSchematicProps {
  readonly baseplateParams: BaseplateParams;
  readonly updateParam: <K extends keyof BaseplateParams>(
    key: K,
    value: BaseplateParams[K]
  ) => void;
  readonly totalWidthMm: number;
  readonly totalDepthMm: number;
}

/** Spatial schematic showing padding steppers positioned around a baseplate rectangle. */
function PaddingSchematic({
  baseplateParams,
  updateParam,
  totalWidthMm,
  totalDepthMm,
}: PaddingSchematicProps) {
  const t = useTranslation();

  return (
    <div className="space-y-1.5">
      {/* Back stepper — centered above */}
      <div className="flex justify-center">
        <PaddingStepper
          label={t('baseplate.paddingBack')}
          value={baseplateParams.paddingBack}
          onChange={(v) => updateParam('paddingBack', v)}
        />
      </div>

      {/* Middle row: Left stepper | rectangle | Right stepper */}
      <div className="flex items-center gap-1.5">
        <SideStepper
          ariaLabel={t('baseplate.paddingLeft')}
          value={baseplateParams.paddingLeft}
          onChange={(v) => updateParam('paddingLeft', v)}
        />
        <div className="flex-1 min-h-14 rounded-md border border-dashed border-stroke-subtle bg-surface-secondary/50" />
        <SideStepper
          ariaLabel={t('baseplate.paddingRight')}
          value={baseplateParams.paddingRight}
          onChange={(v) => updateParam('paddingRight', v)}
        />
      </div>

      {/* Front stepper — centered below */}
      <div className="flex justify-center">
        <PaddingStepper
          label={t('baseplate.paddingFront')}
          value={baseplateParams.paddingFront}
          onChange={(v) => updateParam('paddingFront', v)}
        />
      </div>

      <p className="text-center text-xs tabular-nums text-content-tertiary">
        {t('baseplate.totalDimensions', {
          width: Math.round(totalWidthMm),
          depth: Math.round(totalDepthMm),
        })}
      </p>
    </div>
  );
}

interface SideStepperProps {
  readonly ariaLabel: string;
  readonly value: number;
  readonly onChange: (value: number) => void;
}

const PADDING_BUTTON_STEP = 1;
const PADDING_INPUT_STEP = 0.1;
const PADDING_MIN = 0;
const PADDING_MAX = 100;

const sideStepperBtnClass =
  'flex h-6 w-8 items-center justify-center border border-stroke-subtle bg-surface-elevated text-content-tertiary hover:bg-surface-hover hover:text-content disabled:opacity-30';

/** Compact vertical stepper for left/right edges — value + buttons stacked to save width. */
function SideStepper({ ariaLabel, value, onChange }: SideStepperProps) {
  const [localText, setLocalText] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const skipBlurCommit = useRef(false);

  const displayValue = Math.round(value * 10) / 10;

  const commit = useCallback(
    (text: string) => {
      const v = parseFloat(text);
      if (!Number.isNaN(v) && v >= PADDING_MIN && v <= PADDING_MAX) {
        onChange(Math.round(v / PADDING_INPUT_STEP) * PADDING_INPUT_STEP);
      }
    },
    [onChange]
  );

  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        className={`${sideStepperBtnClass} rounded-t-md border-b-0`}
        onClick={() => onChange(Math.min(PADDING_MAX, value + PADDING_BUTTON_STEP))}
        disabled={value >= PADDING_MAX}
        aria-label={`${ariaLabel} increment`}
      >
        <ChevronDownIcon size="xs" className="rotate-180" />
      </button>
      <input
        type="text"
        inputMode="decimal"
        className="w-8 border border-stroke-subtle bg-surface px-0 py-0.5 text-center text-xs tabular-nums text-content-secondary outline-none focus:ring-1 focus:ring-accent"
        value={isFocused ? localText : displayValue}
        onChange={(e) => setLocalText(e.target.value)}
        onFocus={() => {
          setLocalText(String(displayValue));
          setIsFocused(true);
        }}
        onBlur={() => {
          if (!skipBlurCommit.current) {
            commit(localText);
          }
          skipBlurCommit.current = false;
          setIsFocused(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            commit(localText);
            skipBlurCommit.current = true;
            e.currentTarget.blur();
          }
          if (e.key === 'Escape') {
            setLocalText(String(displayValue));
            skipBlurCommit.current = true;
            e.currentTarget.blur();
          }
        }}
        aria-label={ariaLabel}
      />
      <button
        type="button"
        className={`${sideStepperBtnClass} rounded-b-md border-t-0`}
        onClick={() => onChange(Math.max(PADDING_MIN, value - PADDING_BUTTON_STEP))}
        disabled={value <= PADDING_MIN}
        aria-label={`${ariaLabel} decrement`}
      >
        <ChevronDownIcon size="xs" />
      </button>
    </div>
  );
}

interface PaddingStepperProps {
  readonly label: string;
  readonly value: number;
  readonly onChange: (value: number) => void;
}

/** Compact stepper for a single padding value (mm). */
function PaddingStepper({ label, value, onChange }: PaddingStepperProps) {
  return (
    <div className="w-fit flex flex-col items-center gap-0.5">
      <span className="text-xs text-content-tertiary">{label}</span>
      <Stepper
        size="sm"
        value={value}
        onChange={onChange}
        onStep={(delta) => onChange(Math.max(PADDING_MIN, value + delta))}
        min={PADDING_MIN}
        max={PADDING_MAX}
        step={PADDING_INPUT_STEP}
        aria-label={label}
      />
    </div>
  );
}

interface GridDimensionStepperProps {
  readonly label: string;
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly halfBinMode: boolean;
  readonly disabled: boolean;
}

/** Compact stepper for a custom grid width or depth dimension (grid units). */
function GridDimensionStepper({
  label,
  value,
  onChange,
  halfBinMode,
  disabled,
}: GridDimensionStepperProps) {
  const step = halfBinMode ? 0.5 : 1;
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

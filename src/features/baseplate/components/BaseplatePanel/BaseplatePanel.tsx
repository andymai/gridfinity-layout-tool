/**
 * Parameter panel for the standalone baseplate page.
 *
 * Organized into collapsible StickyGroupHeader sections:
 * - Grid: dimensions (read-only), print bed size
 * - Fit to Drawer: per-side padding steppers
 * - Split Pieces: split info, assembled/exploded toggle, piece mini-map (conditional)
 * - Magnets: magnet holes toggle with customize expand
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
import { FeatureToggle } from '@/shared/components/FeatureToggle';
import { SliderInput } from '@/shared/components/SliderInput';
import { SegmentedControl } from '@/shared/components/SegmentedControl';
import { useBaseplatePageStore } from '../../store/baseplatePageStore';
import { colToLetter } from '../../utils/splitPlanner';
import type { BaseplateParams } from '@/core/types';
import type { BaseplateTiling } from '../../types/tiling';
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

  const { tiling, splitViewMode } = useBaseplatePageStore(
    useShallow((s) => ({
      tiling: s.tiling,
      splitViewMode: s.splitViewMode,
    }))
  );
  const setSplitViewMode = useBaseplatePageStore((s) => s.setSplitViewMode);

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
        {/* Grid section */}
        <StickyGroupHeader title={t('baseplate.sectionGrid')} summary={gridSummary}>
          <div className="space-y-3 px-4 py-3">
            {/* Grid dimensions (read-only info line) */}
            <div className="text-xs tabular-nums text-content-tertiary">
              {t('baseplate.gridDimensions', {
                width: Math.round(gridWidthMm),
                depth: Math.round(gridDepthMm),
              })}
            </div>

            {/* Print bed size */}
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-content-tertiary">{t('baseplate.printBedSize')}</span>
              <div className="flex items-center gap-2">
                <Stepper
                  size="sm"
                  value={printBedSize}
                  onChange={handlePrintBedChange}
                  onStep={(delta) => handlePrintBedChange(printBedSize + delta)}
                  min={42}
                  max={500}
                  step={1}
                  aria-label={t('baseplate.printBedSize')}
                />
                <span className="text-xs text-content-tertiary">mm</span>
              </div>
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

        {/* Padding section */}
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

        {/* Split info section (shown when baseplate exceeds bed) */}
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
            />
          </StickyGroupHeader>
        )}

        {/* Magnet holes section */}
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
}: {
  tiling: BaseplateTiling;
  viewMode: SplitViewMode;
  viewModeOptions: ReadonlyArray<{ value: SplitViewMode; label: string }>;
  onViewModeChange: (mode: SplitViewMode) => void;
}) {
  const t = useTranslation();

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
        {Array.from({ length: tiling.rows }, (_, r) =>
          Array.from({ length: tiling.cols }, (_, c) => {
            const label = `${colToLetter(c)}${r + 1}`;
            return (
              <div
                key={label}
                className="flex items-center justify-center rounded border border-stroke-subtle bg-surface-elevated py-1 text-[10px] font-mono text-content-tertiary"
              >
                {label}
              </div>
            );
          })
        )}
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
        step={0.5}
        aria-label={label}
      />
    </div>
  );
}

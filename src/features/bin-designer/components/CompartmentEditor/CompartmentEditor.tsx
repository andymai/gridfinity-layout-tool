/**
 * Visual compartment grid editor (sidebar surface).
 *
 * Displays a top-down 2D view of the bin interior divided into a user-defined
 * grid. Users can:
 * 1. Set grid dimensions (rows x cols) via stepper controls
 * 2. Click-drag to select a rectangular region of cells
 * 3. Merge selected cells into one compartment (or split merged ones)
 *
 * The grid uses a cell-ownership model: cells with the same compartment ID
 * form one rectangular compartment. Divider walls are automatically derived
 * from boundaries between cells with different IDs.
 *
 * The editing model lives in `useCompartmentGrid` and the grid itself in
 * `CompartmentGridView`, both shared with the full-size Bento workspace. What
 * remains here is the sidebar's own chrome: the grid steppers, the by-size
 * solver, wall thickness and the divider subsections.
 *
 * Cell and ghost sub-components live in `CompartmentEditorParts.tsx`.
 */

import { useCallback, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DESIGNER_CONSTRAINTS, WALL_THICKNESS_OPTIONS } from '@/features/bin-designer/constants';
import { Button, Stepper, InfoIcon } from '@/design-system';
import { DeferredNumberInput } from '@/shared/components/DeferredNumberInput';
import { SnappingSlider } from '../controls/SnappingSlider';
import type { SnappingSliderOption } from '../controls/SnappingSlider';
import {
  minUniformCavity,
  solveCountForMinCavity,
} from '@/features/bin-designer/utils/compartmentDimensions';
import { useTranslation } from '@/i18n';
import { useResponsive } from '@/shared/hooks/useResponsive';
import { DividerHeightControl } from './DividerHeightControl';
import { DividerTiltSubsection } from './DividerTiltSubsection';
import { CompartmentGridView } from './CompartmentGridView';
import { useCompartmentGrid } from './useCompartmentGrid';
import { getSegmentClass, SEGMENT_GROUP_CLASS } from '@/shared/components/segmentedControlClasses';

// Bounding box the 2D grid is scaled to fit, at the bin's true proportions.
const GRID_ENVELOPE_W_PX = 360;
const GRID_ENVELOPE_H_PX = 300;

export function CompartmentEditor() {
  const t = useTranslation();
  const { isMobile } = useResponsive();
  const stepperSize = isMobile ? 'lg' : 'md';

  const grid = useCompartmentGrid();
  const {
    cols,
    rows,
    thickness,
    interiorW,
    interiorD,
    compartmentCount,
    hasMergedCompartments,
    aspectRatio,
    labeling,
    isDragging,
    selectionAction,
    hoveredIsSplittable,
    instructionText,
    applyGrid,
    stepGrid,
    handleThicknessChange,
    handleReset,
  } = grid;

  const { labelSpan, labelEnabled, updateLabel } = useDesignerStore(
    useShallow((s) => ({
      labelSpan: s.params.label.span === true,
      labelEnabled: s.params.label.enabled,
      updateLabel: s.updateLabel,
    }))
  );

  // Manual size entry is an advanced opt-in; the grid steppers are the default.
  const [showSizer, setShowSizer] = useState(false);

  const handleColsChange = useCallback(
    (newCols: number) => {
      applyGrid(newCols, rows);
    },
    [rows, applyGrid]
  );

  const handleColsStep = useCallback((delta: number) => stepGrid('cols', delta), [stepGrid]);

  const handleRowsChange = useCallback(
    (newRows: number) => {
      applyGrid(cols, newRows);
    },
    [cols, applyGrid]
  );

  const handleRowsStep = useCallback((delta: number) => stepGrid('rows', delta), [stepGrid]);

  // Size-led entry (fit-guarantee): typing a minimum opening picks the largest
  // count whose tightest compartment stays >= the requested mm, so every
  // compartment is at least that size. The mm fields are a solver entry point —
  // they don't store a target; the grid (cols/rows) is the single source of
  // truth, and the fields always reflect the achieved smallest opening.
  // setCompartmentGrid regenerates the uniform grid (it validates min cell size
  // and silently no-ops if the target is infeasible).
  const applyTargetWidth = useCallback(
    (target: number) => {
      const clamped = Math.min(
        interiorW,
        Math.max(DESIGNER_CONSTRAINTS.MIN_COMPARTMENT_SIZE, target)
      );
      applyGrid(
        solveCountForMinCavity(
          interiorW,
          thickness,
          clamped,
          DESIGNER_CONSTRAINTS.MIN_COMPARTMENT_GRID,
          DESIGNER_CONSTRAINTS.MAX_COMPARTMENT_GRID
        ),
        rows
      );
    },
    [interiorW, thickness, rows, applyGrid]
  );

  const applyTargetDepth = useCallback(
    (target: number) => {
      const clamped = Math.min(
        interiorD,
        Math.max(DESIGNER_CONSTRAINTS.MIN_COMPARTMENT_SIZE, target)
      );
      applyGrid(
        cols,
        solveCountForMinCavity(
          interiorD,
          thickness,
          clamped,
          DESIGNER_CONSTRAINTS.MIN_COMPARTMENT_GRID,
          DESIGNER_CONSTRAINTS.MAX_COMPARTMENT_GRID
        )
      );
    },
    [interiorD, thickness, cols, applyGrid]
  );

  // The mm fields show the smallest (worst-case interior) opening per axis — the
  // value the fit-guarantee is measured against. Rounded to 0.1mm for display so
  // the field never shows a stale or contradictory number relative to the grid.
  const achievedMinW = Math.round(minUniformCavity(interiorW, cols, thickness) * 10) / 10;
  const achievedMinD = Math.round(minUniformCavity(interiorD, rows, thickness) * 10) / 10;

  // Surface the grid cap so a too-small entry that clamps at the max isn't a
  // silent surprise (e.g. typing 5mm into a large bin tops out at 12 across).
  const atMaxGrid =
    cols >= DESIGNER_CONSTRAINTS.MAX_COMPARTMENT_GRID ||
    rows >= DESIGNER_CONSTRAINTS.MAX_COMPARTMENT_GRID;

  // Standalone styling for the size inputs (the Stepper owns its own input
  // styling, but the mm fields are bare DeferredNumberInputs).
  const sizeInputClass =
    stepperSize === 'lg'
      ? 'input w-full h-12 text-center font-semibold tabular-nums'
      : 'w-full h-8 rounded border border-stroke-subtle bg-surface text-center text-sm tabular-nums text-content-secondary';

  // Render the grid at the bin's true top-view proportions, scaled to fit a
  // fixed envelope. Capping width to `MAX_H * aspect` keeps the derived height
  // within budget while preserving the real shape — so deep bins stay legible
  // instead of ballooning, and the box never overflows onto the controls above.
  const gridMaxWidthPx = Math.min(GRID_ENVELOPE_W_PX, GRID_ENVELOPE_H_PX * aspectRatio);

  // Build wall thickness options for SnappingSlider
  const thicknessOptions: SnappingSliderOption[] = useMemo(
    () =>
      WALL_THICKNESS_OPTIONS.map((value) => ({
        value,
        description: t(`binDesigner.wallThickness.${value}`),
      })),
    [t]
  );

  return (
    <div className="space-y-5">
      {/* Compartment grid: the primary control is the Columns/Rows steppers.
          Setting the grid by a target compartment size is an advanced opt-in
          (collapsed by default) that snaps the same cols×rows via the
          fit-guarantee solver — the steppers stay the single source of truth. */}
      <section className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="mb-1 block text-xs text-content-tertiary">
              {t('binDesigner.columns')}
            </span>
            <Stepper
              value={cols}
              onChange={handleColsChange}
              onStep={handleColsStep}
              min={DESIGNER_CONSTRAINTS.MIN_COMPARTMENT_GRID}
              max={DESIGNER_CONSTRAINTS.MAX_COMPARTMENT_GRID}
              step={1}
              size={stepperSize}
              aria-label={t('binDesigner.columns')}
            />
          </div>
          <div>
            <span className="mb-1 block text-xs text-content-tertiary">
              {t('binDesigner.rows')}
            </span>
            <Stepper
              value={rows}
              onChange={handleRowsChange}
              onStep={handleRowsStep}
              min={DESIGNER_CONSTRAINTS.MIN_COMPARTMENT_GRID}
              max={DESIGNER_CONSTRAINTS.MAX_COMPARTMENT_GRID}
              step={1}
              size={stepperSize}
              aria-label={t('binDesigner.rows')}
            />
          </div>
        </div>

        {/* Always-visible readout of the resulting compartment size, so the
            actual mm dimensions are legible at a glance — no hover required —
            whether the grid was set by the steppers or by size. Shows the
            smallest (worst-case interior) compartment; edges may be wider. */}
        <p className="text-xs tabular-nums text-content-secondary" aria-live="polite">
          {atMaxGrid
            ? `${t('binDesigner.compartmentEditor.maxGridReached', { max: DESIGNER_CONSTRAINTS.MAX_COMPARTMENT_GRID })} · `
            : ''}
          {t('binDesigner.compartmentEditor.sizeReadout', {
            width: achievedMinW,
            depth: achievedMinD,
          })}
        </p>

        {/* Advanced: set the grid by a minimum compartment size in mm. */}
        <div>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setShowSizer((v) => !v)}
            aria-expanded={showSizer}
            className="flex items-center gap-1 rounded-none px-0 py-0 hover:bg-transparent text-label font-medium text-content-secondary hover:text-content"
          >
            <svg
              className={`h-3 w-3 transition-transform ${showSizer ? 'rotate-90' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            {t('binDesigner.compartmentEditor.setBySize')}
          </Button>

          {showSizer && (
            <div className="mt-2 space-y-2 border-l border-stroke-subtle pl-3">
              <span className="block text-xs text-content-tertiary">
                {t('binDesigner.compartmentEditor.smallestOpening')}
              </span>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="mb-1 block text-xs text-content-tertiary">
                    {t('binDesigner.compartmentEditor.openingWidth')}
                  </span>
                  <DeferredNumberInput
                    value={achievedMinW}
                    onChange={applyTargetWidth}
                    min={DESIGNER_CONSTRAINTS.MIN_COMPARTMENT_SIZE}
                    max={Math.round(interiorW)}
                    step={1}
                    decimals={1}
                    className={sizeInputClass}
                    aria-label={t('binDesigner.compartmentEditor.openingWidth')}
                  />
                </div>
                <div>
                  <span className="mb-1 block text-xs text-content-tertiary">
                    {t('binDesigner.compartmentEditor.openingDepth')}
                  </span>
                  <DeferredNumberInput
                    value={achievedMinD}
                    onChange={applyTargetDepth}
                    min={DESIGNER_CONSTRAINTS.MIN_COMPARTMENT_SIZE}
                    max={Math.round(interiorD)}
                    step={1}
                    decimals={1}
                    className={sizeInputClass}
                    aria-label={t('binDesigner.compartmentEditor.openingDepth')}
                  />
                </div>
              </div>
              {/* Explains why typed sizes round up and discloses the edge
                  asymmetry (the grid cap is announced in the readout above). */}
              <p className="text-label text-content-tertiary">
                {t('binDesigner.compartmentEditor.tileEvenlyNote')}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* 2D Layout editor (hidden when 1x1 grid) */}
      {(cols > 1 || rows > 1) && (
        <section>
          {/* Mode switch: divider editing vs. labeling. Only offered for grid
              dividers (label tabs don't apply to slotted/solid interiors). */}
          {labeling.canLabel && (
            <div
              role="group"
              aria-label={t('binDesigner.compartmentEditor.modeLabel')}
              className={`mb-3 ${SEGMENT_GROUP_CLASS}`}
            >
              <Button
                type="button"
                variant="ghost"
                touchTarget={false}
                onClick={() => labeling.setLabelMode(false)}
                aria-pressed={!labeling.labelMode}
                className={`flex-1 ${getSegmentClass(!labeling.labelMode)}`}
              >
                {t('binDesigner.compartmentEditor.modeDividers')}
              </Button>
              {/* Full-width labels read `label.rowTexts`, so per-compartment
                  text edited here would render nothing (#2897). The stored
                  texts are kept and return when span is switched off. */}
              <Button
                type="button"
                variant="ghost"
                touchTarget={false}
                disabled={labelSpan}
                title={
                  labelSpan ? t('binDesigner.compartmentEditor.labelsSpanDisabled') : undefined
                }
                onClick={() => labeling.setLabelMode(true)}
                aria-pressed={labeling.labelMode}
                className={`flex-1 ${getSegmentClass(labeling.labelMode)}`}
              >
                {t('binDesigner.compartmentEditor.modeLabels')}
              </Button>
            </div>
          )}
          <div className="mb-3 flex items-center justify-between">
            <p
              id="compartment-grid-instructions"
              className={`text-xs transition-colors duration-150 ${
                isDragging && selectionAction !== 'none'
                  ? 'text-accent font-medium'
                  : hoveredIsSplittable
                    ? 'text-content-secondary'
                    : 'text-content-tertiary'
              }`}
              aria-live={isDragging ? 'off' : 'polite'}
            >
              {instructionText}
            </p>
            {hasMergedCompartments && (
              <Button
                type="button"
                variant="ghost"
                onClick={handleReset}
                className="rounded-none px-0 py-0 hover:bg-transparent text-label font-medium text-accent hover:text-accent/80 transition-colors"
                aria-label={t('binDesigner.resetCompartmentLayoutToUniformGrid')}
              >
                {t('common.reset')}
              </Button>
            )}
          </div>

          <CompartmentGridView
            grid={grid}
            className="mr-auto w-full"
            style={{ maxWidth: `${gridMaxWidthPx}px` }}
            describedById="compartment-grid-instructions"
          />

          {labeling.labelMode && (
            <>
              {/* No input here: clicking a cell focuses that compartment's row in
                  the Label tabs list, which is the single editor. A second field
                  on this surface was the same data with its own draft state. */}
              <div className="mt-2 flex items-start gap-2 text-xs text-content-tertiary">
                <InfoIcon size="xs" className="mt-0.5 shrink-0" />
                {labelEnabled ? (
                  <span className="flex-1">
                    {t('binDesigner.compartmentEditor.labelsEditInPanel')}
                  </span>
                ) : (
                  <>
                    <span className="flex-1">
                      {t('binDesigner.compartmentEditor.labelsNeedTabs')}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      touchTarget={false}
                      onClick={() => updateLabel({ enabled: true })}
                      className="shrink-0 px-0 font-medium text-accent hover:bg-transparent hover:text-accent/80"
                    >
                      {t('binDesigner.compartmentEditor.enableLabelTabs')}
                    </Button>
                  </>
                )}
              </div>
            </>
          )}
        </section>
      )}

      {/* Wall thickness + divider height (only when there are dividers). */}
      {compartmentCount > 1 && (
        <section className="space-y-4">
          <SnappingSlider
            label={t('binDesigner.dividerThickness')}
            value={thickness}
            onChange={handleThicknessChange}
            options={thicknessOptions}
            unit="mm"
          />
          <DividerHeightControl />
        </section>
      )}

      <DividerTiltSubsection />
    </div>
  );
}

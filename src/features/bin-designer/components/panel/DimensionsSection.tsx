/**
 * Dimensions section: Width, Depth, Height with stepper controls,
 * half-bin mode toggle, and physical unit settings.
 *
 * Layout matches the bin inspector: width/depth on same row with swap button,
 * height on its own row.
 */

import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DESIGNER_CONSTRAINTS } from '@/features/bin-designer/constants';
import { CollapsibleSection } from '@/shared/components/CollapsibleSection';
import { StepperControl } from '@/shared/components/StepperControl';
import { Checkbox } from '@/shared/components/Checkbox';
import { DimensionsIcon } from './SectionIllustrations';
import { useTranslation } from '@/i18n';

export function DimensionsSection() {
  const {
    width,
    depth,
    height,
    gridUnitMm,
    heightUnitMm,
    halfBinMode,
    setParam,
    setParams,
    toggleHalfBinMode,
  } = useDesignerStore(
    useShallow((s) => ({
      width: s.params.width,
      depth: s.params.depth,
      height: s.params.height,
      gridUnitMm: s.params.gridUnitMm,
      heightUnitMm: s.params.heightUnitMm,
      halfBinMode: s.ui.halfBinMode,
      setParam: s.setParam,
      setParams: s.setParams,
      toggleHalfBinMode: s.toggleHalfBinMode,
    }))
  );
  const t = useTranslation();

  // Step sizes depend on half-bin mode
  const dimensionStep = halfBinMode ? 0.5 : 1;
  const minDimension = halfBinMode ? 0.5 : 1;

  // Physical mm calculations using per-bin unit settings
  const widthMm = width * gridUnitMm;
  const depthMm = depth * gridUnitMm;
  const heightMm = height * heightUnitMm;

  const summary = `${width}×${depth} × ${height}u (${widthMm.toFixed(0)}×${depthMm.toFixed(0)}×${heightMm.toFixed(0)}mm)`;

  const handleWidthStep = useCallback(
    (delta: number) => {
      const next = width + delta * dimensionStep;
      const clamped = Math.min(DESIGNER_CONSTRAINTS.MAX_DIMENSION, Math.max(minDimension, next));
      setParam('width', clamped);
    },
    [width, dimensionStep, minDimension, setParam]
  );

  const handleDepthStep = useCallback(
    (delta: number) => {
      const next = depth + delta * dimensionStep;
      const clamped = Math.min(DESIGNER_CONSTRAINTS.MAX_DIMENSION, Math.max(minDimension, next));
      setParam('depth', clamped);
    },
    [depth, dimensionStep, minDimension, setParam]
  );

  const handleHeightStep = useCallback(
    (delta: number) => {
      const next = height + delta * DESIGNER_CONSTRAINTS.HEIGHT_STEP;
      const clamped = Math.min(
        DESIGNER_CONSTRAINTS.MAX_HEIGHT,
        Math.max(DESIGNER_CONSTRAINTS.MIN_HEIGHT, next)
      );
      setParam('height', clamped);
    },
    [height, setParam]
  );

  const handleSwapDimensions = useCallback(() => {
    setParams({ width: depth, depth: width });
  }, [width, depth, setParams]);

  return (
    <CollapsibleSection
      title={t('binDesigner.dimensions')}
      defaultExpanded={true}
      illustration={<DimensionsIcon />}
      summary={summary}
    >
      <div className="space-y-3">
        {/* Width and Depth on same row with swap button */}
        <div className="flex items-end gap-2">
          {/* Width */}
          <div className="flex-1 min-w-0">
            <span className="mb-1 block text-xs text-content-tertiary">{t('common.width')}</span>
            <StepperControl
              value={width}
              onChange={(v) => setParam('width', v)}
              onStep={handleWidthStep}
              min={minDimension}
              max={DESIGNER_CONSTRAINTS.MAX_DIMENSION}
              step={dimensionStep}
              variant="desktop"
              ariaLabel="Width"
            />
          </div>

          {/* Swap button */}
          <button
            type="button"
            onClick={handleSwapDimensions}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded border border-stroke-subtle bg-surface-elevated text-content-tertiary transition-colors hover:bg-surface-hover hover:text-content"
            title={t('inspector.swapDimensions')}
            aria-label={t('inspector.swapWidthAndDepth')}
          >
            <svg
              className="h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
              />
            </svg>
          </button>

          {/* Depth */}
          <div className="flex-1 min-w-0">
            <span className="mb-1 block text-xs text-content-tertiary">{t('common.depth')}</span>
            <StepperControl
              value={depth}
              onChange={(v) => setParam('depth', v)}
              onStep={handleDepthStep}
              min={minDimension}
              max={DESIGNER_CONSTRAINTS.MAX_DIMENSION}
              step={dimensionStep}
              variant="desktop"
              ariaLabel="Depth"
            />
          </div>
        </div>

        {/* Physical dimensions display */}
        <div className="flex items-center gap-1.5 text-xs text-content-tertiary">
          <svg
            className="h-3.5 w-3.5 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 12h16M4 12v-2M8 12v-1M12 12v-2M16 12v-1M20 12v-2"
            />
          </svg>
          <span className="tabular-nums">
            {widthMm.toFixed(0)} × {depthMm.toFixed(0)} × {heightMm.toFixed(0)} mm
          </span>
        </div>

        {/* Height */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs text-content-tertiary">{t('common.height')}</span>
            <span className="text-[11px] tabular-nums text-content-tertiary">{height}u</span>
          </div>
          <StepperControl
            value={height}
            onChange={(v) => setParam('height', v)}
            onStep={handleHeightStep}
            min={DESIGNER_CONSTRAINTS.MIN_HEIGHT}
            max={DESIGNER_CONSTRAINTS.MAX_HEIGHT}
            step={DESIGNER_CONSTRAINTS.HEIGHT_STEP}
            variant="desktop"
            ariaLabel="Height"
          />
        </div>

        {/* Half-bin mode toggle */}
        <div
          className="group flex items-center justify-between pt-2 cursor-pointer rounded-md px-1 -mx-1 py-1 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          onClick={toggleHalfBinMode}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggleHalfBinMode();
            }
          }}
          role="checkbox"
          aria-checked={halfBinMode}
          aria-label={t('binDesigner.halfBinModeEnable05Grid')}
          tabIndex={0}
        >
          <span
            className={`text-xs leading-none transition-colors ${halfBinMode ? 'text-content' : 'text-content-tertiary group-hover:text-content-secondary'}`}
          >
            {t('binDesigner.halfBinMode')}
          </span>
          <Checkbox checked={halfBinMode} variant="desktop" />
        </div>
      </div>
    </CollapsibleSection>
  );
}

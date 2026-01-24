/**
 * Dimensions section: Width, Depth, Height with stepper controls,
 * half-bin mode toggle, and physical unit settings.
 */

import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DESIGNER_CONSTRAINTS } from '@/features/bin-designer/constants';
import { CollapsibleSection } from '@/shared/components/CollapsibleSection';
import { StepperControl } from '@/shared/components/StepperControl';
import { Checkbox } from '@/shared/components/Checkbox';
import { DimensionsIcon } from './SectionIllustrations';

export function DimensionsSection() {
  const {
    width,
    depth,
    height,
    gridUnitMm,
    heightUnitMm,
    halfBinMode,
    setParam,
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
      toggleHalfBinMode: s.toggleHalfBinMode,
    }))
  );

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

  return (
    <CollapsibleSection
      title="Dimensions"
      defaultExpanded={true}
      illustration={<DimensionsIcon />}
      summary={summary}
    >
      <div className="space-y-3">
        {/* Width */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs text-content-tertiary">Width</span>
            <span className="text-[11px] tabular-nums text-content-tertiary">
              {widthMm.toFixed(0)}mm
            </span>
          </div>
          <StepperControl
            value={width}
            onChange={(v) => setParam('width', v)}
            onStep={handleWidthStep}
            min={minDimension}
            max={DESIGNER_CONSTRAINTS.MAX_DIMENSION}
            step={dimensionStep}
            variant="compact"
            ariaLabel="Width"
          />
        </div>

        {/* Depth */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs text-content-tertiary">Depth</span>
            <span className="text-[11px] tabular-nums text-content-tertiary">
              {depthMm.toFixed(0)}mm
            </span>
          </div>
          <StepperControl
            value={depth}
            onChange={(v) => setParam('depth', v)}
            onStep={handleDepthStep}
            min={minDimension}
            max={DESIGNER_CONSTRAINTS.MAX_DIMENSION}
            step={dimensionStep}
            variant="compact"
            ariaLabel="Depth"
          />
        </div>

        {/* Height */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs text-content-tertiary">Height</span>
            <span className="text-[11px] tabular-nums text-content-tertiary">
              {heightMm.toFixed(0)}mm body
            </span>
          </div>
          <StepperControl
            value={height}
            onChange={(v) => setParam('height', v)}
            onStep={handleHeightStep}
            min={DESIGNER_CONSTRAINTS.MIN_HEIGHT}
            max={DESIGNER_CONSTRAINTS.MAX_HEIGHT}
            step={DESIGNER_CONSTRAINTS.HEIGHT_STEP}
            variant="compact"
            ariaLabel="Height"
          />
        </div>

        {/* Half-bin mode toggle */}
        <div
          className="flex items-center justify-between pt-2 cursor-pointer"
          onClick={toggleHalfBinMode}
        >
          <div className="flex items-center gap-1.5">
            <span
              className={`text-xs leading-none ${halfBinMode ? 'text-content' : 'text-content-tertiary'}`}
              title="Enable 0.5 grid unit precision for half-size bins"
            >
              Half-bin mode
            </span>
            <span className="text-[9px] leading-none text-warning bg-warning-muted px-1 py-0.5 rounded">
              experimental
            </span>
          </div>
          <Checkbox checked={halfBinMode} variant="desktop" />
        </div>
      </div>
    </CollapsibleSection>
  );
}

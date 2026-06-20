/**
 * Dimensions section: Width, Depth, Height with stepper controls,
 * half-bin mode toggle, and physical unit settings.
 *
 * Layout matches the bin inspector: width/depth on same row with swap button,
 * height on its own row.
 */

import { DESIGNER_CONSTRAINTS } from '@/features/bin-designer/constants';
import { Checkbox, IconButton, Stepper } from '@/design-system';
import { ArrowLeftRightIcon, RulerIcon } from '@/design-system/Icon';
import { FractionalEdgeToggle } from '@/shared/components/FractionalEdgeToggle';
import { useResponsive } from '@/shared/hooks/useResponsive';
import { useDimensionsSection } from './useDimensionsSection';

export function DimensionsSection() {
  const { state, handlers, t } = useDimensionsSection();
  const { isMobile } = useResponsive();
  const checkboxSize = isMobile ? 'lg' : 'md';
  const stepperSize = isMobile ? 'lg' : 'md';

  return (
    <div className="space-y-3">
      {/* Width and Depth on same row with swap button */}
      <div className="flex items-end justify-center gap-2">
        {/* Width */}
        <div className="flex flex-col">
          <span className="mb-1 block text-xs text-content-tertiary">{t('common.width')}</span>
          <Stepper
            value={state.width}
            onChange={(v) => handlers.setParam('width', v)}
            onStep={handlers.handleWidthStep}
            min={state.minWidth}
            max={DESIGNER_CONSTRAINTS.MAX_DIMENSION}
            step={state.dimensionStep}
            size={stepperSize}
            aria-label={t('common.width')}
          />
        </div>

        {/* Swap button */}
        <IconButton
          type="button"
          variant="secondary"
          touchTarget={false}
          onClick={handlers.handleSwapDimensions}
          className={`${isMobile ? 'h-12 w-12' : 'h-8 w-8'} flex-shrink-0 text-content-tertiary`}
          title={t('inspector.swapDimensions')}
          aria-label={t('inspector.swapWidthAndDepth')}
        >
          <ArrowLeftRightIcon size={isMobile ? 'md' : 'xs'} />
        </IconButton>

        {/* Depth */}
        <div className="flex flex-col">
          <span className="mb-1 block text-xs text-content-tertiary">{t('common.depth')}</span>
          <Stepper
            value={state.depth}
            onChange={(v) => handlers.setParam('depth', v)}
            onStep={handlers.handleDepthStep}
            min={state.minDepth}
            max={DESIGNER_CONSTRAINTS.MAX_DIMENSION}
            step={state.dimensionStep}
            size={stepperSize}
            aria-label={t('common.depth')}
          />
        </div>
      </div>

      {/* Physical dimensions display */}
      <div className="flex items-center justify-center gap-1.5 text-xs text-content-tertiary">
        <RulerIcon size="xs" />
        <span className="tabular-nums">
          {state.widthMm.toFixed(0)} × {state.depthMm.toFixed(0)} × {state.heightMm.toFixed(0)} mm
        </span>
      </div>

      {/* Half-unit foot placement — shown when a dimension is fractional. Lets a
          2.5×2 bin put its half foot on either side without rotating the print. */}
      {(state.hasFractionalWidth || state.hasFractionalDepth) && (
        <div className="space-y-1.5 text-xs">
          <div className="text-content-tertiary text-[10px]">
            {t('sidebar.halfUnitEdgePosition')}
          </div>
          {state.hasFractionalWidth && (
            <FractionalEdgeToggle
              axis="x"
              label={t('common.width')}
              value={state.fractionalEdgeX}
              onChange={handlers.handleFractionalEdgeChange}
              startTitle={t('sidebar.halfBinLeft')}
              startLabel={t('sidebar.left')}
              endTitle={t('sidebar.halfBinRight')}
              endLabel={t('sidebar.right')}
            />
          )}
          {state.hasFractionalDepth && (
            <FractionalEdgeToggle
              axis="y"
              label={t('common.depth')}
              value={state.fractionalEdgeY}
              onChange={handlers.handleFractionalEdgeChange}
              startTitle={t('sidebar.halfBinBottom')}
              startLabel={t('sidebar.bottom')}
              endTitle={t('sidebar.halfBinTop')}
              endLabel={t('sidebar.top')}
            />
          )}
        </div>
      )}

      {/* Height */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs text-content-tertiary">{t('common.height')}</span>
          <span className="text-[11px] tabular-nums text-content-tertiary">{state.height}u</span>
        </div>
        <Stepper
          value={state.height}
          onChange={(v) => handlers.setParam('height', v)}
          onStep={handlers.handleHeightStep}
          min={DESIGNER_CONSTRAINTS.MIN_HEIGHT}
          max={DESIGNER_CONSTRAINTS.MAX_HEIGHT}
          step={DESIGNER_CONSTRAINTS.HEIGHT_STEP}
          size={stepperSize}
          fullWidth
          aria-label={t('common.height')}
        />
      </div>

      {/* Half-bin mode toggle */}
      <div
        className="group flex items-center justify-between cursor-pointer rounded-md px-1 -mx-1 py-1 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
        onClick={handlers.toggleHalfGridMode}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handlers.toggleHalfGridMode();
          }
        }}
        role="checkbox"
        aria-checked={state.halfGridMode}
        aria-label={t('binDesigner.halfBinModeEnable05Grid')}
        tabIndex={0}
      >
        <span
          className={`text-xs leading-none transition-colors ${state.halfGridMode ? 'text-content' : 'text-content-tertiary group-hover:text-content-secondary'}`}
        >
          {t('binDesigner.halfBinMode')}
        </span>
        <Checkbox checked={state.halfGridMode} size={checkboxSize} />
      </div>
    </div>
  );
}

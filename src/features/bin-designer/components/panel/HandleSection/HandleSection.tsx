/**
 * Handle section: interior grip ledges on bin walls.
 *
 * Controls: master toggle, side chip toggles (F/B/L/R),
 * width/depth/fillet-radius steppers.
 */

import { FeatureToggle } from '../FeatureToggle';
import { StepperControl } from '@/shared/components/StepperControl';
import { DESIGNER_CONSTRAINTS } from '../../../constants';
import { useHandleSection, HANDLE_SIDES } from './useHandleSection';

export function HandleSection() {
  const { state, handlers, meta, t } = useHandleSection();
  const { handles, isBackDisabled, handleWidthMm } = state;

  return (
    <FeatureToggle
      label={t('binDesigner.handles')}
      checked={handles.enabled}
      onChange={handlers.toggleEnabled}
      disabledReason={meta.disabledReason}
      valueSummary={meta.summary}
    >
      {/* Side toggle chips */}
      <div className="flex gap-1">
        {HANDLE_SIDES.map((side) => {
          const isActive = handles[side].enabled;
          const isDisabled = side === 'back' && isBackDisabled;
          return (
            <button
              key={side}
              type="button"
              role="switch"
              aria-checked={isActive}
              disabled={isDisabled}
              title={isDisabled ? t('binDesigner.handles.backDisabledByLabelTab') : undefined}
              onClick={() => handlers.toggleSide(side)}
              className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                isDisabled
                  ? 'border border-stroke-subtle bg-surface-secondary text-content-tertiary cursor-not-allowed opacity-50'
                  : isActive
                    ? 'bg-accent text-on-accent'
                    : 'border border-stroke-subtle bg-surface-elevated text-content-secondary hover:bg-surface-hover'
              }`}
            >
              {t(`binDesigner.handles.${side}`)}
            </button>
          );
        })}
      </div>

      {/* Width + Depth steppers side by side */}
      <div className="flex items-end gap-2">
        <div className="flex-1 min-w-0">
          <span className="mb-1 block text-xs text-content-tertiary">
            {/* eslint-disable-next-line i18next/no-literal-string -- unit suffix */}
            {t('binDesigner.handles.width')} {'(%)'}
          </span>
          <StepperControl
            value={handles.width}
            onChange={handlers.setWidth}
            onStep={(delta) =>
              handlers.setWidth(
                Math.min(
                  DESIGNER_CONSTRAINTS.MAX_HANDLE_WIDTH,
                  Math.max(
                    DESIGNER_CONSTRAINTS.MIN_HANDLE_WIDTH,
                    handles.width + delta * DESIGNER_CONSTRAINTS.HANDLE_WIDTH_STEP
                  )
                )
              )
            }
            min={DESIGNER_CONSTRAINTS.MIN_HANDLE_WIDTH}
            max={DESIGNER_CONSTRAINTS.MAX_HANDLE_WIDTH}
            step={DESIGNER_CONSTRAINTS.HANDLE_WIDTH_STEP}
            variant="desktop"
            ariaLabel="Handle width"
          />
        </div>
        <div className="flex-1 min-w-0">
          <span className="mb-1 block text-xs text-content-tertiary">
            {/* eslint-disable-next-line i18next/no-literal-string -- unit suffix */}
            {t('binDesigner.handles.depth')} {'(mm)'}
          </span>
          <StepperControl
            value={handles.depth}
            onChange={handlers.setDepth}
            onStep={(delta) =>
              handlers.setDepth(
                Math.min(
                  DESIGNER_CONSTRAINTS.MAX_HANDLE_DEPTH,
                  Math.max(
                    DESIGNER_CONSTRAINTS.MIN_HANDLE_DEPTH,
                    handles.depth + delta * DESIGNER_CONSTRAINTS.HANDLE_DEPTH_STEP
                  )
                )
              )
            }
            min={DESIGNER_CONSTRAINTS.MIN_HANDLE_DEPTH}
            max={DESIGNER_CONSTRAINTS.MAX_HANDLE_DEPTH}
            step={DESIGNER_CONSTRAINTS.HANDLE_DEPTH_STEP}
            variant="desktop"
            ariaLabel="Handle depth"
          />
        </div>
      </div>

      {/* Physical dimensions */}
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
          {handleWidthMm} × {handles.depth} mm
        </span>
      </div>

      {/* Fillet radius stepper */}
      <div className="flex items-end gap-2">
        <div className="flex-1 min-w-0">
          <span className="mb-1 block text-xs text-content-tertiary">
            {t('binDesigner.handles.filletRadius')}
          </span>
          <StepperControl
            value={handles.filletRadius}
            onChange={handlers.setFilletRadius}
            onStep={(delta) =>
              handlers.setFilletRadius(
                Math.min(
                  DESIGNER_CONSTRAINTS.MAX_HANDLE_FILLET,
                  Math.max(
                    DESIGNER_CONSTRAINTS.MIN_HANDLE_FILLET,
                    handles.filletRadius + delta * DESIGNER_CONSTRAINTS.HANDLE_FILLET_STEP
                  )
                )
              )
            }
            min={DESIGNER_CONSTRAINTS.MIN_HANDLE_FILLET}
            max={DESIGNER_CONSTRAINTS.MAX_HANDLE_FILLET}
            step={DESIGNER_CONSTRAINTS.HANDLE_FILLET_STEP}
            variant="desktop"
            ariaLabel="Handle fillet radius"
          />
        </div>
      </div>
    </FeatureToggle>
  );
}

/**
 * Finger scoop section: curved ramp from bin floor to front wall.
 *
 * Controls: toggle on/off, radius (auto or manual).
 * Available only in standard compartment mode.
 */

import { FeatureToggle } from '../FeatureToggle';
import { StepperControl } from '@/shared/components/StepperControl';
import { DESIGNER_CONSTRAINTS } from '../../../constants';
import { useScoopSection } from './useScoopSection';

export function ScoopSection() {
  const { state, handlers, meta, t } = useScoopSection();

  return (
    <FeatureToggle
      label={t('binDesigner.fingerScoop')}
      checked={state.scoop.enabled}
      onChange={handlers.toggleScoop}
      disabledReason={meta.disabledReason}
      valueSummary={meta.summary}
    >
      {/* Radius: auto toggle + manual stepper */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs text-content-tertiary">{t('binDesigner.scoopRadius')}</span>
          <button
            type="button"
            onClick={handlers.toggleAutoRadius}
            className="text-[11px] font-medium text-accent hover:text-accent/80 transition-colors"
          >
            {/* eslint-disable-next-line i18next/no-literal-string -- 'Auto' button label; full-string i18n for this site is tracked as separate debt */}
            {state.isAutoRadius ? `${t('binDesigner.scoopRadius')}: Auto` : 'Auto'}
          </button>
        </div>
        {!state.isAutoRadius && (
          <StepperControl
            value={state.manualRadius}
            onChange={handlers.setRadius}
            onStep={(delta) =>
              handlers.setRadius(
                Math.min(
                  DESIGNER_CONSTRAINTS.MAX_SCOOP_RADIUS,
                  Math.max(
                    DESIGNER_CONSTRAINTS.MIN_SCOOP_RADIUS,
                    state.manualRadius + delta * DESIGNER_CONSTRAINTS.SCOOP_RADIUS_STEP
                  )
                )
              )
            }
            min={DESIGNER_CONSTRAINTS.MIN_SCOOP_RADIUS}
            max={DESIGNER_CONSTRAINTS.MAX_SCOOP_RADIUS}
            step={DESIGNER_CONSTRAINTS.SCOOP_RADIUS_STEP}
            variant="desktop"
            ariaLabel="Scoop radius"
          />
        )}
        {state.isAutoRadius && (
          <p className="text-[11px] text-content-tertiary">{state.autoDisplayText}</p>
        )}
      </div>
    </FeatureToggle>
  );
}

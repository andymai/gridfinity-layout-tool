/**
 * Finger scoop section: curved ramp from bin floor to front wall.
 *
 * Controls: toggle on/off, radius (auto or manual), all rows toggle.
 * Available only in standard compartment mode.
 */

import { CollapsibleSection } from '@/shared/components/CollapsibleSection';
import { FeatureToggle } from '../FeatureToggle';
import { StepperControl } from '@/shared/components/StepperControl';
import { DESIGNER_CONSTRAINTS } from '../../../constants';
import { useScoopSection } from './useScoopSection';

export function ScoopSection() {
  const { state, handlers, meta, t } = useScoopSection();

  return (
    <CollapsibleSection title={t('binDesigner.fingerScoop')} defaultExpanded summary={meta.summary}>
      <FeatureToggle
        label={t('binDesigner.fingerScoop')}
        checked={state.scoop.enabled}
        onChange={handlers.toggleScoop}
        disabledReason={meta.disabledReason}
        primaryControls={
          <>
            {/* Radius: auto toggle + manual stepper */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-content-tertiary">
                  {t('binDesigner.scoopRadius')}
                </span>
                <button
                  type="button"
                  onClick={handlers.toggleAutoRadius}
                  className="text-[11px] font-medium text-accent hover:text-accent/80 transition-colors"
                >
                  {state.isAutoRadius ? t('binDesigner.scoopRadius') + ': Auto' : 'Auto'}
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
                <p className="text-[11px] text-content-tertiary">
                  {t('binDesigner.scoopRadiusAuto')}
                </p>
              )}
            </div>

            {/* All rows toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={state.scoop.allRows}
                onChange={handlers.toggleAllRows}
                className="h-3.5 w-3.5 rounded border-stroke-subtle text-accent focus:ring-accent"
              />
              <span className="text-xs text-content-secondary">
                {t('binDesigner.scoopAllRows')}
              </span>
            </label>
            {state.scoop.allRows && (
              <p className="text-[11px] text-content-tertiary ml-5.5">
                {t('binDesigner.scoopAllRowsHint')}
              </p>
            )}
          </>
        }
      />
    </CollapsibleSection>
  );
}

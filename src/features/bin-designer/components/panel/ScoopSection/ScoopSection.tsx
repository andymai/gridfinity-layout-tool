/**
 * Finger scoop section: ramp from bin floor to front wall.
 *
 * Controls: toggle on/off, profile style (curved/straight), and either an auto
 * height (with a raisable max) or independent height + run steppers for a
 * custom steep/shallow profile. Available only in standard compartment mode.
 */

import { Button, SegmentedControl, Stepper } from '@/design-system';
import type { SegmentedControlOption } from '@/design-system';
import type { ScoopStyle } from '@/shared/types/bin';
import { FeatureToggle } from '../FeatureToggle';
import { DESIGNER_CONSTRAINTS } from '../../../constants';
import { useScoopSection } from './useScoopSection';

const { MIN_SCOOP_RADIUS, SCOOP_RADIUS_STEP } = DESIGNER_CONSTRAINTS;

const stepValue = (current: number, delta: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, current + delta * SCOOP_RADIUS_STEP));

export function ScoopSection() {
  const { state, handlers, meta, t } = useScoopSection();
  const { bounds } = state;

  const styleOptions: SegmentedControlOption<ScoopStyle>[] = [
    { value: 'curved', label: t('binDesigner.scoopStyleCurved') },
    { value: 'straight', label: t('binDesigner.scoopStyleStraight') },
  ];

  return (
    <FeatureToggle
      label={t('binDesigner.fingerScoop')}
      checked={state.scoop.enabled}
      onChange={handlers.toggleScoop}
      disabledReason={meta.disabledReason}
      valueSummary={meta.summary}
    >
      {/* Profile style: curved fillet vs straight chamfer */}
      <div className="mb-3">
        <span className="mb-1 block text-xs text-content-tertiary">
          {t('binDesigner.scoopStyle')}
        </span>
        <SegmentedControl
          options={styleOptions}
          value={state.style}
          onChange={handlers.setStyle}
          aria-label={t('binDesigner.scoopStyle')}
          size="sm"
          fullWidth
        />
      </div>

      {/* Sizing: auto height (+ max) or custom height + run */}
      <div>
        <div className="mb-1 flex items-center gap-2">
          <span className="text-xs text-content-tertiary">{t('binDesigner.scoopRadius')}</span>
          <Button
            type="button"
            variant="ghost"
            onClick={handlers.toggleAutoRadius}
            className="px-0 py-0 text-[11px] font-medium text-accent transition-colors hover:bg-transparent hover:text-accent/80"
          >
            {/* eslint-disable-next-line i18next/no-literal-string -- 'Auto' button label; full-string i18n for this site is tracked as separate debt */}
            {state.isAutoRadius ? `${t('binDesigner.scoopRadius')}: Auto` : 'Auto'}
          </Button>
        </div>

        {state.isAutoRadius ? (
          <>
            <p className="mb-2 text-[11px] text-content-tertiary">{state.autoDisplayText}</p>
            <span className="mb-1 block text-xs text-content-tertiary">
              {t('binDesigner.scoopMaxHeight')}
            </span>
            <Stepper
              value={state.autoMaxHeight}
              onChange={handlers.setAutoMaxHeight}
              onStep={(delta) =>
                handlers.setAutoMaxHeight(
                  stepValue(state.autoMaxHeight, delta, MIN_SCOOP_RADIUS, bounds.autoMaxHeightMax)
                )
              }
              min={MIN_SCOOP_RADIUS}
              max={bounds.autoMaxHeightMax}
              step={SCOOP_RADIUS_STEP}
              size="md"
              fullWidth
              aria-label={t('binDesigner.scoop.maxHeightAria')}
            />
          </>
        ) : (
          <div className="flex flex-col gap-2">
            <div>
              <span className="mb-1 block text-xs text-content-tertiary">
                {t('binDesigner.scoopHeight')}
              </span>
              <Stepper
                value={state.manualHeight}
                onChange={handlers.setHeight}
                onStep={(delta) =>
                  handlers.setHeight(
                    stepValue(state.manualHeight, delta, MIN_SCOOP_RADIUS, bounds.heightMax)
                  )
                }
                min={MIN_SCOOP_RADIUS}
                max={bounds.heightMax}
                step={SCOOP_RADIUS_STEP}
                size="md"
                fullWidth
                aria-label={t('binDesigner.scoop.heightAria')}
              />
            </div>
            <div>
              <span className="mb-1 block text-xs text-content-tertiary">
                {t('binDesigner.scoopRun')}
              </span>
              <Stepper
                value={state.manualRun}
                onChange={handlers.setRun}
                onStep={(delta) =>
                  handlers.setRun(
                    stepValue(state.manualRun, delta, MIN_SCOOP_RADIUS, bounds.runMax)
                  )
                }
                min={MIN_SCOOP_RADIUS}
                max={bounds.runMax}
                step={SCOOP_RADIUS_STEP}
                size="md"
                fullWidth
                aria-label={t('binDesigner.scoop.runAria')}
              />
            </div>
            {state.isSteep && (
              <p className="text-[11px] text-warning">{t('binDesigner.scoopSteepWarning')}</p>
            )}
          </div>
        )}
      </div>
    </FeatureToggle>
  );
}

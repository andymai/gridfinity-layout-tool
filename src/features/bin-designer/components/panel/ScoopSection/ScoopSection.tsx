/**
 * Finger scoop section: ramp from bin floor to a chosen wall.
 *
 * Controls: toggle on/off, which walls the ramp rises to, profile style
 * (curved/straight), and either an auto
 * height (with a raisable max) or independent height + run steppers for a
 * custom steep/shallow profile. Available only in standard compartment mode.
 */

import { Button, SegmentedControl, Stepper } from '@/design-system';
import type { SegmentedControlOption } from '@/design-system';
import type { ScoopStyle, ScoopSide } from '@/shared/types/bin';
import { SCOOP_SIDES } from '@/shared/utils/scoopCalculations';
import { FeatureToggle } from '../FeatureToggle';
import { SideSelector } from '../shared';
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

  const SIDE_LABEL: Record<ScoopSide, string> = {
    front: t('binDesigner.scoopSideFront'),
    back: t('binDesigner.scoopSideBack'),
    left: t('binDesigner.scoopSideLeft'),
    right: t('binDesigner.scoopSideRight'),
  };
  const selected = new Set(state.sides);

  return (
    <FeatureToggle
      label={t('binDesigner.fingerScoop')}
      checked={state.scoop.enabled}
      onChange={handlers.toggleScoop}
      disabledReason={meta.disabledReason}
      valueSummary={meta.summary}
    >
      {/* Which wall the ramp rises to */}
      <div className="mb-3">
        <span className="mb-1 block text-xs text-content-tertiary">
          {t('binDesigner.scoopSide')}
        </span>
        <SideSelector
          ariaLabel={t('binDesigner.scoop.sideAria')}
          sides={SCOOP_SIDES.map((side) => ({
            side,
            label: SIDE_LABEL[side],
            active: selected.has(side),
            // The last wall standing cannot be switched off — that would be a
            // scoop that is on and builds nothing, which the feature toggle
            // above already says properly.
            disabled: selected.size === 1 && selected.has(side),
            title: SIDE_LABEL[side],
          }))}
          onToggle={handlers.toggleSide}
        />
      </div>

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
            className="px-0 py-0 text-label font-medium text-accent transition-colors hover:bg-transparent hover:text-accent/80"
          >
            {state.isAutoRadius
              ? `${t('binDesigner.scoopRadius')}: ${t('binDesigner.scoopRadiusAutoLabel')}`
              : t('binDesigner.scoopRadiusAutoLabel')}
          </Button>
        </div>

        {state.isAutoRadius ? (
          <>
            <p className="mb-2 text-label text-content-tertiary">{state.autoDisplayText}</p>
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
              <p className="text-label text-warning">{t('binDesigner.scoopSteepWarning')}</p>
            )}
          </div>
        )}
      </div>
    </FeatureToggle>
  );
}

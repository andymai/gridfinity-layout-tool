/**
 * Slant: leans everything above the floor toward one side so tall items fit a
 * shallow drawer, while the base stays flat on the grid. A row of slanted bins
 * leans on itself, and the last one can take an end support to rest on.
 */

import { SLANT_MAX_DEG } from '@/core/types';
import { FeatureToggle } from '../FeatureToggle';
import { InfoDot } from '@/shared/components/InfoDot';
import { FieldLabel, Hint, Readout, SideSelector, StepperField } from '../shared';
import { SLANT_MIN_DEG, useSlantSection } from './useSlantSection';

const ANGLE_STEP_DEG = 5;

export function SlantSection() {
  const { state, meta, handlers, t } = useSlantSection();
  const unavailable = meta.blockerName
    ? t('binDesigner.slant.unavailable', { feature: meta.blockerName })
    : undefined;

  const sides = (['back', 'front', 'left', 'right'] as const).map((side) => ({
    side,
    label: t(`binDesigner.overhang.side.${side}`),
  }));

  return (
    <FeatureToggle
      label={t('binDesigner.slant.title')}
      checked={state.enabled}
      onChange={handlers.toggle}
      // A slant already set stays switchable, so a blocked one can be removed.
      disabledReason={state.enabled ? undefined : unavailable}
      info={t('binDesigner.slant.hint')}
      primaryControls={
        state.enabled && unavailable ? (
          <Hint>{unavailable}</Hint>
        ) : (
          <div className="space-y-3">
            <StepperField
              label={t('binDesigner.slant.angle')}
              unit="°"
              value={state.angleDeg}
              onChange={handlers.setAngle}
              onStep={(delta) => handlers.setAngle(state.angleDeg + delta * ANGLE_STEP_DEG)}
              min={SLANT_MIN_DEG}
              max={SLANT_MAX_DEG}
              step={1}
              size="md"
              aria-label={t('binDesigner.slant.angleAria')}
            />
            <div>
              <FieldLabel>{t('binDesigner.slant.side')}</FieldLabel>
              <SideSelector
                mode="single"
                sides={sides}
                value={state.side}
                onSelect={handlers.setSide}
                ariaLabel={t('binDesigner.slant.side')}
              />
            </div>
            <FeatureToggle
              label={t('binDesigner.slant.endSupport')}
              checked={state.endSupport}
              onChange={handlers.toggleEndSupport}
              info={t('binDesigner.slant.endSupportHint')}
            />
            {state.readouts && (
              <div className="space-y-1">
                <Readout>
                  {t('binDesigner.slant.topOffset', {
                    mm: Math.round(state.readouts.topOffsetMm),
                  })}
                </Readout>
                <Readout>
                  {t('binDesigner.slant.longestItem', {
                    mm: Math.floor(state.readouts.longestItemMm),
                  })}
                </Readout>
              </div>
            )}
            {state.steep && (
              <p className="text-label leading-relaxed text-warning">
                {t('binDesigner.slant.steep')}
                <span className="ml-1 inline-flex align-middle">
                  <InfoDot aria-label={t('binDesigner.infoButton')}>
                    <p>{t('binDesigner.slant.steepDetail')}</p>
                  </InfoDot>
                </span>
              </p>
            )}
          </div>
        )
      }
    />
  );
}

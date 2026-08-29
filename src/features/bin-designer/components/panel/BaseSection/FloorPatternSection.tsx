/**
 * Floor drainage/ventilation pattern (#2816). Lives on the Style page with the
 * other surface patterns; the rest of the floor family (lightweight relief)
 * stays with the base. The holes pass through the floor slab AND the feet,
 * staying inside each foot's flat underside so the baseplate-mating taper is
 * never cut.
 */

import { SliderInput } from '@/design-system';
import { FLOOR_PATTERN_TYPES } from '@/features/bin-designer/types';
import { useTranslation } from '@/i18n';
import { FeatureToggle } from '../FeatureToggle';
import { Hint, SubHeader } from '../shared';
import { PatternSelector } from '../WallsSection/PatternSelector';
import { UnavailableFamily } from './BaseSection';
import { useBaseSection } from './useBaseSection';

export function FloorPatternSection() {
  const { state, handlers } = useBaseSection();
  const t = useTranslation();

  if (!state.showFloor && state.floorUnavailable) {
    return (
      <UnavailableFamily
        title={t('binDesigner.base.floorPattern')}
        reason={state.floorUnavailable}
      />
    );
  }
  if (!state.showFloor) return null;

  return (
    <div className="space-y-2">
      <SubHeader>{t('binDesigner.base.section.floor')}</SubHeader>
      <FeatureToggle
        label={t('binDesigner.base.floorPattern')}
        checked={state.floorPatternEnabled}
        onChange={handlers.toggleFloorPattern}
        disabledReason={handlers.floorPatternDisabledReason}
        primaryControls={
          <>
            <PatternSelector
              id="floor-pattern-selector"
              labelKey="binDesigner.base.floorPattern.shape"
              patterns={FLOOR_PATTERN_TYPES}
              selectedPattern={state.floorPatternType}
              onChange={handlers.setFloorPatternType}
            />
            <SliderInput
              label={t('binDesigner.walls.pattern.scale')}
              value={state.floorPatternScalePercent}
              onChange={handlers.setFloorPatternScale}
              min={0}
              max={100}
              step={5}
              unit="%"
              info={t('binDesigner.walls.pattern.scaleHint')}
            />
            <Hint>
              {state.floorPatternDoesNotFit
                ? t('binDesigner.base.floorPattern.tooSmall')
                : t('binDesigner.base.floorPattern.hint')}
            </Hint>
          </>
        }
      />
    </div>
  );
}

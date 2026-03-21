/**
 * Walls section: Wall thickness and pattern selection.
 *
 * Shows discrete wall thickness options (multiples of common FDM nozzle sizes)
 * using a snapping slider with tick marks and helpful descriptions.
 *
 * Also allows selection of wall patterns (honeycomb, etc.) via dropdown.
 */

import { SnappingSlider } from '../../controls/SnappingSlider';
import { useWallsSection } from './useWallsSection';
import { PatternSelector } from './PatternSelector';
import { WallCutoutsSection } from '../WallCutoutsSection';
import { HandleSection } from '../HandleSection';
import { useFeatureFlag } from '@/shared/hooks/useFeatureFlag';

export function WallsSection() {
  const { state, handlers, t } = useWallsSection();
  const handleLedgesFlag = useFeatureFlag('handle_ledges');

  return (
    <div className="space-y-4">
      <SnappingSlider
        label={t('binDesigner.wallThickness')}
        value={state.wallThickness}
        onChange={handlers.handleChange}
        options={state.options}
        unit="mm"
        tip={t('binDesigner.wallThickness.nozzleTip')}
      />
      <div className="pt-3 border-t border-stroke-subtle/50">
        <PatternSelector
          selectedPattern={state.patternEnabled ? state.pattern : null}
          onChange={handlers.handlePatternChange}
          disabled={state.patternDisabled}
          disabledReason={state.patternDisabledReason}
        />
        {state.patternPartialNote && state.patternEnabled && (
          <p className="text-[11px] text-content-tertiary mt-1">{state.patternPartialNote}</p>
        )}
      </div>
      <div className="pt-3 border-t border-stroke-subtle/50">
        <WallCutoutsSection />
      </div>
      {handleLedgesFlag && (
        <div className="pt-3 border-t border-stroke-subtle/50">
          <HandleSection />
        </div>
      )}
    </div>
  );
}

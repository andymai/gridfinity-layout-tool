/**
 * Walls section: Wall thickness and pattern selection.
 *
 * Shows discrete wall thickness options (multiples of common FDM nozzle sizes)
 * using a snapping slider with tick marks and helpful descriptions.
 *
 * Also allows selection of wall patterns (honeycomb, etc.) via dropdown.
 */

import { useDesignerStore } from '@/features/bin-designer/store';
import { isPartialMask } from '@/shared/utils/cellMask';
import { SnappingSlider } from '../../controls/SnappingSlider';
import { useWallsSection } from './useWallsSection';
import { PatternSelector } from './PatternSelector';
import { WallCutoutsSection } from '../WallCutoutsSection';
import { HandleSection } from '../HandleSection';
import { FeatureGate } from '../FeatureGate';

export function WallsSection() {
  const { state, handlers, t } = useWallsSection();
  // Wall pattern still tiles across rectangular walls only. Wall cutouts and
  // handles are polygon-aware (auto-snap to the outermost matching polygon
  // edge) and stay interactive on custom shapes.
  const isCustomShape = useDesignerStore((s) => isPartialMask(s.params.cellMask));
  const customShapeReason = t('binDesigner.shape.custom.hint');

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
      <div className="space-y-4">
        <div className="pt-3 border-t border-stroke-subtle/50">
          <FeatureGate disabled={isCustomShape} reason={customShapeReason}>
            <PatternSelector
              selectedPattern={state.patternEnabled ? state.pattern : null}
              onChange={handlers.handlePatternChange}
              disabled={state.patternDisabled}
              disabledReason={state.patternDisabledReason}
            />
            {state.patternPartialNote && state.patternEnabled && (
              <p className="text-[11px] text-content-tertiary mt-1">{state.patternPartialNote}</p>
            )}
          </FeatureGate>
        </div>
        <div className="pt-3 border-t border-stroke-subtle/50">
          <WallCutoutsSection />
        </div>
        <div className="pt-3 border-t border-stroke-subtle/50">
          <HandleSection />
        </div>
      </div>
    </div>
  );
}

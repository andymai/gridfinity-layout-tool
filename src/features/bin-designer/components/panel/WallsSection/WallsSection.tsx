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
  // Pattern/cutouts/handle position from the axis-aligned bounding box, so
  // they don't align with custom polygons. Wall thickness, by contrast, is
  // a single mm value and works for any footprint.
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
      <FeatureGate disabled={isCustomShape} reason={customShapeReason}>
        <div className="space-y-4">
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
          <div className="pt-3 border-t border-stroke-subtle/50">
            <HandleSection />
          </div>
        </div>
      </FeatureGate>
    </div>
  );
}

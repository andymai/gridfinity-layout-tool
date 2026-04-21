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

export function WallsSection() {
  const { state, handlers, t } = useWallsSection();
  // Wall cutouts and handles auto-snap to the outermost matching polygon
  // edge on custom shapes. Wall patterns tile across *every* axis-aligned
  // outer edge; outermost-per-cardinal matching is used only for border
  // clipping around cutouts/handles, not to limit tiling itself.

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
    </div>
  );
}

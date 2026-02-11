/**
 * Walls section: Wall thickness and pattern selection.
 *
 * Shows discrete wall thickness options (multiples of common FDM nozzle sizes)
 * using a snapping slider with tick marks and helpful descriptions.
 *
 * Also allows selection of wall patterns (honeycomb, etc.) via dropdown.
 */

import { CollapsibleSection } from '@/shared/components/CollapsibleSection';
import { SnappingSlider } from '../../controls/SnappingSlider';
import { useWallsSection } from './useWallsSection';
import { PatternSelector } from './PatternSelector';

export function WallsSection() {
  const { state, handlers, meta, t } = useWallsSection();

  return (
    <CollapsibleSection
      title={t('binDesigner.walls')}
      defaultExpanded={true}
      summary={meta.summary}
    >
      <SnappingSlider
        label={t('binDesigner.wallThickness')}
        value={state.wallThickness}
        onChange={handlers.handleChange}
        options={state.options}
        unit="mm"
        tip={t('binDesigner.wallThickness.nozzleTip')}
      />
      <div className="mt-3 pt-3 border-t border-stroke-subtle/50">
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
    </CollapsibleSection>
  );
}

/**
 * Walls section: Wall thickness selector.
 *
 * Shows discrete wall thickness options (multiples of common FDM nozzle sizes)
 * using a snapping slider with tick marks and helpful descriptions.
 */

import { CollapsibleSection } from '@/shared/components/CollapsibleSection';
import { FeatureToggle } from '../FeatureToggle';
import { SnappingSlider } from '../../controls/SnappingSlider';
import { useWallsSection } from './useWallsSection';

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
        <FeatureToggle
          label={t('binDesigner.walls.pattern.honeycomb')}
          checked={state.honeycombEnabled}
          onChange={handlers.toggleHoneycomb}
          disabledReason={state.honeycombDisabledReason}
        />
        {state.honeycombPartialNote && state.honeycombEnabled && (
          <p className="text-[11px] text-content-tertiary -mt-0.5 mb-1">
            {state.honeycombPartialNote}
          </p>
        )}
      </div>
    </CollapsibleSection>
  );
}

/**
 * Walls section: Wall thickness selector.
 *
 * Shows discrete wall thickness options (multiples of common FDM nozzle sizes)
 * using a snapping slider with tick marks and helpful descriptions.
 */

import { CollapsibleSection } from '@/shared/components/CollapsibleSection';
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
    </CollapsibleSection>
  );
}

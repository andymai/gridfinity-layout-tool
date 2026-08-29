/**
 * Wall thickness: discrete options (multiples of common FDM nozzle sizes) on a
 * snapping slider with tick marks. The wall surface styling (patterns, text)
 * lives on the Style page; the wall-mounted features on the Features page.
 */

import { SnappingSlider } from '../../controls/SnappingSlider';
import { useWallsSection } from './useWallsSection';

export function WallThicknessSection() {
  const { state, handlers, t } = useWallsSection();
  return (
    <SnappingSlider
      label={t('binDesigner.wallThickness')}
      value={state.wallThickness}
      onChange={handlers.handleChange}
      options={state.options}
      unit="mm"
      tip={t('binDesigner.wallThickness.nozzleTip')}
    />
  );
}

import { PanelSection } from '@/shared/components/PanelSection';
import { DimensionsSection } from '../../DimensionsSection';
import { OverhangSection } from '../../OverhangSection';
import { ShapeSection } from '../../ShapeSection';
import { WallThicknessSection } from '../../WallsSection';
import { BaseSection } from '../../BaseSection';
import { SlantSection } from '../../SlantSection';

/** Size & shape: dimensions, drawer fit, custom footprint, walls, body/base. */
export function ShapePage() {
  return (
    <div className="divide-y divide-stroke-subtle/50">
      <PanelSection helpTarget="bd-dimensions">
        <DimensionsSection />
      </PanelSection>
      {/* One block per subheader group, so no divider splits the footprint
          controls that share a heading. */}
      <PanelSection className="space-y-3">
        <div data-help-target="bd-overhang">
          {/* Advanced drawer-fit control next to the dimensions; collapsed by
              default and gated off internally for custom-shape (mask) bins. */}
          <OverhangSection />
        </div>
        <div data-help-target="bd-shape">
          <ShapeSection />
        </div>
        <div data-help-target="bd-slant">
          <SlantSection />
        </div>
      </PanelSection>
      <PanelSection helpTarget="bd-walls">
        <WallThicknessSection />
      </PanelSection>
      <BaseSection />
    </div>
  );
}

import { PanelSection } from '../../PanelSection';
import { DimensionsSection } from '../../DimensionsSection';
import { OverhangSection } from '../../OverhangSection';
import { ShapeSection } from '../../ShapeSection';
import { WallThicknessSection } from '../../WallsSection';
import { BaseSection } from '../../BaseSection';
import { SlantSection, useSlantVisible } from '../../SlantSection';

/** Size & shape: dimensions, drawer fit, custom footprint, walls, body/base. */
export function ShapePage() {
  const slantVisible = useSlantVisible();
  return (
    <div className="divide-y divide-stroke-subtle/50">
      <PanelSection helpTarget="bd-dimensions">
        <DimensionsSection />
      </PanelSection>
      <PanelSection helpTarget="bd-overhang">
        {/* Advanced drawer-fit control next to the dimensions; collapsed by
            default and gated off internally for custom-shape (mask) bins. */}
        <OverhangSection />
      </PanelSection>
      <PanelSection helpTarget="bd-shape">
        <ShapeSection />
      </PanelSection>
      {slantVisible && (
        <PanelSection helpTarget="bd-slant">
          <SlantSection />
        </PanelSection>
      )}
      <PanelSection helpTarget="bd-walls">
        <WallThicknessSection />
      </PanelSection>
      <PanelSection helpTarget="bd-base">
        <BaseSection />
      </PanelSection>
    </div>
  );
}

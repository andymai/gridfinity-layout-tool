import { PanelSection } from '../../PanelSection';
import { TypeSection } from '../../TypeSection';
import { ColorsSection } from '../../ColorsSection';
import { WallSurfaceSection } from '../../WallsSection';
import { FloorPatternSection } from '../../BaseSection';

/** Appearance: typography, colors, wall patterns and text, floor pattern. */
export function StylePage() {
  return (
    <div className="divide-y divide-stroke-subtle/50">
      <PanelSection helpTarget="bd-type">
        <TypeSection />
      </PanelSection>
      <PanelSection helpTarget="bd-colors">
        <ColorsSection />
      </PanelSection>
      <PanelSection helpTarget="bd-wall-style">
        <WallSurfaceSection />
      </PanelSection>
      <PanelSection helpTarget="bd-floor-pattern">
        <FloorPatternSection />
      </PanelSection>
    </div>
  );
}

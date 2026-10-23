import { useDesignerStore } from '@/features/bin-designer/store';
import { binHasText } from '@/features/bin-designer/utils/binText';
import { PanelSection } from '../../PanelSection';
import { TypeSection } from '../../TypeSection';
import { ColorsSection } from '../../ColorsSection';
import { WallSurfaceSection } from '../../WallsSection';
import { FloorPatternSection } from '../../BaseSection';
import { FloorTextSection } from '../../FloorTextSection';

/** Appearance: typography, colors, wall patterns and text, floor pattern and text. */
export function StylePage() {
  const hasText = useDesignerStore((s) => binHasText(s.params));
  return (
    <div className="divide-y divide-stroke-subtle/50">
      {hasText && (
        <PanelSection helpTarget="bd-type">
          <TypeSection />
        </PanelSection>
      )}
      <PanelSection helpTarget="bd-colors">
        <ColorsSection />
      </PanelSection>
      <PanelSection helpTarget="bd-wall-style">
        <WallSurfaceSection />
      </PanelSection>
      <PanelSection helpTarget="bd-floor-pattern">
        <FloorPatternSection />
        <FloorTextSection />
      </PanelSection>
    </div>
  );
}

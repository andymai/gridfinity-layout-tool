import { useDesignerStore } from '@/features/bin-designer/store';
import { binHasText } from '@/features/bin-designer/utils/binText';
import { PanelSection } from '../../PanelSection';
import { TypeSection } from '../../TypeSection';
import { ColorsSection } from '../../ColorsSection';
import { WallSurfaceSection } from '../../WallsSection';
import { FloorPatternSection } from '../../BaseSection';

/** Appearance: typography, colors, wall patterns and text, floor pattern. */
export function StylePage() {
  const hasText = useDesignerStore((s) => binHasText(s.params));
  return (
    <div className="divide-y divide-stroke-subtle/50">
      {/* Type settings govern captions; with nothing to style they only add
          noise, so they appear once the design carries text. */}
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
      </PanelSection>
    </div>
  );
}

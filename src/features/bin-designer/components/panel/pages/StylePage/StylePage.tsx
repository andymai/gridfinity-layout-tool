import { PanelSection } from '../../PanelSection';
import { TypeSection } from '../../TypeSection';
import { ColorsSection } from '../../ColorsSection';

/** Appearance: typography presets and multi-color. */
export function StylePage() {
  return (
    <div className="divide-y divide-stroke-subtle/50">
      <PanelSection helpTarget="bd-type">
        <TypeSection />
      </PanelSection>
      <PanelSection helpTarget="bd-colors">
        <ColorsSection />
      </PanelSection>
    </div>
  );
}

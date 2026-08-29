import { PanelSection } from '../../PanelSection';
import { LidSection } from '../../LidSection';
import { WallCutoutsSection } from '../../WallCutoutsSection';
import { HandleSection } from '../../HandleSection';
import { SlideTraySection } from '../../SlideTraySection';

/** Feature parts: the lid, handles, wall cutouts, slide tray. */
export function FeaturesPage() {
  return (
    <div className="divide-y divide-stroke-subtle/50">
      <PanelSection helpTarget="bd-lid">
        <LidSection />
      </PanelSection>
      <PanelSection helpTarget="bd-handles">
        <HandleSection />
      </PanelSection>
      <PanelSection helpTarget="bd-wall-cutouts">
        <WallCutoutsSection />
      </PanelSection>
      <SlideTraySection />
    </div>
  );
}

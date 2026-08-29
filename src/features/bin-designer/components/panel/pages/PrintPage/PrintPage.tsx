import { PanelSection } from '../../PanelSection';
import { SplitOptionsSection } from '../../SplitOptionsSection';
import { useSplitOptionsSection } from '../../SplitOptionsSection/useSplitOptionsSection';
import { PhysicalUnitsSection } from '../../PhysicalUnitsSection';
import { SetDefaultFooter } from '../../SetDefaultFooter';

/** Print & output: bed-fit splitting, physical units, new-bin defaults. */
export function PrintPage() {
  const { needsSplit } = useSplitOptionsSection();
  return (
    <div className="divide-y divide-stroke-subtle/50">
      {needsSplit && (
        <PanelSection>
          {/* Splits work for any footprint — axis-aligned cut planes intersect
              the polygon naturally. Pieces may be irregular but each has
              positive volume; tested in the polygon scenario suite. */}
          <SplitOptionsSection />
        </PanelSection>
      )}
      <PanelSection helpTarget="bd-physical-units">
        <PhysicalUnitsSection />
      </PanelSection>
      <SetDefaultFooter />
    </div>
  );
}

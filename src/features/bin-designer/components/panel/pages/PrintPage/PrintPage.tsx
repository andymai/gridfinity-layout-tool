import { useTranslation } from '@/i18n';
import { PanelSection } from '../../PanelSection';
import { SplitOptionsSection } from '../../SplitOptionsSection';
import { useSplitOptionsSection } from '../../SplitOptionsSection/useSplitOptionsSection';
import { PhysicalUnitsSection } from '../../PhysicalUnitsSection';
import { SetDefaultFooter } from '../../SetDefaultFooter';

/**
 * Print & output: bed fit (always rendered — a passive all-clear when the bin
 * fits, the full split controls when it doesn't), physical units, defaults.
 */
export function PrintPage() {
  const t = useTranslation();
  const { needsSplit, printBedSize } = useSplitOptionsSection();
  return (
    <div className="divide-y divide-stroke-subtle/50">
      <PanelSection helpTarget="bd-print-fit">
        {needsSplit ? (
          <SplitOptionsSection />
        ) : (
          <p className="text-label text-content-tertiary">
            {t('binDesigner.printFit.fits', {
              width: printBedSize.width,
              depth: printBedSize.depth,
            })}
          </p>
        )}
      </PanelSection>
      <PanelSection helpTarget="bd-physical-units">
        <PhysicalUnitsSection />
      </PanelSection>
      <SetDefaultFooter />
    </div>
  );
}

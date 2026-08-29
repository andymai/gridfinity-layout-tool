import { useTranslation } from '@/i18n';
import { Button } from '@/design-system';
import { useDesignerStore } from '@/features/bin-designer/store';
import { PanelSection } from '../../PanelSection';
import { SplitOptionsSection } from '../../SplitOptionsSection';
import { useSplitOptionsSection } from '../../SplitOptionsSection/useSplitOptionsSection';
import { PhysicalUnitsSection } from '../../PhysicalUnitsSection';
import { SetDefaultFooter } from '../../SetDefaultFooter';

/**
 * Print & output: bed fit (always rendered — a passive all-clear when the bin
 * fits, the full split controls when it doesn't), physical units, the export
 * hand-off, defaults.
 */
export function PrintPage() {
  const t = useTranslation();
  const { needsSplit, printBedSize } = useSplitOptionsSection();
  const setExportDialogOpen = useDesignerStore((s) => s.setExportDialogOpen);
  const canExport = useDesignerStore(
    (s) =>
      s.generation.mesh !== null &&
      s.generation.mesh.error === null &&
      s.generation.mesh.vertices !== null &&
      s.generation.mesh.normals !== null
  );
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
      {/* The page is where print decisions end, so it carries the hand-off to
          the export dialog the header also offers. */}
      <PanelSection>
        <Button
          variant="secondary"
          size="sm"
          className="w-full"
          disabled={!canExport}
          onClick={() => setExportDialogOpen(true)}
        >
          {t('common.export')}
        </Button>
      </PanelSection>
      <SetDefaultFooter />
    </div>
  );
}

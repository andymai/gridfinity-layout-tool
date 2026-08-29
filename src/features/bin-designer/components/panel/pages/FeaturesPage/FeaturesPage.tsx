import { useTranslation } from '@/i18n';
import { PanelSection } from '../../PanelSection';
import { LidSection } from '../../LidSection';

/**
 * Feature parts: the lid today; handles, wall cutouts and the slide tray move
 * here from Walls when that section splits.
 */
export function FeaturesPage() {
  const t = useTranslation();
  return (
    <div className="divide-y divide-stroke-subtle/50">
      <p className="px-4 py-2 text-label text-content-tertiary">
        {t('binDesigner.category.featuresInterim')}
      </p>
      <PanelSection helpTarget="bd-lid">
        <LidSection />
      </PanelSection>
    </div>
  );
}

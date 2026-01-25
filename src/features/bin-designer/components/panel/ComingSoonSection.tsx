/**
 * Coming Soon section: Teaser list of planned features.
 *
 * Organized into "Spec Features" (Gridfinity standard enhancements) and
 * "Power Features" (advanced customization). Non-intrusive discovery
 * for users who want to know what's next.
 */

import { CollapsibleSection } from '@/shared/components/CollapsibleSection';
import { ComingSoonIcon } from './SectionIllustrations';
import { useTranslation } from '@/i18n';

interface PlannedFeature {
  name: string;
  description: string;
}

const SPEC_FEATURES: PlannedFeature[] = [
  { name: 'Label tabs', description: 'Front-face text embossing for organization' },
  { name: 'Flat bottom', description: 'Remove baseplate grid for flush surfaces' },
  { name: 'Anti-slide notches', description: 'Lip notches to prevent bin sliding' },
  { name: 'Magnet hole styles', description: 'Press-fit, glue-in, bridging-friendly' },
];

const POWER_FEATURES: PlannedFeature[] = [
  { name: 'Floor inserts', description: 'Cut cavities into bin floor for tool holders' },
  { name: 'Weighted base', description: 'Heavier base for stability without magnets' },
  { name: 'Insert templates', description: 'Library of common tool holder shapes' },
  { name: 'Multi-color export', description: 'Separate lip/body for MMU printing' },
];

function FeatureList({ title, features }: { title: string; features: PlannedFeature[] }) {
  return (
    <div>
      <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-content-tertiary">
        {title}
      </h4>
      <ul className="space-y-1.5">
        {features.map((feature) => (
          <li key={feature.name} className="flex items-start gap-2">
            <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent/40" />
            <div>
              <span className="text-xs text-content-secondary">{feature.name}</span>
              <span className="text-xs text-content-tertiary"> — {feature.description}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ComingSoonSection() {
  const t = useTranslation();
  return (
    <CollapsibleSection
      title={t('binDesigner.comingSoon')}
      defaultExpanded={false}
      illustration={<ComingSoonIcon />}
    >
      <div className="space-y-4">
        <FeatureList title={t('binDesigner.specFeatures')} features={SPEC_FEATURES} />
        <FeatureList title={t('binDesigner.powerFeatures')} features={POWER_FEATURES} />
      </div>
    </CollapsibleSection>
  );
}

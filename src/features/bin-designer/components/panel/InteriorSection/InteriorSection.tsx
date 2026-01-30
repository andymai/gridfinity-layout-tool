/**
 * Interior section: Compartment grid editor.
 *
 * Embeds the CompartmentEditor for configuring the bin's internal
 * compartment layout.
 */

import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { CollapsibleSection } from '@/shared/components/CollapsibleSection';
import { CompartmentEditor } from '../../CompartmentEditor';
import { InteriorIcon } from '../SectionIllustrations';
import { getCompartmentCount } from '../../../utils/compartments';
import { useTranslation } from '@/i18n';

export function InteriorSection() {
  const compartments = useDesignerStore(useShallow((s) => s.params.compartments));
  const t = useTranslation();

  const compartmentCount = getCompartmentCount(compartments);
  const summary = t('binDesigner.interiorSummary', { count: compartmentCount });

  return (
    <CollapsibleSection
      title={t('binDesigner.interior')}
      defaultExpanded={true}
      illustration={<InteriorIcon />}
      summary={summary}
    >
      <CompartmentEditor />
    </CollapsibleSection>
  );
}

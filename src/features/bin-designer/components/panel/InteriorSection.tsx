/**
 * Interior section: Compartment grid editor.
 *
 * Embeds the existing CompartmentEditor for configuring the bin's
 * internal compartment layout. Scoop and label features are not yet
 * supported by the generator.
 */

import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { CollapsibleSection } from '@/shared/components/CollapsibleSection';
import { CompartmentEditor } from '../CompartmentEditor';
import { InteriorIcon } from './SectionIllustrations';
import { getCompartmentCount } from '../../utils/compartments';

export function InteriorSection() {
  const compartments = useDesignerStore(
    useShallow((s) => s.params.compartments)
  );

  const compartmentCount = getCompartmentCount(compartments);
  const summary = `${compartmentCount} ${compartmentCount === 1 ? 'compartment' : 'compartments'}`;

  return (
    <CollapsibleSection
      title="Interior"
      defaultExpanded={true}
      illustration={<InteriorIcon />}
      summary={summary}
    >
      <CompartmentEditor />
    </CollapsibleSection>
  );
}

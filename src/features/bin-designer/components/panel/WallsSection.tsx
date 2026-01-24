/**
 * Walls section: Wall thickness selector.
 *
 * Shows discrete wall thickness options (multiples of common FDM nozzle sizes).
 * Wall cutouts and style variants are not yet supported by the generator.
 */

import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { CollapsibleSection } from '@/shared/components/CollapsibleSection';
import { ThicknessSelector } from '../controls/ThicknessSelector';
import { WallsIcon } from './SectionIllustrations';
import { useTranslation } from '@/i18n';

export function WallsSection() {
  const { wallThickness, setParam } = useDesignerStore(
    useShallow((s) => ({
      wallThickness: s.params.wallThickness,
      setParam: s.setParam,
    }))
  );
  const t = useTranslation();

  const summary = `${wallThickness}mm`;

  return (
    <CollapsibleSection
      title={t('binDesigner.walls')}
      defaultExpanded={true}
      illustration={<WallsIcon />}
      summary={summary}
    >
      <ThicknessSelector
        label="Wall thickness"
        value={wallThickness}
        onChange={(v) => setParam('wallThickness', v)}
      />
    </CollapsibleSection>
  );
}

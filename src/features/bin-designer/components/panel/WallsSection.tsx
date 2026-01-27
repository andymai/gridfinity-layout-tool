/**
 * Walls section: Wall thickness selector.
 *
 * Shows discrete wall thickness options (multiples of common FDM nozzle sizes)
 * using a snapping slider with tick marks and helpful descriptions.
 */

import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { WALL_THICKNESS_OPTIONS } from '@/features/bin-designer/constants';
import { CollapsibleSection } from '@/shared/components/CollapsibleSection';
import { SnappingSlider } from '../controls/SnappingSlider';
import type { SnappingSliderOption } from '../controls/SnappingSlider';
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

  // Build options with translated descriptions
  const options: SnappingSliderOption[] = useMemo(
    () =>
      WALL_THICKNESS_OPTIONS.map((value) => ({
        value,
        description: t(`binDesigner.wallThickness.${value}` as Parameters<typeof t>[0]),
      })),
    [t]
  );

  const summary = `${wallThickness}mm`;

  return (
    <CollapsibleSection
      title={t('binDesigner.walls')}
      defaultExpanded={true}
      illustration={<WallsIcon />}
      summary={summary}
    >
      <SnappingSlider
        label={t('binDesigner.wallThickness')}
        value={wallThickness}
        onChange={(v) => setParam('wallThickness', v)}
        options={options}
        unit="mm"
        tip={t('binDesigner.wallThickness.nozzleTip')}
      />
    </CollapsibleSection>
  );
}

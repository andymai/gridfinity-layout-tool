/**
 * Settings in the Bento dock that belong to the whole bin rather than the
 * selected compartment: divider wall thickness, divider height, and whether
 * leftover grid merges into one pocket per open area.
 *
 * All three already drive bento geometry — `compartments.thickness` sizes every
 * drawn wall and `compartments.dividerHeight` cuts them all down — but they
 * were only reachable from the Grid Dividers card, so the workspace could not
 * finish a design on its own.
 */

import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Checkbox } from '@/design-system';
import { useDesignerStore } from '@/features/bin-designer/store';
import { WALL_THICKNESS_OPTIONS } from '@/features/bin-designer/constants';
import { useTranslation } from '@/i18n';
import { SnappingSlider } from '../controls/SnappingSlider';
import type { SnappingSliderOption } from '../controls/SnappingSlider';
import { DividerHeightControl } from '../CompartmentEditor/DividerHeightControl';

export function BentoBinWideSection() {
  const t = useTranslation();

  const { thickness, compartments, setParam, setBentoMergeBackground } = useDesignerStore(
    useShallow((s) => ({
      thickness: s.params.compartments.thickness,
      compartments: s.params.compartments,
      setParam: s.setParam,
      setBentoMergeBackground: s.setBentoMergeBackground,
    }))
  );

  const mergeBackground = compartments.mergeBackground ?? false;
  const toggleMergeBackground = useCallback(() => {
    setBentoMergeBackground(!mergeBackground);
  }, [mergeBackground, setBentoMergeBackground]);

  const handleThicknessChange = useCallback(
    (next: number) => {
      setParam('compartments', { ...compartments, thickness: next });
    },
    [compartments, setParam]
  );

  const thicknessOptions: SnappingSliderOption[] = useMemo(
    () =>
      WALL_THICKNESS_OPTIONS.map((value) => ({
        value,
        description: t(`binDesigner.wallThickness.${value}`),
      })),
    [t]
  );

  return (
    <section className="mt-4 flex flex-col gap-4 border-t border-stroke-subtle pt-3">
      <span className="text-micro font-semibold uppercase tracking-wider text-content-tertiary">
        {t('binDesigner.bento.binWideTitle')}
      </span>
      <SnappingSlider
        label={t('binDesigner.wallThickness')}
        value={thickness}
        onChange={handleThicknessChange}
        options={thicknessOptions}
        unit="mm"
      />
      <DividerHeightControl />
      <div className="flex flex-col gap-1">
        <div
          className="flex cursor-pointer items-center justify-between"
          onClick={toggleMergeBackground}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggleMergeBackground();
            }
          }}
          role="checkbox"
          aria-checked={mergeBackground}
          aria-label={t('binDesigner.bento.mergeBackground')}
          tabIndex={0}
        >
          <span className="text-xs leading-none text-content-secondary">
            {t('binDesigner.bento.mergeBackground')}
          </span>
          <Checkbox checked={mergeBackground} />
        </div>
        <p className="text-label leading-relaxed text-content-tertiary">
          {t('binDesigner.bento.mergeBackgroundHint')}
        </p>
      </div>
    </section>
  );
}

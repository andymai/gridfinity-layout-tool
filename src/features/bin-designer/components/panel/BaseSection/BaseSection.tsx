/**
 * Base section: Magnet holes, screw holes, stacking lip, flat bottom.
 *
 * Uses smart defaults with "Customize" inline expansion for magnet/screw
 * radius and depth parameters that most users won't need to change.
 */

import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DESIGNER_CONSTRAINTS } from '@/features/bin-designer/constants';
import { CollapsibleSection } from '@/shared/components/CollapsibleSection';
import { SliderInput } from '../../controls/SliderInput';
import { FeatureToggle } from '../FeatureToggle';
import { BaseIcon } from '../SectionIllustrations';
import type { BaseConfig, BaseStyle } from '@/features/bin-designer/types';
import { useTranslation } from '@/i18n';

/** Derive base style from individual magnet/screw booleans */
function computeBaseStyle(magnet: boolean, screw: boolean, currentStyle: BaseStyle): BaseStyle {
  if (!magnet && !screw && currentStyle === 'weighted') return 'weighted';
  if (magnet && screw) return 'magnet_and_screw';
  if (magnet) return 'magnet';
  if (screw) return 'screw';
  return 'standard';
}

export function BaseSection() {
  const { base, setParam } = useDesignerStore(
    useShallow((s) => ({
      base: s.params.base,
      setParam: s.setParam,
    }))
  );
  const t = useTranslation();

  const hasMagnet = base.style === 'magnet' || base.style === 'magnet_and_screw';
  const hasScrew = base.style === 'screw' || base.style === 'magnet_and_screw';

  const toggleMagnet = useCallback(() => {
    const newMagnet = !hasMagnet;
    const newBase: BaseConfig = {
      ...base,
      style: computeBaseStyle(newMagnet, hasScrew, base.style),
    };
    setParam('base', newBase);
  }, [base, hasMagnet, hasScrew, setParam]);

  const toggleScrew = useCallback(() => {
    const newScrew = !hasScrew;
    const newBase: BaseConfig = {
      ...base,
      style: computeBaseStyle(hasMagnet, newScrew, base.style),
    };
    setParam('base', newBase);
  }, [base, hasMagnet, hasScrew, setParam]);

  const toggleStackingLip = useCallback(() => {
    const newBase: BaseConfig = { ...base, stackingLip: !base.stackingLip };
    setParam('base', newBase);
  }, [base, setParam]);

  const setMagnetRadius = useCallback(
    (radius: number) => {
      setParam('base', { ...base, magnetDiameter: radius * 2 });
    },
    [base, setParam]
  );

  const setMagnetHeight = useCallback(
    (depth: number) => {
      setParam('base', { ...base, magnetDepth: depth });
    },
    [base, setParam]
  );

  const setScrewRadius = useCallback(
    (radius: number) => {
      setParam('base', { ...base, screwDiameter: radius * 2 });
    },
    [base, setParam]
  );

  // Build summary for collapsed state
  const summaryParts: string[] = [];
  if (hasMagnet) summaryParts.push(`${base.magnetDiameter}mm magnets`);
  if (hasScrew) summaryParts.push(`M${base.screwDiameter} screws`);
  if (base.stackingLip) summaryParts.push('Lip');
  const summary = summaryParts.length > 0 ? summaryParts.join(' • ') : 'Standard (no attachment)';

  return (
    <CollapsibleSection
      title={t('binDesigner.base')}
      defaultExpanded={true}
      illustration={<BaseIcon />}
      summary={summary}
    >
      <div className="space-y-1">
        <FeatureToggle
          label="Stacking lip"
          checked={base.stackingLip}
          onChange={toggleStackingLip}
        />

        <FeatureToggle
          label="Magnet holes"
          checked={hasMagnet}
          onChange={toggleMagnet}
          valueSummary={`ø${base.magnetDiameter}mm × ${base.magnetDepth}mm deep`}
        >
          <SliderInput
            label="Magnet radius"
            value={base.magnetDiameter / 2}
            onChange={setMagnetRadius}
            min={DESIGNER_CONSTRAINTS.MIN_MAGNET_RADIUS}
            max={DESIGNER_CONSTRAINTS.MAX_MAGNET_RADIUS}
            step={DESIGNER_CONSTRAINTS.MAGNET_RADIUS_STEP}
            unit="mm"
          />
          <SliderInput
            label="Magnet depth"
            value={base.magnetDepth}
            onChange={setMagnetHeight}
            min={DESIGNER_CONSTRAINTS.MIN_MAGNET_HEIGHT}
            max={DESIGNER_CONSTRAINTS.MAX_MAGNET_HEIGHT}
            step={DESIGNER_CONSTRAINTS.MAGNET_HEIGHT_STEP}
            unit="mm"
          />
        </FeatureToggle>

        <FeatureToggle
          label="Screw holes"
          checked={hasScrew}
          onChange={toggleScrew}
          valueSummary={`ø${base.screwDiameter}mm (M${base.screwDiameter})`}
        >
          <SliderInput
            label="Screw radius"
            value={base.screwDiameter / 2}
            onChange={setScrewRadius}
            min={DESIGNER_CONSTRAINTS.MIN_SCREW_RADIUS}
            max={DESIGNER_CONSTRAINTS.MAX_SCREW_RADIUS}
            step={DESIGNER_CONSTRAINTS.SCREW_RADIUS_STEP}
            unit="mm"
          />
        </FeatureToggle>
      </div>
    </CollapsibleSection>
  );
}

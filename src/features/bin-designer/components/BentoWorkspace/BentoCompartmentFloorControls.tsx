/**
 * Floor raise for the Bento compartment inspector: lifts one compartment's
 * floor on a solid slab. The ceiling follows the bin so the slider cannot ask
 * for a shallower pocket than the generator will build.
 */

import { useShallow } from 'zustand/react/shallow';
import { useTranslation } from '@/i18n';
import { SliderInput } from '@/design-system';
import { useDesignerStore } from '@/features/bin-designer/store';
import { maxCompartmentFloorRaiseMm } from '@/features/bin-designer/utils/compartmentFloorRaise';

export interface BentoCompartmentFloorControlsProps {
  readonly compartmentId: number;
}

export function BentoCompartmentFloorControls({
  compartmentId,
}: BentoCompartmentFloorControlsProps) {
  const t = useTranslation();
  const { raise, maxRaise, setCompartmentFloorRaise } = useDesignerStore(
    useShallow((s) => ({
      raise: s.params.compartments.floorRaises?.[compartmentId] ?? 0,
      maxRaise: maxCompartmentFloorRaiseMm(s.params),
      setCompartmentFloorRaise: s.setCompartmentFloorRaise,
    }))
  );
  if (maxRaise <= 0) return null;

  return (
    <SliderInput
      label={t('binDesigner.bento.floorRaise')}
      value={Math.min(raise, maxRaise)}
      onChange={(mm) => setCompartmentFloorRaise(compartmentId, mm)}
      min={0}
      max={maxRaise}
      step={1}
      unit="mm"
      info={t('binDesigner.bento.floorRaiseHint')}
    />
  );
}

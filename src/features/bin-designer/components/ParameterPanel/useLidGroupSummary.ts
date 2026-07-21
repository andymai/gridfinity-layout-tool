import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useTranslation } from '@/i18n';
import { lidValueSummary } from '../panel/LidSection/useLidSection';

/** Read-only summary for the Lid group when collapsed. Subscribes to just the
 *  lid config and stacking-lip flag (not the whole section hook), so a params
 *  change unrelated to the lid doesn't re-run the lid's derived computations
 *  here. Returns a short "Off" when the lid isn't enabled. */
export function useLidGroupSummary(): string {
  const t = useTranslation();
  const { lid, stackingLip } = useDesignerStore(
    useShallow((s) => ({
      lid: s.params.lid,
      stackingLip: s.params.base.stackingLip,
    }))
  );
  const enabled = lid.enabled && stackingLip;
  return enabled ? lidValueSummary(lid, t) : t('binDesigner.lid.summaryDisabled');
}

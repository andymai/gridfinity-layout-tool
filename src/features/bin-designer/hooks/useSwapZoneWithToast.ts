/**
 * Wraps `pickSwapZone` with a localized success toast.
 *
 * Both the 3D-preview overlay and the Colors panel call `pickSwapZone`,
 * but only the calling components have access to i18n / the toast store
 * — so the wrapping lives at the component layer, not in the slice.
 */

import { useCallback } from 'react';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useToastStore } from '@/core/store';
import { useTranslation } from '@/i18n';
import { zoneTranslationKey } from '@/features/bin-designer/utils/zoneLabels';
import type { ColorZone } from '@/features/bin-designer/types/featureColors';

export function useSwapZoneWithToast(): (zone: ColorZone) => void {
  const t = useTranslation();
  const pickSwapZone = useDesignerStore((s) => s.pickSwapZone);
  const addToast = useToastStore((s) => s.addToast);

  return useCallback(
    (zone: ColorZone) => {
      const result = pickSwapZone(zone);
      if (!result) return;
      addToast({
        message: t('binDesigner.colors.swap.toast', {
          first: t(zoneTranslationKey(result.first)),
          second: t(zoneTranslationKey(result.second)),
        }),
        type: 'success',
        duration: 2500,
      });
    },
    [pickSwapZone, addToast, t]
  );
}

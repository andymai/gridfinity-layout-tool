import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useTranslation } from '@/i18n';
import type { SectionMeta } from '../types';

export function useScoopSection() {
  const { scoop, style, updateScoop } = useDesignerStore(
    useShallow((s) => ({
      scoop: s.params.scoop,
      style: s.params.style,
      updateScoop: s.updateScoop,
    }))
  );
  const t = useTranslation();

  const isUnavailable = style !== 'standard';
  const isAutoRadius = scoop.radius === 'auto';
  const manualRadius = typeof scoop.radius === 'number' ? scoop.radius : 10;

  const toggleScoop = useCallback(() => {
    updateScoop({ enabled: !scoop.enabled });
  }, [scoop.enabled, updateScoop]);

  const toggleAutoRadius = useCallback(() => {
    updateScoop({ radius: isAutoRadius ? manualRadius : 'auto' });
  }, [isAutoRadius, manualRadius, updateScoop]);

  const setRadius = useCallback(
    (radius: number) => {
      updateScoop({ radius });
    },
    [updateScoop]
  );

  const sectionSummary = useMemo(() => {
    if (!scoop.enabled) return undefined;
    return isAutoRadius ? 'Auto' : `${manualRadius}mm`;
  }, [scoop.enabled, isAutoRadius, manualRadius]);

  const disabledReason = isUnavailable ? t('binDesigner.fingerScoopUnavailableSlotted') : undefined;

  const meta: SectionMeta = useMemo(
    () => ({
      summary: isUnavailable ? undefined : sectionSummary,
      disabledReason,
    }),
    [isUnavailable, sectionSummary, disabledReason]
  );

  return {
    state: { scoop, isAutoRadius, manualRadius },
    handlers: { toggleScoop, toggleAutoRadius, setRadius },
    meta,
    t,
  };
}

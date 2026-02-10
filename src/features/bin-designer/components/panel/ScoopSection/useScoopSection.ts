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

  const toggleAllRows = useCallback(() => {
    updateScoop({ allRows: !scoop.allRows });
  }, [scoop.allRows, updateScoop]);

  const sectionSummary = useMemo(() => {
    if (!scoop.enabled) return undefined;
    const parts = [isAutoRadius ? 'Auto' : `${manualRadius}mm`];
    if (scoop.allRows) parts.push(t('binDesigner.scoopAllRows'));
    return parts.join(' \u00b7 ');
  }, [scoop.enabled, scoop.allRows, isAutoRadius, manualRadius, t]);

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
    handlers: { toggleScoop, toggleAutoRadius, setRadius, toggleAllRows },
    meta,
    t,
  };
}

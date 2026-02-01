import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { calculateEcoSavings } from '@/features/bin-designer/utils/printEstimates';

/** Read-only summary for the Eco group when collapsed. */
export function useEcoGroupSummary(): string {
  const { eco, params } = useDesignerStore(
    useShallow((s) => ({
      eco: s.params.eco,
      params: s.params,
    }))
  );

  return useMemo(() => {
    const parts: string[] = [];
    if (eco.honeycombFloor.enabled) parts.push('Honeycomb floor');
    if (eco.honeycombWall.mode !== 'none') parts.push(`${eco.honeycombWall.mode} walls`);
    if (eco.sinusoidalWall.enabled) parts.push('Wave walls');

    if (parts.length === 0) return 'Off';

    const { savingsPercent } = calculateEcoSavings(params);
    return savingsPercent > 0
      ? `${parts.join(' · ')} · ~${savingsPercent}% saved`
      : parts.join(' · ');
  }, [eco, params]);
}

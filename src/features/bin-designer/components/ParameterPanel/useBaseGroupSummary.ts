import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { isMagnetStyle, isScrewStyle } from '@/features/bin-designer/types';

/** Read-only summary for the Base group when collapsed. */
export function useBaseGroupSummary(): string {
  const { base } = useDesignerStore(
    useShallow((s) => ({
      base: s.params.base,
    }))
  );

  return useMemo(() => {
    const hasMagnet = isMagnetStyle(base.style);
    const hasScrew = isScrewStyle(base.style);

    const parts: string[] = [];
    if (hasMagnet) parts.push(`${base.magnetDiameter}mm magnets`);
    if (hasScrew) parts.push(`M${base.screwDiameter} screws`);
    if (base.stackingLip) parts.push('Lip');

    return parts.length > 0 ? parts.join(' \u2022 ') : 'Standard (no attachment)';
  }, [base.style, base.magnetDiameter, base.screwDiameter, base.stackingLip]);
}

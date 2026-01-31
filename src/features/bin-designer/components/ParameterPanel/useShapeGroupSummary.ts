import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';

/** Read-only summary for the Shape group when collapsed. */
export function useShapeGroupSummary(): string {
  const { width, depth, height, gridUnitMm, heightUnitMm, wallThickness } = useDesignerStore(
    useShallow((s) => ({
      width: s.params.width,
      depth: s.params.depth,
      height: s.params.height,
      gridUnitMm: s.params.gridUnitMm,
      heightUnitMm: s.params.heightUnitMm,
      wallThickness: s.params.wallThickness,
    }))
  );

  return useMemo(() => {
    const widthMm = (width * gridUnitMm).toFixed(0);
    const depthMm = (depth * gridUnitMm).toFixed(0);
    const heightMm = (height * heightUnitMm).toFixed(0);

    return `${width}\u00d7${depth}\u00d7${height}u (${widthMm}\u00d7${depthMm}\u00d7${heightMm}mm) \u00b7 ${wallThickness}mm walls`;
  }, [width, depth, height, gridUnitMm, heightUnitMm, wallThickness]);
}

import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';

/** Read-only summary for the Shape group when collapsed. */
export function useShapeGroupSummary(): string {
  const { width, depth, height, wallThickness } = useDesignerStore(
    useShallow((s) => ({
      width: s.params.width,
      depth: s.params.depth,
      height: s.params.height,
      wallThickness: s.params.wallThickness,
    }))
  );

  return useMemo(() => {
    return `${width}\u00d7${depth}\u00d7${height}u \u00b7 ${wallThickness}mm walls`;
  }, [width, depth, height, wallThickness]);
}

import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { computeActiveZones, type ColorZone } from '@/features/bin-designer/types/featureColors';

/**
 * The colour zones the current design can show. The Colors panel, the 3D
 * preview and the canvas colour picker all read this one selection, so they
 * cannot disagree about whether a zone is live; Text depends on captions in
 * five different places, which is how three hand-built copies drifted.
 */
export function useActiveColorZones(): ReadonlySet<ColorZone> {
  const inputs = useDesignerStore(
    useShallow((s) => ({
      style: s.params.style,
      width: s.params.width,
      depth: s.params.depth,
      gridUnitMm: s.params.gridUnitMm,
      gridUnitMmY: s.params.gridUnitMmY,
      fractionalEdgeX: s.params.fractionalEdgeX,
      fractionalEdgeY: s.params.fractionalEdgeY,
      magnetAnchor: s.params.magnetAnchor,
      base: s.params.base,
      label: s.params.label,
      scoop: s.params.scoop,
      lid: s.params.lid,
      compartments: s.params.compartments,
      cutouts: s.params.cutouts,
      surfaceText: s.params.surfaceText,
      cellMask: s.params.cellMask,
      featureColors: s.params.featureColors,
    }))
  );
  return useMemo(() => computeActiveZones(inputs), [inputs]);
}

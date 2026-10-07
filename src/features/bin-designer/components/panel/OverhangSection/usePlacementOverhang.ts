/**
 * The overhang the layout bin this design was opened from prints with instead
 * of the design's own.
 *
 * Export replaces a design's `params.overhang` with the placement's resolved
 * overhang, so the designer can only show it: one design can sit in several
 * placements, and writing one placement's value into the design would apply it
 * to all of them.
 */

import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store/layout';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useDesignerRouting } from '@/shared/hooks/useDesignerRouting';
import { isPartialMask } from '@/shared/utils/cellMask';
import { explicitBinOverhang, resolveBinOverhang } from '@/shared/utils/drawerMargin';
import type { OverhangSide } from './useOverhangSection';

export interface PlacementOverhang {
  readonly source: 'margin' | 'expandToFit';
  /** Only the sides the placement actually extends, in panel order. */
  readonly sides: readonly { readonly side: OverhangSide; readonly mm: number }[];
}

const SIDE_ORDER: readonly OverhangSide[] = ['left', 'right', 'front', 'back'];

export function usePlacementOverhang(): PlacementOverhang | null {
  const { placementBinIdFromUrl } = useDesignerRouting();
  const { currentDesignId, isCustomShape } = useDesignerStore(
    useShallow((s) => ({
      currentDesignId: s.currentDesignId,
      isCustomShape: isPartialMask(s.params.cellMask),
    }))
  );
  const { bins, drawer, baseplate } = useLayoutStore(
    useShallow((s) => ({
      bins: s.layout.bins,
      drawer: s.layout.drawer,
      baseplate: s.layout.baseplateParams,
    }))
  );

  return useMemo(() => {
    // The generator drops every overhang on a custom shape, the placement's too.
    if (placementBinIdFromUrl === null || currentDesignId === null || isCustomShape) return null;
    const bin = bins.find((b) => b.id === placementBinIdFromUrl);
    if (bin?.linkedDesignId !== currentDesignId) return null;
    // No linked kind: this section only renders for a parametric bin, which
    // always extends, and the export resolves those without one too.
    const overhang = resolveBinOverhang(bin, drawer, baseplate);
    if (!overhang) return null;
    const sides = SIDE_ORDER.map((side) => ({ side, mm: Math.max(0, overhang[side]) })).filter(
      (s) => s.mm > 0
    );
    if (sides.length === 0) return null;
    return { source: explicitBinOverhang(bin) ? 'expandToFit' : 'margin', sides };
  }, [placementBinIdFromUrl, currentDesignId, isCustomShape, bins, drawer, baseplate]);
}

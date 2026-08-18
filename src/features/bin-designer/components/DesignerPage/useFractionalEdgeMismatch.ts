/**
 * Detects when the open design's feet disagree with where a bin it's linked to
 * actually sits in the active layout, and exposes a one-click fix.
 *
 * Two ways they can disagree, both resolved from the same placements:
 *  - the half-unit foot of a fractional bin is on the wrong edge
 *  - the foot lattice is wrong for a bin sitting half a unit off the grid, which
 *    leaves it perched on the ridges between pockets instead of seated
 *
 * Only fires while the design is actually linked to a bin in the current layout
 * (so the drawer context is relevant). The edge half honours a manual override;
 * the lattice half has none — a bin that will not drop into its plate is not a
 * matter of preference.
 */

import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { useLayoutStore } from '@/core/store/layout';
import {
  hasFractionalEdgeMismatch,
  computeMatchedEdges,
  hasFootLatticeMismatch,
  computeMatchedFootLattice,
} from '@/shared/utils/fractionalEdge';
import { hasDetachableFeet } from '@/features/bin-designer/types/base';
import { isPartialMask } from '@/shared/utils/cellMask';

interface FractionalEdgeMismatch {
  /** True when the open design's feet disagree with where its linked bin sits. */
  show: boolean;
  /** True when the disagreement is one that stops the bin seating in a plate. */
  blocksSeating: boolean;
  /** Realign the design's feet to the drawer and clear the manual edge flags. */
  matchDrawer: () => void;
}

export function useFractionalEdgeMismatch(): FractionalEdgeMismatch {
  const {
    currentDesignId,
    width,
    depth,
    fractionalEdgeX,
    fractionalEdgeY,
    fractionalEdgeManualX,
    fractionalEdgeManualY,
    base,
    halfSockets,
    feetDetachable,
    footLatticeX,
    footLatticeY,
    cellMask,
    setParams,
  } = useDesignerStore(
    useShallow((s) => ({
      currentDesignId: s.currentDesignId,
      width: s.params.width,
      depth: s.params.depth,
      fractionalEdgeX: s.params.fractionalEdgeX,
      fractionalEdgeY: s.params.fractionalEdgeY,
      fractionalEdgeManualX: s.params.fractionalEdgeManualX,
      fractionalEdgeManualY: s.params.fractionalEdgeManualY,
      base: s.params.base,
      halfSockets: s.params.base.halfSockets,
      feetDetachable: hasDetachableFeet(s.params.base),
      footLatticeX: s.params.base.footLatticeX,
      footLatticeY: s.params.base.footLatticeY,
      cellMask: s.params.cellMask,
      setParams: s.setParams,
    }))
  );

  const drawer = useLayoutStore((s) => s.layout.drawer);
  const bins = useLayoutStore(useShallow((s) => s.layout.bins));

  const design = useMemo(
    () => ({
      width,
      depth,
      fractionalEdgeX,
      fractionalEdgeY,
      fractionalEdgeManualX,
      fractionalEdgeManualY,
      halfSockets,
      detachableFeet: feetDetachable,
      footLatticeX,
      footLatticeY,
      hasCellMask: isPartialMask(cellMask),
    }),
    [
      width,
      depth,
      fractionalEdgeX,
      fractionalEdgeY,
      fractionalEdgeManualX,
      fractionalEdgeManualY,
      halfSockets,
      feetDetachable,
      footLatticeX,
      footLatticeY,
      cellMask,
    ]
  );

  const placements = useMemo(
    () =>
      currentDesignId === null
        ? []
        : bins.filter((b) => b.linkedDesignId === currentDesignId).map((b) => ({ x: b.x, y: b.y })),
    [currentDesignId, bins]
  );

  // One design can be placed several times. The helpers resolve each axis
  // across every placement and stay silent when they disagree, so a conflict no
  // single edge could fix never offers a one-click "fix" that just moves the
  // problem to a sibling bin.
  const blocksSeating = useMemo(
    () => hasFootLatticeMismatch(design, drawer, placements),
    [placements, design, drawer]
  );

  const show = useMemo(
    () => blocksSeating || hasFractionalEdgeMismatch(design, drawer, placements),
    [blocksSeating, placements, design, drawer]
  );

  const matchDrawer = useCallback(() => {
    const lattice = computeMatchedFootLattice(design, drawer, placements);
    setParams({
      ...computeMatchedEdges(design, drawer, placements),
      // Merged rather than assigned: the patch names two keys of a full
      // BaseConfig, and an empty one must not rewrite the base at all.
      ...(Object.keys(lattice).length > 0 ? { base: { ...base, ...lattice } } : {}),
    });
  }, [setParams, base, design, drawer, placements]);

  return { show, blocksSeating, matchDrawer };
}

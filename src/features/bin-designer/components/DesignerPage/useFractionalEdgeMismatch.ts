/**
 * Detects when the open design's half-unit edge disagrees with the drawer of a
 * bin it's linked to in the active layout, and exposes a one-click fix that
 * realigns the edges (issue #2518).
 *
 * Only fires while the design is actually linked to a bin in the current layout
 * (so the drawer context is relevant) and the user hasn't taken manual control
 * of the edge — see `hasFractionalEdgeMismatch`.
 */

import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { useLayoutStore } from '@/core/store/layout';
import { hasFractionalEdgeMismatch, computeMatchedEdges } from '@/shared/utils/fractionalEdge';

interface FractionalEdgeMismatch {
  /** True when the open design's fractional edge disagrees with its linked drawer. */
  show: boolean;
  /** Realign the design's edges to the drawer and clear the manual flag. */
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
    halfSockets,
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
      halfSockets: s.params.base.halfSockets,
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
    }),
    [
      width,
      depth,
      fractionalEdgeX,
      fractionalEdgeY,
      fractionalEdgeManualX,
      fractionalEdgeManualY,
      halfSockets,
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
  const show = useMemo(
    () => hasFractionalEdgeMismatch(design, drawer, placements),
    [placements, design, drawer]
  );

  const matchDrawer = useCallback(() => {
    setParams(computeMatchedEdges(design, drawer, placements));
  }, [setParams, design, drawer, placements]);

  return { show, matchDrawer };
}

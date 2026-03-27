import type { Bin as BinType, Category, Layer, Drawer, ResizeHandle, BinId } from '@/core/types';

export interface BinProps {
  bin: BinType;
  category?: Category;
  layer?: Layer;
  drawer: Drawer;
  cellSize: number;
  gap?: number;
  isGhost: boolean;
  isSelected: boolean;
  onStartDrag: (
    binId: BinId,
    clientX: number,
    clientY: number,
    pointerId?: number,
    duplicate?: boolean,
    swapMode?: boolean
  ) => void;
  onStartResize: (binId: BinId, handle: ResizeHandle, pointerId?: number) => void;
}

/**
 * Custom comparison function for React.memo.
 * Only re-render if props that affect visual appearance change.
 */
export function binPropsAreEqual(prevProps: BinProps, nextProps: BinProps): boolean {
  const { bin: prevBin, category: prevCat, layer: prevLayer, drawer: prevDrawer } = prevProps;
  const { bin: nextBin, category: nextCat, layer: nextLayer, drawer: nextDrawer } = nextProps;

  // Selection/ghost state
  if (prevProps.isSelected !== nextProps.isSelected) return false;
  if (prevProps.isGhost !== nextProps.isGhost) return false;

  // Bin visual properties
  if (
    prevBin.id !== nextBin.id ||
    prevBin.x !== nextBin.x ||
    prevBin.y !== nextBin.y ||
    prevBin.width !== nextBin.width ||
    prevBin.depth !== nextBin.depth ||
    prevBin.height !== nextBin.height ||
    prevBin.label !== nextBin.label ||
    prevBin.category !== nextBin.category ||
    prevBin.notes !== nextBin.notes ||
    prevBin.linkedDesignId !== nextBin.linkedDesignId
  ) {
    return false;
  }

  // Custom properties - shallow object comparison
  const prevCustom = prevBin.customProperties;
  const nextCustom = nextBin.customProperties;
  if (prevCustom !== nextCustom) {
    const prevKeys = prevCustom ? Object.keys(prevCustom) : [];
    const nextKeys = nextCustom ? Object.keys(nextCustom) : [];
    if (prevKeys.length !== nextKeys.length) return false;
    if (prevCustom && nextCustom) {
      for (const key of prevKeys) {
        if (prevCustom[key] !== nextCustom[key]) return false;
      }
    }
  }

  // Category/layer/drawer - only compare visual-affecting properties
  if (prevCat?.id !== nextCat?.id || prevCat?.color !== nextCat?.color) return false;
  if (prevLayer?.id !== nextLayer?.id || prevLayer?.height !== nextLayer?.height) return false;
  if (
    prevDrawer.width !== nextDrawer.width ||
    prevDrawer.depth !== nextDrawer.depth ||
    prevDrawer.fractionalEdgeX !== nextDrawer.fractionalEdgeX ||
    prevDrawer.fractionalEdgeY !== nextDrawer.fractionalEdgeY
  ) {
    return false;
  }

  // Cell sizing
  if (prevProps.cellSize !== nextProps.cellSize || prevProps.gap !== nextProps.gap) return false;

  return true;
}

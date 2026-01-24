import { useMemo } from 'react';
import { useShallow } from 'zustand/shallow';
import { useLayoutStore, useInteractionStore, useHalfBinModeStore } from '@/core/store';
import {
  calcFractionalPixelSize,
  type FractionalGridContext,
} from '@/features/grid-editor/utils/fractionalPixels';

interface OverlayProps {
  cellSize: number;
  gap: number;
}

/**
 * Draw/drag/resize preview overlay.
 * Shows amber dashed border for draw, green/red for drag/resize.
 * Supports multi-bin drag and resize previews.
 */
export function Overlay({ cellSize, gap }: OverlayProps) {
  // Performance: Use focused stores directly instead of facade
  const interaction = useInteractionStore((state) => state.interaction);
  const halfBinMode = useHalfBinModeStore((state) => state.halfBinMode);
  const { drawer, bins } = useLayoutStore(
    useShallow((state) => ({
      drawer: state.layout.drawer,
      bins: state.layout.bins,
    }))
  );

  const visualCellSize = cellSize;
  const visualDepth = drawer.depth;
  const integerDepth = Math.floor(drawer.depth);

  // O(1) lookup map for bins (avoids O(n) .find() calls in render loops)
  const binMap = useMemo(() => new Map(bins.map((b) => [b.id, b])), [bins]);

  // Fractional edge settings affect visual positioning
  const hasFractionalWidth = drawer.width % 1 !== 0;
  const hasFractionalDepth = drawer.depth % 1 !== 0;
  const fractionalEdgeX = drawer.fractionalEdgeX ?? 'end';
  const fractionalEdgeY = drawer.fractionalEdgeY ?? 'end';
  const fractionalWidthPart = drawer.width - Math.floor(drawer.width);
  const fractionalDepthPart = drawer.depth - Math.floor(drawer.depth);
  const fractionalCellWidth = fractionalWidthPart * (cellSize + gap) - gap;
  const fractionalCellHeight = fractionalDepthPart * (cellSize + gap) - gap;

  // Shared fractional grid contexts for width and depth calculations
  const widthCtx: FractionalGridContext = {
    drawerDimension: drawer.width,
    fractionalEdge: fractionalEdgeX,
    cellSize: visualCellSize,
    gap,
  };
  const depthCtx: FractionalGridContext = {
    drawerDimension: drawer.depth,
    fractionalEdge: fractionalEdgeY,
    cellSize: visualCellSize,
    gap,
  };

  // Helper to calculate pixel dimension for grid elements (standard calculation)
  const toPixels = (units: number) => units * visualCellSize + Math.max(0, units - 1) * gap;

  // Calculate pixel width/height accounting for fractional edges
  const calcPixelWidth = (x: number, width: number) =>
    calcFractionalPixelSize(x, width, widthCtx);
  const calcPixelHeight = (y: number, depth: number) =>
    calcFractionalPixelSize(y, depth, depthCtx);

  // Helper to calculate left position accounting for fractional edge
  // When fractionalEdgeX='start', the first column is narrower
  const calcLeft = (x: number) => {
    if (hasFractionalWidth && fractionalEdgeX === 'start') {
      if (x < fractionalWidthPart) {
        // Inside fractional column - position proportionally
        return gap + (x / fractionalWidthPart) * fractionalCellWidth;
      } else {
        // Past fractional column - offset by fractional column width
        const adjustedX = x - fractionalWidthPart;
        return gap + fractionalCellWidth + gap + adjustedX * (visualCellSize + gap);
      }
    }
    return gap + x * (visualCellSize + gap);
  };

  // Helper to calculate top position accounting for fractional edge
  // CSS top = 0 is at top, grid y = 0 is at bottom
  const calcTop = (y: number, depth: number) => {
    const binTopGridY = y + depth; // Top edge of bin in grid coords

    if (hasFractionalDepth && fractionalEdgeY === 'start') {
      // Fractional row at bottom (CSS row = last row)
      // Integer rows are at CSS rows 1 to integerDepth
      if (binTopGridY <= fractionalDepthPart) {
        // Bin top is in fractional row at bottom
        const fractionalRowCssTop = gap + integerDepth * (visualCellSize + gap);
        const offsetFromTop =
          ((fractionalDepthPart - binTopGridY) / fractionalDepthPart) * fractionalCellHeight;
        return fractionalRowCssTop + offsetFromTop;
      }
      // Bin top is in integer rows
      // Integer rows span grid Y from fractionalDepthPart to drawer.depth
      const integerY = binTopGridY - fractionalDepthPart; // 0 to integerDepth
      const wholeRows = Math.floor(integerY);
      const fractionalPart = integerY - wholeRows;
      // CSS row k (1-indexed from top) corresponds to integerY in [integerDepth-k, integerDepth-k+1)
      const cssTop =
        gap +
        (integerDepth - 1 - wholeRows) * (visualCellSize + gap) +
        (1 - fractionalPart) * visualCellSize;
      return cssTop;
    }

    if (hasFractionalDepth && fractionalEdgeY === 'end') {
      // Fractional row at top (CSS row 1)
      // Integer rows are at CSS rows 2 to gridRows
      const topY = visualDepth - binTopGridY;

      if (topY < fractionalDepthPart) {
        // Bin top is in fractional row at top
        return gap + (topY / fractionalDepthPart) * fractionalCellHeight;
      }
      // Bin top is in integer rows (below the fractional row)
      const integerTopY = topY - fractionalDepthPart;
      return gap + fractionalCellHeight + gap + integerTopY * (visualCellSize + gap);
    }

    // Standard case (no fractional depth)
    const topY = visualDepth - binTopGridY;
    return gap + topY * (visualCellSize + gap);
  };

  if (!interaction) return null;

  const previews: React.ReactNode[] = [];

  if (interaction.type === 'draw') {
    const { start, current } = interaction;
    const x1 = Math.min(start.x, current.x);
    const y1 = Math.min(start.y, current.y);
    const x2 = Math.max(start.x, current.x);
    const y2 = Math.max(start.y, current.y);
    // In half-bin mode, minimum unit is 0.5; in normal mode it's 1
    const minUnit = halfBinMode ? 0.5 : 1;
    const width = x2 - x1 + minUnit;
    const depth = y2 - y1 + minUnit;

    const left = calcLeft(x1);
    const top = calcTop(y1, depth);
    const rectWidth = calcPixelWidth(x1, width);
    const rectHeight = calcPixelHeight(y1, depth);

    previews.push(
      <div
        key="draw-preview"
        style={{
          position: 'absolute',
          left,
          top,
          width: rectWidth,
          height: rectHeight,
          border: '2px dashed var(--color-warning)',
          pointerEvents: 'none',
          backgroundColor: 'var(--color-amber-10)',
        }}
      />
    );
  } else if (interaction.type === 'drag') {
    const { binIds, currentCoord, valid, isOverGrid } = interaction;

    // Only show grid preview when mouse is over the grid
    if (!isOverGrid) {
      // Don't render any preview when dragging outside grid
    } else {
      const primaryBin = binMap.get(binIds[0]);
      if (!primaryBin) return null;

      const borderColor = valid ? 'var(--color-success)' : 'var(--color-error)';
      const bgColor = valid ? 'var(--color-success-muted)' : 'var(--color-error-muted)';

      // currentCoord now stores the constrained delta (not absolute position)
      const deltaX = currentCoord.x;
      const deltaY = currentCoord.y;

      // Draw preview for each bin being dragged with uniform delta applied
      for (const binId of binIds) {
        const bin = binMap.get(binId);
        if (!bin) continue;

        // Apply uniform delta - NO individual clamping (preserves arrangement)
        const newX = bin.x + deltaX;
        const newY = bin.y + deltaY;

        const left = calcLeft(newX);
        const top = calcTop(newY, bin.depth);
        const rectWidth = calcPixelWidth(newX, bin.width);
        const rectHeight = calcPixelHeight(newY, bin.depth);

        previews.push(
          <div
            key={`drag-preview-${binId}`}
            style={{
              position: 'absolute',
              left,
              top,
              width: rectWidth,
              height: rectHeight,
              border: `2px solid ${borderColor}`,
              pointerEvents: 'none',
              backgroundColor: bgColor,
            }}
          />
        );
      }
    }
  } else if (interaction.type === 'resize') {
    const { binIds, currentRects, valid } = interaction;
    const borderColor = valid ? 'var(--color-success)' : 'var(--color-error)';
    const bgColor = valid ? 'var(--color-success-muted)' : 'var(--color-error-muted)';

    // Draw preview for each bin being resized
    for (const binId of binIds) {
      const currentRect = currentRects.get(binId);
      const originalBin = binMap.get(binId);
      if (!currentRect || !originalBin) continue;

      const left = calcLeft(currentRect.x);
      const top = calcTop(currentRect.y, currentRect.depth);
      const rectWidth = toPixels(currentRect.width);
      const rectHeight = toPixels(currentRect.depth);

      // Ghost outline of original size (dashed gray border)
      const sizeChanged =
        currentRect.x !== originalBin.x ||
        currentRect.y !== originalBin.y ||
        currentRect.width !== originalBin.width ||
        currentRect.depth !== originalBin.depth;

      if (sizeChanged) {
        const origLeft = calcLeft(originalBin.x);
        const origTop = calcTop(originalBin.y, originalBin.depth);
        const origWidth = toPixels(originalBin.width);
        const origHeight = toPixels(originalBin.depth);

        previews.push(
          <div
            key={`resize-ghost-${binId}`}
            style={{
              position: 'absolute',
              left: origLeft,
              top: origTop,
              width: origWidth,
              height: origHeight,
              border: '2px dashed var(--text-on-dark-muted)',
              boxShadow: '0 0 0 1px var(--overlay-light)',
              pointerEvents: 'none',
              borderRadius: '2px',
              zIndex: 50,
            }}
          />
        );
      }

      // New size preview (solid border)
      previews.push(
        <div
          key={`resize-preview-${binId}`}
          style={{
            position: 'absolute',
            left,
            top,
            width: rectWidth,
            height: rectHeight,
            border: `2px solid ${borderColor}`,
            pointerEvents: 'none',
            backgroundColor: bgColor,
            zIndex: 51,
          }}
        />
      );
    }
  } else if (interaction.type === 'stagingDrag') {
    const { binId, currentCoord, valid } = interaction;
    const bin = binMap.get(binId);

    // Only show preview if we have a valid coordinate (mouse is over grid)
    if (bin && currentCoord) {
      const borderColor = valid ? 'var(--color-success)' : 'var(--color-error)';
      const bgColor = valid ? 'var(--color-success-muted)' : 'var(--color-error-muted)';

      const left = calcLeft(currentCoord.x);
      const top = calcTop(currentCoord.y, bin.depth);
      const rectWidth = toPixels(bin.width);
      const rectHeight = toPixels(bin.depth);

      previews.push(
        <div
          key={`staging-drag-preview-${binId}`}
          style={{
            position: 'absolute',
            left,
            top,
            width: rectWidth,
            height: rectHeight,
            border: `2px dashed ${borderColor}`,
            pointerEvents: 'none',
            backgroundColor: bgColor,
          }}
        />
      );
    }
  } else if (interaction.type === 'paint') {
    const { start, current, paintSize } = interaction;
    const x1 = Math.min(start.x, current.x);
    const y1 = Math.min(start.y, current.y);
    const x2 = Math.max(start.x, current.x);
    const y2 = Math.max(start.y, current.y);
    // In half-bin mode, minimum unit is 0.5; in normal mode it's 1
    const minUnit = halfBinMode ? 0.5 : 1;
    const areaWidth = x2 - x1 + minUnit;
    const areaDepth = y2 - y1 + minUnit;

    // Calculate how many bins fit
    const binsAcross = Math.floor(areaWidth / paintSize.width);
    const binsDown = Math.floor(areaDepth / paintSize.depth);

    // Calculate remainder (leftover space)
    const usedWidth = binsAcross * paintSize.width;
    const usedDepth = binsDown * paintSize.depth;
    const remainderWidth = areaWidth - usedWidth;
    const remainderDepth = areaDepth - usedDepth;
    const hasRemainder = remainderWidth > 0 || remainderDepth > 0;

    // Outer selection area (amber dashed like draw)
    const areaLeft = calcLeft(x1);
    const areaTop = calcTop(y1, areaDepth);
    const areaPixelWidth = toPixels(areaWidth);
    const areaPixelHeight = toPixels(areaDepth);

    previews.push(
      <div
        key="paint-area"
        style={{
          position: 'absolute',
          left: areaLeft,
          top: areaTop,
          width: areaPixelWidth,
          height: areaPixelHeight,
          border: `2px dashed ${hasRemainder ? 'var(--color-warning)' : 'var(--color-success)'}`,
          pointerEvents: 'none',
          backgroundColor: hasRemainder ? 'var(--color-amber-5)' : 'var(--color-green-5)',
        }}
      />
    );

    // Draw grid of bin previews
    if (binsAcross > 0 && binsDown > 0) {
      for (let row = 0; row < binsDown; row++) {
        for (let col = 0; col < binsAcross; col++) {
          const binX = x1 + col * paintSize.width;
          const binY = y1 + row * paintSize.depth;

          const left = calcLeft(binX);
          const top = calcTop(binY, paintSize.depth);
          const rectWidth = toPixels(paintSize.width);
          const rectHeight = toPixels(paintSize.depth);

          previews.push(
            <div
              key={`paint-bin-${col}-${row}`}
              style={{
                position: 'absolute',
                left,
                top,
                width: rectWidth,
                height: rectHeight,
                border: '1px solid var(--color-success)',
                pointerEvents: 'none',
                backgroundColor: 'var(--color-green-15)',
              }}
            />
          );
        }
      }
    }

    // Show remainder area as red/warning if it exists
    if (hasRemainder) {
      // Right remainder strip
      if (remainderWidth > 0 && binsDown > 0) {
        const stripX = x1 + usedWidth;

        const stripLeft = calcLeft(stripX);
        const stripTop = calcTop(y1, usedDepth);
        const stripWidth = toPixels(remainderWidth);
        const stripHeight = toPixels(usedDepth);

        previews.push(
          <div
            key="paint-remainder-right"
            style={{
              position: 'absolute',
              left: stripLeft,
              top: stripTop,
              width: stripWidth,
              height: stripHeight,
              backgroundColor: 'var(--color-red-20)',
              pointerEvents: 'none',
            }}
          />
        );
      }

      // Top remainder strip (full width)
      if (remainderDepth > 0) {
        const stripY = y1 + usedDepth;

        const stripLeft = calcLeft(x1);
        const stripTop = calcTop(stripY, remainderDepth);
        const stripWidth = toPixels(areaWidth);
        const stripHeight = toPixels(remainderDepth);

        previews.push(
          <div
            key="paint-remainder-top"
            style={{
              position: 'absolute',
              left: stripLeft,
              top: stripTop,
              width: stripWidth,
              height: stripHeight,
              backgroundColor: 'var(--color-red-20)',
              pointerEvents: 'none',
            }}
          />
        );
      }
    }
  }

  return <>{previews}</>;
}

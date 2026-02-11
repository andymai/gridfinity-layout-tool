import { useMemo } from 'react';
import { useShallow } from 'zustand/shallow';
import { useLayoutStore, useInteractionStore, useHalfBinModeStore } from '@/core/store';
import {
  calcFractionalPixelSize,
  toPixels,
  type FractionalGridContext,
} from '@/features/grid-editor/utils/fractionalPixels';
import { useTranslation } from '@/i18n';
import type { ValidationReason, BlockingInfo } from '@/core/types';

interface OverlayProps {
  cellSize: number;
  gap: number;
}

/**
 * Floating indicator component that shows why placement is invalid.
 * Positioned relative to the preview rectangle.
 */
function PlacementIndicator({
  reason,
  blockingInfo,
  left,
  top,
}: {
  reason: ValidationReason;
  blockingInfo?: BlockingInfo;
  left: number;
  top: number;
}) {
  const t = useTranslation();

  // Generate message based on reason
  let message: string;
  if (reason === 'blocked_zone' && blockingInfo) {
    message = t('grid.blockedByBin', { layer: blockingInfo.layerName });
  } else if (reason === 'collision') {
    message = t('grid.collision');
  } else if (
    reason === 'out_of_bounds' ||
    reason === 'exceeds_width' ||
    reason === 'exceeds_depth' ||
    reason === 'exceeds_height'
  ) {
    message = t('grid.outOfBounds');
  } else if (reason === 'invalid_layer') {
    message = t('grid.invalidLayer');
  } else {
    // Exhaustive check - should never reach here with current ValidationReason type
    return null;
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: left + 4,
        top: top - 28,
        backgroundColor: 'var(--color-error)',
        color: 'white',
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '12px',
        fontWeight: 500,
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        zIndex: 100,
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
      }}
    >
      {message}
    </div>
  );
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
  const calcPixels = (units: number) => toPixels(units, visualCellSize, gap);

  // Calculate pixel width/height accounting for fractional edges
  const calcPixelWidth = (x: number, width: number) => calcFractionalPixelSize(x, width, widthCtx);
  const calcPixelHeight = (y: number, depth: number) => calcFractionalPixelSize(y, depth, depthCtx);

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
    const { binIds, currentCoord, valid, isOverGrid, swapMode, swapTarget } = interaction;

    // Show swap target highlight when hovering over a compatible bin
    if (swapTarget && swapMode) {
      const targetBin = binMap.get(swapTarget.binId);
      if (targetBin) {
        const targetLeft = calcLeft(targetBin.x);
        const targetTop = calcTop(targetBin.y, targetBin.depth);
        const targetWidth = calcPixelWidth(targetBin.x, targetBin.width);
        const targetHeight = calcPixelHeight(targetBin.y, targetBin.depth);

        // Swap target: purple/indigo highlight to distinguish from normal drag
        previews.push(
          <div
            key={`swap-target-${swapTarget.binId}`}
            style={{
              position: 'absolute',
              left: targetLeft,
              top: targetTop,
              width: targetWidth,
              height: targetHeight,
              border: '3px solid var(--color-primary)',
              pointerEvents: 'none',
              backgroundColor: 'var(--color-primary-muted)',
              borderRadius: '4px',
              zIndex: 60,
            }}
          >
            {/* Swap indicator icon or text */}
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                color: 'var(--color-primary)',
                fontWeight: 'bold',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
              </svg>
              {swapTarget.requiresRotation && (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9" />
                </svg>
              )}
            </div>
          </div>
        );
      }
    }

    // Only show grid preview when mouse is over the grid
    if (!isOverGrid) {
      // Don't render any preview when dragging outside grid
    } else if (!swapTarget) {
      // Normal drag preview (only when not showing swap target)
      const primaryBin = binMap.get(binIds[0]);
      if (!primaryBin) return null;

      const borderColor = valid ? 'var(--color-success)' : 'var(--color-error)';
      const bgColor = valid ? 'var(--color-success-muted)' : 'var(--color-error-muted)';

      // currentCoord now stores the constrained delta (not absolute position)
      const deltaX = currentCoord.x;
      const deltaY = currentCoord.y;

      // Draw preview for each bin being dragged with uniform delta applied
      let firstPreviewLeft = 0;
      let firstPreviewTop = 0;
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

        // Track first preview position for indicator
        if (binId === binIds[0]) {
          firstPreviewLeft = left;
          firstPreviewTop = top;
        }

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

      // Show placement indicator when invalid
      if (!valid && interaction.invalidReason) {
        previews.push(
          <PlacementIndicator
            key="drag-indicator"
            reason={interaction.invalidReason}
            blockingInfo={interaction.blockingInfo}
            left={firstPreviewLeft}
            top={firstPreviewTop}
          />
        );
      }
    }
  } else if (interaction.type === 'resize') {
    const { binIds, currentRects, valid } = interaction;
    const borderColor = valid ? 'var(--color-success)' : 'var(--color-error)';
    const bgColor = valid ? 'var(--color-success-muted)' : 'var(--color-error-muted)';

    let firstPreviewLeft = 0;
    let firstPreviewTop = 0;
    let isFirstBin = true;

    // Draw preview for each bin being resized
    for (const binId of binIds) {
      const currentRect = currentRects.get(binId);
      const originalBin = binMap.get(binId);
      if (!currentRect || !originalBin) continue;

      const left = calcLeft(currentRect.x);
      const top = calcTop(currentRect.y, currentRect.depth);
      const rectWidth = calcPixels(currentRect.width);
      const rectHeight = calcPixels(currentRect.depth);

      // Track first preview position for indicator
      if (isFirstBin) {
        firstPreviewLeft = left;
        firstPreviewTop = top;
        isFirstBin = false;
      }

      // Ghost outline of original size (dashed gray border)
      const sizeChanged =
        currentRect.x !== originalBin.x ||
        currentRect.y !== originalBin.y ||
        currentRect.width !== originalBin.width ||
        currentRect.depth !== originalBin.depth;

      if (sizeChanged) {
        const origLeft = calcLeft(originalBin.x);
        const origTop = calcTop(originalBin.y, originalBin.depth);
        const origWidth = calcPixels(originalBin.width);
        const origHeight = calcPixels(originalBin.depth);

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

    // Show placement indicator when invalid (only if at least one bin was processed)
    if (!valid && interaction.invalidReason && !isFirstBin) {
      previews.push(
        <PlacementIndicator
          key="resize-indicator"
          reason={interaction.invalidReason}
          blockingInfo={interaction.blockingInfo}
          left={firstPreviewLeft}
          top={firstPreviewTop}
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
      const rectWidth = calcPixels(bin.width);
      const rectHeight = calcPixels(bin.depth);

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

      // Show placement indicator when invalid
      if (!valid && interaction.invalidReason) {
        previews.push(
          <PlacementIndicator
            key="staging-drag-indicator"
            reason={interaction.invalidReason}
            blockingInfo={interaction.blockingInfo}
            left={left}
            top={top}
          />
        );
      }
    }
  } else {
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
    const areaPixelWidth = calcPixels(areaWidth);
    const areaPixelHeight = calcPixels(areaDepth);

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
          const rectWidth = calcPixels(paintSize.width);
          const rectHeight = calcPixels(paintSize.depth);

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
        const stripWidth = calcPixels(remainderWidth);
        const stripHeight = calcPixels(usedDepth);

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
        const stripWidth = calcPixels(areaWidth);
        const stripHeight = calcPixels(remainderDepth);

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

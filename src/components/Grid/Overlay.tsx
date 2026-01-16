import { useShallow } from 'zustand/shallow';
import { useLayoutStore, useInteractionStore, useHalfBinModeStore } from '../../store';

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

  // Always use standard cell size (grid renders at normal dimensions)
  // Half-bin mode only affects snapping, not visual grid size
  const visualCellSize = cellSize;
  // No scaling needed - grid is always standard dimensions
  const scale = 1;
  // Visual grid dimensions (standard)
  const visualDepth = drawer.depth;
  const integerDepth = Math.floor(drawer.depth);

  // Fractional edge settings affect visual positioning
  const hasFractionalWidth = drawer.width % 1 !== 0;
  const hasFractionalDepth = drawer.depth % 1 !== 0;
  const fractionalEdgeX = drawer.fractionalEdgeX ?? 'end';
  const fractionalEdgeY = drawer.fractionalEdgeY ?? 'end';

  // Calculate fractional cell dimensions
  const fractionalWidthPart = drawer.width - Math.floor(drawer.width);
  const fractionalDepthPart = drawer.depth - Math.floor(drawer.depth);
  const fractionalCellWidth = fractionalWidthPart * (cellSize + gap) - gap;
  const fractionalCellHeight = fractionalDepthPart * (cellSize + gap) - gap;

  // Helper to calculate pixel dimension for grid elements (standard calculation)
  const toPixels = (units: number) => units * visualCellSize + Math.max(0, units - 1) * gap;

  // Calculate pixel width accounting for fractional edges
  const calcPixelWidth = (x: number, width: number): number => {
    if (!hasFractionalWidth) {
      return width * visualCellSize + Math.max(0, width - 1) * gap;
    }

    const binEndX = x + width;

    if (fractionalEdgeX === 'start') {
      // Fractional column at left [0, fractionalWidthPart)
      const inFractional = Math.max(0, Math.min(binEndX, fractionalWidthPart) - Math.max(x, 0));
      const inInteger = width - inFractional;

      let pixelWidth = 0;
      if (inFractional > 0) {
        pixelWidth += (inFractional / fractionalWidthPart) * fractionalCellWidth;
      }
      if (inInteger > 0) {
        if (inFractional > 0) pixelWidth += gap;
        pixelWidth += inInteger * visualCellSize + Math.max(0, Math.floor(inInteger + 0.001) - 1) * gap;
      }
      return pixelWidth;
    } else {
      // Fractional column at right
      const integerWidth = Math.floor(drawer.width);
      const inInteger = Math.max(0, Math.min(binEndX, integerWidth) - x);
      const inFractional = width - inInteger;

      let pixelWidth = 0;
      if (inInteger > 0) {
        pixelWidth += inInteger * visualCellSize + Math.max(0, Math.floor(inInteger + 0.001) - 1) * gap;
      }
      if (inFractional > 0) {
        if (inInteger > 0) pixelWidth += gap;
        pixelWidth += (inFractional / fractionalWidthPart) * fractionalCellWidth;
      }
      return pixelWidth;
    }
  };

  // Calculate pixel height accounting for fractional edges
  const calcPixelHeight = (y: number, depth: number): number => {
    if (!hasFractionalDepth) {
      return depth * visualCellSize + Math.max(0, depth - 1) * gap;
    }

    const binEndY = y + depth;

    if (fractionalEdgeY === 'start') {
      // Fractional row at bottom [0, fractionalDepthPart)
      const inFractional = Math.max(0, Math.min(binEndY, fractionalDepthPart) - Math.max(y, 0));
      const inInteger = depth - inFractional;

      let pixelHeight = 0;
      if (inFractional > 0) {
        pixelHeight += (inFractional / fractionalDepthPart) * fractionalCellHeight;
      }
      if (inInteger > 0) {
        if (inFractional > 0) pixelHeight += gap;
        pixelHeight += inInteger * visualCellSize + Math.max(0, Math.floor(inInteger + 0.001) - 1) * gap;
      }
      return pixelHeight;
    } else {
      // Fractional row at top [integerDepth, drawer.depth)
      const inInteger = Math.max(0, Math.min(binEndY, integerDepth) - y);
      const inFractional = depth - inInteger;

      let pixelHeight = 0;
      if (inInteger > 0) {
        pixelHeight += inInteger * visualCellSize + Math.max(0, Math.floor(inInteger + 0.001) - 1) * gap;
      }
      if (inFractional > 0) {
        if (inInteger > 0) pixelHeight += gap;
        pixelHeight += (inFractional / fractionalDepthPart) * fractionalCellHeight;
      }
      return pixelHeight;
    }
  };

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
        const offsetFromTop = (fractionalDepthPart - binTopGridY) / fractionalDepthPart * fractionalCellHeight;
        return fractionalRowCssTop + offsetFromTop;
      }
      // Bin top is in integer rows
      // Integer rows span grid Y from fractionalDepthPart to drawer.depth
      const integerY = binTopGridY - fractionalDepthPart; // 0 to integerDepth
      const wholeRows = Math.floor(integerY);
      const fractionalPart = integerY - wholeRows;
      // CSS row k (1-indexed from top) corresponds to integerY in [integerDepth-k, integerDepth-k+1)
      const cssTop = gap + (integerDepth - 1 - wholeRows) * (visualCellSize + gap) + (1 - fractionalPart) * visualCellSize;
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

    // Scale coordinates for half-bin mode
    const vx1 = x1 * scale;
    const vWidth = width * scale;
    const vDepth = depth * scale;

    const left = calcLeft(vx1);
    const top = calcTop(y1 * scale, vDepth);
    const rectWidth = calcPixelWidth(vx1, vWidth);
    const rectHeight = calcPixelHeight(y1 * scale, vDepth);

    previews.push(
      <div
        key="draw-preview"
        style={{
          position: 'absolute',
          left,
          top,
          width: rectWidth,
          height: rectHeight,
          border: '2px dashed #f59e0b',
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
      const primaryBin = bins.find((b) => b.id === binIds[0]);
      if (!primaryBin) return null;

      const color = valid ? '#10b981' : '#ef4444'; // green or red

      // currentCoord now stores the constrained delta (not absolute position)
      const deltaX = currentCoord.x;
      const deltaY = currentCoord.y;

      // Draw preview for each bin being dragged with uniform delta applied
      for (const binId of binIds) {
        const bin = bins.find((b) => b.id === binId);
        if (!bin) continue;

        // Apply uniform delta - NO individual clamping (preserves arrangement)
        const newX = bin.x + deltaX;
        const newY = bin.y + deltaY;

        // Scale for half-bin mode
        const vNewX = newX * scale;
        const vNewY = newY * scale;
        const vBinWidth = bin.width * scale;
        const vBinDepth = bin.depth * scale;

        const left = calcLeft(vNewX);
        const top = calcTop(vNewY, vBinDepth);
        const rectWidth = calcPixelWidth(vNewX, vBinWidth);
        const rectHeight = calcPixelHeight(vNewY, vBinDepth);

        previews.push(
          <div
            key={`drag-preview-${binId}`}
            style={{
              position: 'absolute',
              left,
              top,
              width: rectWidth,
              height: rectHeight,
              border: `2px solid ${color}`,
              pointerEvents: 'none',
              backgroundColor: `${color}20`,
            }}
          />
        );
      }
    }
  } else if (interaction.type === 'resize') {
    const { binIds, currentRects, valid } = interaction;
    const color = valid ? '#10b981' : '#ef4444'; // green or red

    // Draw preview for each bin being resized
    for (const binId of binIds) {
      const currentRect = currentRects.get(binId);
      const originalBin = bins.find((b) => b.id === binId);
      if (!currentRect || !originalBin) continue;

      // Scale for half-bin mode
      const vRectX = currentRect.x * scale;
      const vRectWidth = currentRect.width * scale;
      const vRectDepth = currentRect.depth * scale;

      const left = calcLeft(vRectX);
      const top = calcTop(currentRect.y * scale, vRectDepth);
      const rectWidth = toPixels(vRectWidth);
      const rectHeight = toPixels(vRectDepth);

      // Ghost outline of original size (dashed gray border)
      const sizeChanged = currentRect.x !== originalBin.x ||
                          currentRect.y !== originalBin.y ||
                          currentRect.width !== originalBin.width ||
                          currentRect.depth !== originalBin.depth;

      if (sizeChanged) {
        // Scale original bin dimensions
        const vOrigX = originalBin.x * scale;
        const vOrigWidth = originalBin.width * scale;
        const vOrigDepth = originalBin.depth * scale;

        const origLeft = calcLeft(vOrigX);
        const origTop = calcTop(originalBin.y * scale, vOrigDepth);
        const origWidth = toPixels(vOrigWidth);
        const origHeight = toPixels(vOrigDepth);

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
            border: `2px solid ${color}`,
            pointerEvents: 'none',
            backgroundColor: `${color}20`,
            zIndex: 51,
          }}
        />
      );
    }

  } else if (interaction.type === 'stagingDrag') {
    const { binId, currentCoord, valid } = interaction;
    const bin = bins.find((b) => b.id === binId);

    // Only show preview if we have a valid coordinate (mouse is over grid)
    if (bin && currentCoord) {
      const color = valid ? '#10b981' : '#ef4444'; // green or red

      // Scale for half-bin mode
      const vCoordX = currentCoord.x * scale;
      const vBinWidth = bin.width * scale;
      const vBinDepth = bin.depth * scale;

      const left = calcLeft(vCoordX);
      const top = calcTop(currentCoord.y * scale, vBinDepth);
      const rectWidth = toPixels(vBinWidth);
      const rectHeight = toPixels(vBinDepth);

      previews.push(
        <div
          key={`staging-drag-preview-${binId}`}
          style={{
            position: 'absolute',
            left,
            top,
            width: rectWidth,
            height: rectHeight,
            border: `2px solid ${color}`,
            borderStyle: 'dashed',
            pointerEvents: 'none',
            backgroundColor: `${color}20`,
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

    // Scale for half-bin mode
    const vx1 = x1 * scale;
    const vAreaWidth = areaWidth * scale;
    const vAreaDepth = areaDepth * scale;

    // Outer selection area (amber dashed like draw)
    const areaLeft = calcLeft(vx1);
    const areaTop = calcTop(y1 * scale, vAreaDepth);
    const areaPixelWidth = toPixels(vAreaWidth);
    const areaPixelHeight = toPixels(vAreaDepth);

    previews.push(
      <div
        key="paint-area"
        style={{
          position: 'absolute',
          left: areaLeft,
          top: areaTop,
          width: areaPixelWidth,
          height: areaPixelHeight,
          border: `2px dashed ${hasRemainder ? '#f59e0b' : '#10b981'}`,
          pointerEvents: 'none',
          backgroundColor: hasRemainder ? 'var(--color-amber-5)' : 'var(--color-green-5)',
        }}
      />
    );

    // Draw grid of bin previews
    if (binsAcross > 0 && binsDown > 0) {
      // Scale paint size for visual display
      const vPaintWidth = paintSize.width * scale;
      const vPaintDepth = paintSize.depth * scale;

      for (let row = 0; row < binsDown; row++) {
        for (let col = 0; col < binsAcross; col++) {
          const binX = x1 + col * paintSize.width;
          const binY = y1 + row * paintSize.depth;

          // Scale coordinates
          const vBinX = binX * scale;

          const left = calcLeft(vBinX);
          const top = calcTop(binY * scale, vPaintDepth);
          const rectWidth = toPixels(vPaintWidth);
          const rectHeight = toPixels(vPaintDepth);

          previews.push(
            <div
              key={`paint-bin-${col}-${row}`}
              style={{
                position: 'absolute',
                left,
                top,
                width: rectWidth,
                height: rectHeight,
                border: '1px solid #10b981',
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
      // Scale remainder dimensions
      const vRemainderWidth = remainderWidth * scale;
      const vRemainderDepth = remainderDepth * scale;
      const vUsedDepth = usedDepth * scale;

      // Right remainder strip
      if (remainderWidth > 0 && binsDown > 0) {
        const stripX = x1 + usedWidth;
        const vStripX = stripX * scale;

        const stripLeft = calcLeft(vStripX);
        const stripTop = calcTop(y1 * scale, vUsedDepth);
        const stripWidth = toPixels(vRemainderWidth);
        const stripHeight = toPixels(vUsedDepth);

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

        const stripLeft = calcLeft(vx1);
        const stripTop = calcTop(stripY * scale, vRemainderDepth);
        const stripWidth = toPixels(vAreaWidth);
        const stripHeight = toPixels(vRemainderDepth);

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

import { useShallow } from 'zustand/shallow';
import { useUIStore, useLayoutStore } from '../../store';

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
  const { interaction, halfBinMode } = useUIStore(
    useShallow((state) => ({
      interaction: state.interaction,
      halfBinMode: state.halfBinMode,
    }))
  );
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

  // Helper to calculate pixel dimension for grid elements
  // Uses Math.max(0, units - 1) to handle fractional dimensions correctly
  // (avoids negative gap contribution when units < 1)
  const toPixels = (units: number) => units * visualCellSize + Math.max(0, units - 1) * gap;

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

    const left = gap + vx1 * (visualCellSize + gap);
    // Use y1 (min Y) to match Bin.tsx positioning formula:
    // gridRowStart = (drawer.depth - bin.y - bin.depth) * scale + 1
    // which equals: visualDepth - y1*scale - depth*scale + 1 (in 1-indexed CSS)
    // or in 0-indexed pixels: visualDepth - vy1 - vDepth
    const vy1 = y1 * scale;
    const top = gap + (visualDepth - vy1 - vDepth) * (visualCellSize + gap);
    const rectWidth = toPixels(vWidth);
    const rectHeight = toPixels(vDepth);

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

        const left = gap + vNewX * (visualCellSize + gap);
        const top = gap + (visualDepth - vNewY - vBinDepth) * (visualCellSize + gap);
        const rectWidth = toPixels(vBinWidth);
        const rectHeight = toPixels(vBinDepth);

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
      const vRectY = currentRect.y * scale;
      const vRectWidth = currentRect.width * scale;
      const vRectDepth = currentRect.depth * scale;

      const left = gap + vRectX * (visualCellSize + gap);
      const top = gap + (visualDepth - vRectY - vRectDepth) * (visualCellSize + gap);
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
        const vOrigY = originalBin.y * scale;
        const vOrigWidth = originalBin.width * scale;
        const vOrigDepth = originalBin.depth * scale;

        const origLeft = gap + vOrigX * (visualCellSize + gap);
        const origTop = gap + (visualDepth - vOrigY - vOrigDepth) * (visualCellSize + gap);
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
      const vCoordY = currentCoord.y * scale;
      const vBinWidth = bin.width * scale;
      const vBinDepth = bin.depth * scale;

      const left = gap + vCoordX * (visualCellSize + gap);
      const top = gap + (visualDepth - vCoordY - vBinDepth) * (visualCellSize + gap);
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
    const vy1 = y1 * scale;
    const vAreaWidth = areaWidth * scale;
    const vAreaDepth = areaDepth * scale;

    // Outer selection area (amber dashed like draw)
    const areaLeft = gap + vx1 * (visualCellSize + gap);
    // Use y1 (min Y) to match draw mode and Bin.tsx positioning formula
    const areaTop = gap + (visualDepth - vy1 - vAreaDepth) * (visualCellSize + gap);
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
          const vBinY = binY * scale;

          const left = gap + vBinX * (visualCellSize + gap);
          const top = gap + (visualDepth - vBinY - vPaintDepth) * (visualCellSize + gap);
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
        const vy1 = y1 * scale;

        const stripLeft = gap + vStripX * (visualCellSize + gap);
        const stripTop = gap + (visualDepth - vy1 - vUsedDepth) * (visualCellSize + gap);
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
        const vStripY = stripY * scale;

        const stripLeft = gap + vx1 * (visualCellSize + gap);
        const stripTop = gap + (visualDepth - vStripY - vRemainderDepth) * (visualCellSize + gap);
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

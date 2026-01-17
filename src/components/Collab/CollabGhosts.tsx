/**
 * Container component for rendering remote user operation ghosts.
 *
 * Shows semi-transparent previews of what other users are doing:
 * - Drawing: dashed rectangle where they're creating a bin
 * - Dragging: ghost outlines of bins at their destination position
 * - Resizing: ghost outlines showing new size
 *
 * Coordinate System:
 * - Grid uses bottom-left origin (y=0 at bottom)
 * - CSS uses top-left origin (y=0 at top)
 * - We transform coordinates when rendering
 */

import { useOthers } from '../../liveblocks.config';
import { useUIStore, useLayoutStore } from '../../core/store';
import { getBaseCellSize } from '../../core/constants';
import { useResponsive } from '../../shared/hooks';
import type { InteractionHint } from '../../liveblocks.config';
import type { Bin } from '../../core/types';

interface CollabGhostsProps {
  /** Optional className for the container */
  className?: string;
}

/**
 * Renders ghost outlines for remote users' in-progress operations.
 * Uses the same coordinate system as Overlay.tsx for consistency.
 */
export function CollabGhosts({ className }: CollabGhostsProps) {
  const others = useOthers();
  const zoom = useUIStore((state) => state.zoom);
  const drawer = useLayoutStore((state) => state.layout.drawer);
  const bins = useLayoutStore((state) => state.layout.bins);
  const { viewportWidth } = useResponsive();

  // Calculate cell size with zoom
  const cellSize = Math.round(getBaseCellSize(viewportWidth) * zoom);
  const gap = 1; // 1px gap between cells

  // Filter to users with active (non-idle) interactions
  const usersWithInteractions = others.filter(
    ({ presence }) =>
      presence.interaction &&
      presence.interaction.type !== 'idle'
  );

  if (usersWithInteractions.length === 0) {
    return null;
  }

  // Calculate fractional edge settings for positioning
  const hasFractionalWidth = drawer.width % 1 !== 0;
  const hasFractionalDepth = drawer.depth % 1 !== 0;
  const fractionalEdgeX = drawer.fractionalEdgeX ?? 'end';
  const fractionalEdgeY = drawer.fractionalEdgeY ?? 'end';
  const fractionalWidthPart = drawer.width - Math.floor(drawer.width);
  const fractionalDepthPart = drawer.depth - Math.floor(drawer.depth);
  const fractionalCellWidth = fractionalWidthPart * (cellSize + gap) - gap;
  const fractionalCellHeight = fractionalDepthPart * (cellSize + gap) - gap;
  const integerDepth = Math.floor(drawer.depth);
  const visualDepth = drawer.depth;

  // Positioning helpers (copied from Overlay.tsx for consistency)
  const calcLeft = (x: number) => {
    if (hasFractionalWidth && fractionalEdgeX === 'start') {
      if (x < fractionalWidthPart) {
        return gap + (x / fractionalWidthPart) * fractionalCellWidth;
      } else {
        const adjustedX = x - fractionalWidthPart;
        return gap + fractionalCellWidth + gap + adjustedX * (cellSize + gap);
      }
    }
    return gap + x * (cellSize + gap);
  };

  const calcTop = (y: number, depth: number) => {
    const binTopGridY = y + depth;

    if (hasFractionalDepth && fractionalEdgeY === 'start') {
      if (binTopGridY <= fractionalDepthPart) {
        const fractionalRowCssTop = gap + integerDepth * (cellSize + gap);
        const offsetFromTop = (fractionalDepthPart - binTopGridY) / fractionalDepthPart * fractionalCellHeight;
        return fractionalRowCssTop + offsetFromTop;
      }
      const integerY = binTopGridY - fractionalDepthPart;
      const wholeRows = Math.floor(integerY);
      const fractionalPart = integerY - wholeRows;
      const cssTop = gap + (integerDepth - 1 - wholeRows) * (cellSize + gap) + (1 - fractionalPart) * cellSize;
      return cssTop;
    }

    if (hasFractionalDepth && fractionalEdgeY === 'end') {
      const topY = visualDepth - binTopGridY;
      if (topY < fractionalDepthPart) {
        return gap + (topY / fractionalDepthPart) * fractionalCellHeight;
      }
      const integerTopY = topY - fractionalDepthPart;
      return gap + fractionalCellHeight + gap + integerTopY * (cellSize + gap);
    }

    const topY = visualDepth - binTopGridY;
    return gap + topY * (cellSize + gap);
  };

  const calcPixelWidth = (x: number, width: number): number => {
    if (!hasFractionalWidth) {
      return width * cellSize + Math.max(0, width - 1) * gap;
    }

    const binEndX = x + width;

    if (fractionalEdgeX === 'start') {
      const inFractional = Math.max(0, Math.min(binEndX, fractionalWidthPart) - Math.max(x, 0));
      const inInteger = width - inFractional;

      let pixelWidth = 0;
      if (inFractional > 0) {
        pixelWidth += (inFractional / fractionalWidthPart) * fractionalCellWidth;
      }
      if (inInteger > 0) {
        if (inFractional > 0) pixelWidth += gap;
        pixelWidth += inInteger * cellSize + Math.max(0, Math.floor(inInteger + 0.001) - 1) * gap;
      }
      return pixelWidth;
    } else {
      const integerWidth = Math.floor(drawer.width);
      const inInteger = Math.max(0, Math.min(binEndX, integerWidth) - x);
      const inFractional = width - inInteger;

      let pixelWidth = 0;
      if (inInteger > 0) {
        pixelWidth += inInteger * cellSize + Math.max(0, Math.floor(inInteger + 0.001) - 1) * gap;
      }
      if (inFractional > 0) {
        if (inInteger > 0) pixelWidth += gap;
        pixelWidth += (inFractional / fractionalWidthPart) * fractionalCellWidth;
      }
      return pixelWidth;
    }
  };

  const calcPixelHeight = (y: number, depth: number): number => {
    if (!hasFractionalDepth) {
      return depth * cellSize + Math.max(0, depth - 1) * gap;
    }

    const binEndY = y + depth;

    if (fractionalEdgeY === 'start') {
      const inFractional = Math.max(0, Math.min(binEndY, fractionalDepthPart) - Math.max(y, 0));
      const inInteger = depth - inFractional;

      let pixelHeight = 0;
      if (inFractional > 0) {
        pixelHeight += (inFractional / fractionalDepthPart) * fractionalCellHeight;
      }
      if (inInteger > 0) {
        if (inFractional > 0) pixelHeight += gap;
        pixelHeight += inInteger * cellSize + Math.max(0, Math.floor(inInteger + 0.001) - 1) * gap;
      }
      return pixelHeight;
    } else {
      const inInteger = Math.max(0, Math.min(binEndY, integerDepth) - y);
      const inFractional = depth - inInteger;

      let pixelHeight = 0;
      if (inInteger > 0) {
        pixelHeight += inInteger * cellSize + Math.max(0, Math.floor(inInteger + 0.001) - 1) * gap;
      }
      if (inFractional > 0) {
        if (inInteger > 0) pixelHeight += gap;
        pixelHeight += (inFractional / fractionalDepthPart) * fractionalCellHeight;
      }
      return pixelHeight;
    }
  };

  // Render ghost for a drawing/selecting interaction
  const renderDrawingGhost = (
    key: string,
    interaction: Extract<InteractionHint, { type: 'drawing' | 'selecting' }>,
    color: string
  ) => {
    const { start, current } = interaction;
    const x1 = Math.min(start.x, current.x);
    const y1 = Math.min(start.y, current.y);
    const x2 = Math.max(start.x, current.x);
    const y2 = Math.max(start.y, current.y);
    const width = x2 - x1 + 1;
    const depth = y2 - y1 + 1;

    const left = calcLeft(x1);
    const top = calcTop(y1, depth);
    const rectWidth = calcPixelWidth(x1, width);
    const rectHeight = calcPixelHeight(y1, depth);

    return (
      <div
        key={key}
        className="animate-in fade-in duration-150"
        style={{
          position: 'absolute',
          left,
          top,
          width: rectWidth,
          height: rectHeight,
          border: `2px dashed ${color}`,
          borderRadius: 4,
          background: `linear-gradient(135deg, ${color}20, ${color}08)`,
          boxShadow: `0 2px 8px rgba(0, 0, 0, 0.12), 0 0 0 1px ${color}30, 0 0 10px ${color}25`,
          pointerEvents: 'none',
          willChange: 'opacity, transform',
        }}
        aria-hidden="true"
      />
    );
  };

  // Render ghosts for a dragging interaction
  const renderDraggingGhosts = (
    keyPrefix: string,
    interaction: Extract<InteractionHint, { type: 'dragging' }>,
    color: string,
    allBins: Bin[]
  ) => {
    const { binIds, delta } = interaction;
    const ghosts: React.ReactNode[] = [];

    for (const binId of binIds) {
      const bin = allBins.find((b) => b.id === binId);
      if (!bin) continue;

      const newX = bin.x + delta.x;
      const newY = bin.y + delta.y;

      const left = calcLeft(newX);
      const top = calcTop(newY, bin.depth);
      const rectWidth = calcPixelWidth(newX, bin.width);
      const rectHeight = calcPixelHeight(newY, bin.depth);

      ghosts.push(
        <div
          key={`${keyPrefix}-${binId}`}
          className="animate-in fade-in duration-150"
          style={{
            position: 'absolute',
            left,
            top,
            width: rectWidth,
            height: rectHeight,
            border: `2px solid ${color}`,
            borderRadius: 4,
            background: `linear-gradient(135deg, ${color}28, ${color}10)`,
            boxShadow: `0 4px 12px rgba(0, 0, 0, 0.15), 0 0 0 2px ${color}40, 0 0 14px ${color}30`,
            pointerEvents: 'none',
            willChange: 'opacity, transform',
            transform: 'translateZ(0)',
          }}
          aria-hidden="true"
        />
      );
    }

    return ghosts;
  };

  // Render ghosts for a resizing interaction
  const renderResizingGhosts = (
    keyPrefix: string,
    interaction: Extract<InteractionHint, { type: 'resizing' }>,
    color: string,
    allBins: Bin[]
  ) => {
    const { binIds, handle } = interaction;
    const ghosts: React.ReactNode[] = [];

    for (const binId of binIds) {
      const bin = allBins.find((b) => b.id === binId);
      if (!bin) continue;

      // Show the original bin outline with a visual indicator of the resize direction
      const left = calcLeft(bin.x);
      const top = calcTop(bin.y, bin.depth);
      const rectWidth = calcPixelWidth(bin.x, bin.width);
      const rectHeight = calcPixelHeight(bin.y, bin.depth);

      // Add directional arrows or indicator based on handle
      const handleIndicator = getHandleIndicator(handle);

      ghosts.push(
        <div
          key={`${keyPrefix}-${binId}`}
          className="animate-in fade-in duration-150"
          style={{
            position: 'absolute',
            left,
            top,
            width: rectWidth,
            height: rectHeight,
            border: `2px dashed ${color}`,
            borderRadius: 4,
            background: `linear-gradient(135deg, ${color}20, ${color}08)`,
            boxShadow: `0 2px 8px rgba(0, 0, 0, 0.12), 0 0 0 1px ${color}30, 0 0 10px ${color}25`,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            willChange: 'opacity, transform',
          }}
          aria-hidden="true"
        >
          <span
            className="animate-pulse"
            style={{
              fontSize: 18,
              color,
              opacity: 0.9,
              fontWeight: 'bold',
              textShadow: `0 0 4px rgba(0,0,0,0.5), 0 0 8px ${color}`,
            }}
          >
            {handleIndicator}
          </span>
        </div>
      );
    }

    return ghosts;
  };

  const ghostElements: React.ReactNode[] = [];

  for (const { connectionId, presence } of usersWithInteractions) {
    const { interaction, color } = presence;
    if (!interaction || interaction.type === 'idle') continue;

    const keyPrefix = `ghost-${connectionId}`;

    if (interaction.type === 'drawing' || interaction.type === 'selecting') {
      ghostElements.push(
        renderDrawingGhost(`${keyPrefix}-draw`, interaction, color)
      );
    } else if (interaction.type === 'dragging') {
      ghostElements.push(...renderDraggingGhosts(keyPrefix, interaction, color, bins));
    } else if (interaction.type === 'resizing') {
      ghostElements.push(...renderResizingGhosts(keyPrefix, interaction, color, bins));
    }
  }

  return (
    <div
      className={`absolute inset-0 pointer-events-none z-[35] overflow-hidden ${className ?? ''}`}
      aria-hidden="true"
    >
      {ghostElements}
    </div>
  );
}

/**
 * Get a visual indicator character for resize direction.
 */
function getHandleIndicator(handle: string): string {
  switch (handle) {
    case 'n':
      return '\u2195'; // ↕
    case 's':
      return '\u2195'; // ↕
    case 'e':
      return '\u2194'; // ↔
    case 'w':
      return '\u2194'; // ↔
    case 'ne':
    case 'sw':
      return '\u2922'; // ⤢
    case 'nw':
    case 'se':
      return '\u2921'; // ⤡
    default:
      return '\u21F2'; // ⇲
  }
}

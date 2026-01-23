/**
 * 2D floor plan view for insert positioning.
 *
 * Shows a top-down SVG of the bin interior with draggable insert shapes.
 * Inserts can be selected (click) and repositioned (drag).
 */

import { useState, useCallback, useRef } from 'react';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { useShallow } from 'zustand/react/shallow';
import { GRIDFINITY, STYLE_WALL_THICKNESS } from '@/features/bin-designer/constants/gridfinity';
import type { Insert, BinStyle } from '@/features/bin-designer/types';

/** Compute the inner floor dimensions in mm */
function getInnerDimensions(widthUnits: number, depthUnits: number, style: BinStyle) {
  const wallThickness = STYLE_WALL_THICKNESS[style] ?? GRIDFINITY.WALL_THICKNESS;
  const outerWidth = widthUnits * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE;
  const outerDepth = depthUnits * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE;
  return {
    innerWidth: outerWidth - 2 * wallThickness,
    innerDepth: outerDepth - 2 * wallThickness,
    wallThickness,
  };
}

/** SVG padding in px around the floor plan */
const PADDING = 8;

/** Colors for insert shapes */
const SHAPE_FILL = 'rgba(99, 102, 241, 0.2)';
const SHAPE_STROKE = 'rgba(99, 102, 241, 0.6)';
const SELECTED_FILL = 'rgba(99, 102, 241, 0.35)';
const SELECTED_STROKE = 'rgba(99, 102, 241, 1)';

interface DragState {
  insertId: string;
  startX: number;
  startY: number;
  origX: number;
  origY: number;
}

export function InsertFloorPlan() {
  const { width, depth, style, inserts, updateInsert } = useDesignerStore(
    useShallow((s) => ({
      width: s.params.width,
      depth: s.params.depth,
      style: s.params.style,
      inserts: s.params.inserts,
      updateInsert: s.updateInsert,
    }))
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dragOffset, setDragOffset] = useState({ dx: 0, dy: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  const { innerWidth, innerDepth } = getInnerDimensions(width, depth, style);

  // Scale factor: fit the floor plan into ~240px wide area
  const maxDisplayWidth = 240;
  const scale = Math.min(maxDisplayWidth / innerWidth, maxDisplayWidth / innerDepth);
  const svgWidth = innerWidth * scale + 2 * PADDING;
  const svgHeight = innerDepth * scale + 2 * PADDING;

  const fromSvgDelta = useCallback(
    (dxPx: number, dyPx: number) => ({
      dx: dxPx / scale,
      dy: -dyPx / scale, // Flip Y
    }),
    [scale]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, insert: Insert) => {
      e.preventDefault();
      e.stopPropagation();
      setSelectedId(insert.id);
      setDragState({
        insertId: insert.id,
        startX: e.clientX,
        startY: e.clientY,
        origX: insert.x,
        origY: insert.y,
      });
      setDragOffset({ dx: 0, dy: 0 });
    },
    []
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragState) return;
      const dxPx = e.clientX - dragState.startX;
      const dyPx = e.clientY - dragState.startY;
      const mm = fromSvgDelta(dxPx, dyPx);
      setDragOffset({ dx: mm.dx, dy: mm.dy });
    },
    [dragState, fromSvgDelta]
  );

  const handleMouseUp = useCallback(() => {
    if (!dragState) return;
    const newX = Math.max(0, dragState.origX + dragOffset.dx);
    const newY = Math.max(0, dragState.origY + dragOffset.dy);
    // Clamp to interior bounds
    const insert = inserts.find((i) => i.id === dragState.insertId);
    if (insert) {
      const clampedX = Math.min(newX, Math.max(0, innerWidth - insert.width));
      const clampedY = Math.min(newY, Math.max(0, innerDepth - insert.depth));
      updateInsert(dragState.insertId, {
        x: Math.round(clampedX * 10) / 10, // Round to 0.1mm
        y: Math.round(clampedY * 10) / 10,
      });
    }
    setDragState(null);
    setDragOffset({ dx: 0, dy: 0 });
  }, [dragState, dragOffset, inserts, innerWidth, innerDepth, updateInsert]);

  const handleBackgroundClick = useCallback(() => {
    setSelectedId(null);
  }, []);

  if (inserts.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <span className="text-xs font-medium text-content-secondary">Floor Plan</span>
      <svg
        ref={svgRef}
        width={svgWidth}
        height={svgHeight}
        className="rounded-md border border-stroke-subtle bg-surface-tertiary"
        aria-label="Insert floor plan"
        role="img"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleBackgroundClick}
      >
        {/* Bin floor background */}
        <rect
          x={PADDING}
          y={PADDING}
          width={innerWidth * scale}
          height={innerDepth * scale}
          fill="rgba(30, 30, 40, 0.3)"
          stroke="rgba(100, 100, 120, 0.4)"
          strokeWidth={1}
          rx={2}
        />

        {/* Insert shapes */}
        {inserts.map((insert) => {
          const isDragging = dragState?.insertId === insert.id;
          const effectiveX = isDragging ? insert.x + dragOffset.dx : insert.x;
          const effectiveY = isDragging ? insert.y + dragOffset.dy : insert.y;
          const isSelected = selectedId === insert.id;

          return (
            <InsertShape
              key={insert.id}
              insert={insert}
              x={effectiveX}
              y={effectiveY}
              scale={scale}
              innerDepth={innerDepth}
              isSelected={isSelected}
              onMouseDown={(e) => handleMouseDown(e, insert)}
            />
          );
        })}
      </svg>
      {selectedId && (
        <p className="text-[10px] text-content-tertiary">
          Drag to reposition. Click background to deselect.
        </p>
      )}
    </div>
  );
}

function InsertShape({
  insert,
  x,
  y,
  scale,
  innerDepth,
  isSelected,
  onMouseDown,
}: {
  insert: Insert;
  x: number;
  y: number;
  scale: number;
  innerDepth: number;
  isSelected: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
}) {
  const fill = isSelected ? SELECTED_FILL : SHAPE_FILL;
  const stroke = isSelected ? SELECTED_STROKE : SHAPE_STROKE;

  // Convert mm position to SVG coords (Y flipped)
  const svgX = PADDING + x * scale;
  const svgY = PADDING + (innerDepth - y - insert.depth) * scale;
  const w = insert.width * scale;
  const h = insert.depth * scale;

  const sharedProps = {
    fill,
    stroke,
    strokeWidth: isSelected ? 2 : 1,
    onMouseDown,
    style: { cursor: 'move' } as React.CSSProperties,
    'aria-label': insert.label || `${insert.shape} insert`,
  };

  switch (insert.shape) {
    case 'circle':
      return (
        <ellipse
          cx={svgX + w / 2}
          cy={svgY + h / 2}
          rx={w / 2}
          ry={h / 2}
          {...sharedProps}
        />
      );
    case 'hexagon': {
      const cx = svgX + w / 2;
      const cy = svgY + h / 2;
      const r = Math.min(w, h) / 2;
      const points = Array.from({ length: 6 }, (_, i) => {
        const angle = (i * 60 - 90) * (Math.PI / 180);
        return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
      }).join(' ');
      return <polygon points={points} {...sharedProps} />;
    }
    case 'rounded-rect': {
      const rx = Math.min(insert.cornerRadius * scale, w / 2, h / 2);
      return (
        <rect
          x={svgX}
          y={svgY}
          width={w}
          height={h}
          rx={rx}
          ry={rx}
          {...sharedProps}
        />
      );
    }
    default: // rectangle, slot
      return (
        <rect
          x={svgX}
          y={svgY}
          width={w}
          height={h}
          {...sharedProps}
        />
      );
  }
}

/**
 * 2D floor plan view for insert positioning.
 *
 * Shows a top-down SVG of the bin interior with draggable insert shapes.
 * Supports multi-select (Shift+click, drag-box), rotation (R key),
 * copy/paste (Ctrl+C/V), delete, and smart snapping.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { useShallow } from 'zustand/react/shallow';
import { GRIDFINITY, STYLE_WALL_THICKNESS } from '@/features/bin-designer/constants/gridfinity';
import type { Insert, BinStyle } from '@/features/bin-designer/types';

/**
 * Compute the usable inner floor dimensions and wall thickness for a bin style.
 *
 * @param widthUnits - Floor width measured in grid units
 * @param depthUnits - Floor depth measured in grid units
 * @param style - Bin style used to determine wall thickness (falls back to default if unspecified)
 * @returns An object with `innerWidth` and `innerDepth` in millimeters and the applied `wallThickness` in millimeters
 */
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

/** Snap threshold in mm */
const SNAP_THRESHOLD = 2;

/** Copy offset in mm */
const PASTE_OFFSET = 3;

/** Colors for insert shapes */
const SHAPE_FILL = 'rgba(99, 102, 241, 0.2)';
const SHAPE_STROKE = 'rgba(99, 102, 241, 0.6)';
const SELECTED_FILL = 'rgba(99, 102, 241, 0.35)';
const SELECTED_STROKE = 'rgba(99, 102, 241, 1)';
const GUIDE_STROKE = 'rgba(251, 191, 36, 0.8)';
const SELECTION_BOX_FILL = 'rgba(99, 102, 241, 0.08)';
const SELECTION_BOX_STROKE = 'rgba(99, 102, 241, 0.5)';

interface DragState {
  insertIds: string[];
  startX: number;
  startY: number;
  origPositions: Map<string, { x: number; y: number }>;
}

interface SelectionBox {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

interface SnapGuide {
  orientation: 'horizontal' | 'vertical';
  position: number; // in mm
}

/** Get effective dimensions considering rotation */
export function getRotatedDimensions(insert: Insert): { width: number; depth: number } {
  if (insert.rotation === 90 || insert.rotation === 270) {
    return { width: insert.depth, depth: insert.width };
  }
  return { width: insert.width, depth: insert.depth };
}

/** Compute snap guides for a dragging set of inserts relative to others */
export function computeSnapGuides(
  dragInserts: Insert[],
  otherInserts: Insert[],
  offset: { dx: number; dy: number },
  threshold: number
): { guides: SnapGuide[]; snapDx: number; snapDy: number } {
  const guides: SnapGuide[] = [];
  let snapDx = 0;
  let snapDy = 0;

  // Collect edges and centers of other inserts
  const hTargets: number[] = []; // Y values
  const vTargets: number[] = []; // X values

  for (const other of otherInserts) {
    const dims = getRotatedDimensions(other);
    vTargets.push(other.x, other.x + dims.width, other.x + dims.width / 2);
    hTargets.push(other.y, other.y + dims.depth, other.y + dims.depth / 2);
  }

  // Check each dragging insert's edges/center against targets
  let bestDxDist = Infinity;
  let bestDyDist = Infinity;

  for (const insert of dragInserts) {
    const dims = getRotatedDimensions(insert);
    const ex = insert.x + offset.dx;
    const ey = insert.y + offset.dy;

    const xEdges = [ex, ex + dims.width, ex + dims.width / 2];
    const yEdges = [ey, ey + dims.depth, ey + dims.depth / 2];

    for (const xe of xEdges) {
      for (const target of vTargets) {
        const dist = Math.abs(xe - target);
        if (dist < threshold && dist < bestDxDist) {
          bestDxDist = dist;
          snapDx = target - xe;
        }
      }
    }

    for (const ye of yEdges) {
      for (const target of hTargets) {
        const dist = Math.abs(ye - target);
        if (dist < threshold && dist < bestDyDist) {
          bestDyDist = dist;
          snapDy = target - ye;
        }
      }
    }
  }

  // Generate visible guide lines for snapped positions
  if (bestDxDist < threshold) {
    for (const insert of dragInserts) {
      const dims = getRotatedDimensions(insert);
      const ex = insert.x + offset.dx + snapDx;
      const xEdges = [ex, ex + dims.width, ex + dims.width / 2];
      for (const xe of xEdges) {
        if (vTargets.some((t) => Math.abs(t - xe) < 0.01)) {
          guides.push({ orientation: 'vertical', position: xe });
        }
      }
    }
  }

  if (bestDyDist < threshold) {
    for (const insert of dragInserts) {
      const dims = getRotatedDimensions(insert);
      const ey = insert.y + offset.dy + snapDy;
      const yEdges = [ey, ey + dims.depth, ey + dims.depth / 2];
      for (const ye of yEdges) {
        if (hTargets.some((t) => Math.abs(t - ye) < 0.01)) {
          guides.push({ orientation: 'horizontal', position: ye });
        }
      }
    }
  }

  return { guides, snapDx, snapDy };
}

/**
 * Renders an interactive SVG floor plan for bin inserts and lets the user select and reposition inserts.
 *
 * The component displays the interior floor area scaled to fit, shows each insert as a shape, and allows
 * click-to-select and click-and-drag to move an insert. Drag movements are converted from screen pixels
 * to millimeters, clamped to the interior bounds, rounded to 0.1 mm, and persisted via the designer store.
 *
 * @returns The floor plan JSX element, or `null` when there are no inserts to display.
 */
export function InsertFloorPlan() {
  const { width, depth, style, inserts, updateInsert, addInsert, removeInsert } = useDesignerStore(
    useShallow((s) => ({
      width: s.params.width,
      depth: s.params.depth,
      style: s.params.style,
      inserts: s.params.inserts,
      updateInsert: s.updateInsert,
      addInsert: s.addInsert,
      removeInsert: s.removeInsert,
    }))
  );

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dragOffset, setDragOffset] = useState({ dx: 0, dy: 0 });
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);
  const [clipboard, setClipboard] = useState<Insert[]>([]);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { innerWidth, innerDepth } = getInnerDimensions(width, depth, style);

  // Scale factor: fit the floor plan into ~240px wide area
  const maxDisplayWidth = 240;
  const scale = (innerWidth > 0 && innerDepth > 0)
    ? Math.min(maxDisplayWidth / innerWidth, maxDisplayWidth / innerDepth)
    : 1;
  const svgWidth = innerWidth * scale + 2 * PADDING;
  const svgHeight = innerDepth * scale + 2 * PADDING;

  const fromSvgDelta = useCallback(
    (dxPx: number, dyPx: number) => ({
      dx: dxPx / scale,
      dy: -dyPx / scale, // Flip Y
    }),
    [scale]
  );

  /** Convert SVG pixel position to mm coordinates */
  const fromSvgPosition = useCallback(
    (pxX: number, pxY: number) => ({
      x: (pxX - PADDING) / scale,
      y: innerDepth - (pxY - PADDING) / scale,
    }),
    [scale, innerDepth]
  );

  // -- Multi-select handlers --

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, insert: Insert) => {
      e.preventDefault();
      e.stopPropagation();

      let newSelection: Set<string>;
      if (e.shiftKey) {
        // Toggle selection
        newSelection = new Set(selectedIds);
        if (newSelection.has(insert.id)) {
          newSelection.delete(insert.id);
        } else {
          newSelection.add(insert.id);
        }
      } else if (!selectedIds.has(insert.id)) {
        // New single selection
        newSelection = new Set([insert.id]);
      } else {
        // Already selected — start drag of current selection
        newSelection = selectedIds;
      }
      setSelectedIds(newSelection);

      // Start drag for all selected inserts
      const idsToMove = Array.from(newSelection);
      const origPositions = new Map<string, { x: number; y: number }>();
      for (const id of idsToMove) {
        const i = inserts.find((ins) => ins.id === id);
        if (i) origPositions.set(id, { x: i.x, y: i.y });
      }

      setDragState({
        insertIds: idsToMove,
        startX: e.clientX,
        startY: e.clientY,
        origPositions,
      });
      setDragOffset({ dx: 0, dy: 0 });
      setSnapGuides([]);
    },
    [selectedIds, inserts]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (selectionBox) {
        // Update selection box
        const rect = svgRef.current?.getBoundingClientRect();
        if (!rect) return;
        setSelectionBox((prev) =>
          prev ? { ...prev, currentX: e.clientX - rect.left, currentY: e.clientY - rect.top } : null
        );
        return;
      }
      if (!dragState) return;
      const dxPx = e.clientX - dragState.startX;
      const dyPx = e.clientY - dragState.startY;
      const mm = fromSvgDelta(dxPx, dyPx);

      // Compute snapping
      const dragInserts = inserts.filter((i) => dragState.insertIds.includes(i.id));
      const otherInserts = inserts.filter((i) => !dragState.insertIds.includes(i.id));
      const { guides, snapDx, snapDy } = computeSnapGuides(dragInserts, otherInserts, mm, SNAP_THRESHOLD);

      setDragOffset({ dx: mm.dx + snapDx, dy: mm.dy + snapDy });
      setSnapGuides(guides);
    },
    [dragState, selectionBox, fromSvgDelta, inserts]
  );

  const handleMouseUp = useCallback(() => {
    // Handle selection box completion
    if (selectionBox) {
      const rect = svgRef.current?.getBoundingClientRect();
      if (rect) {
        const x1 = Math.min(selectionBox.startX, selectionBox.currentX);
        const y1 = Math.min(selectionBox.startY, selectionBox.currentY);
        const x2 = Math.max(selectionBox.startX, selectionBox.currentX);
        const y2 = Math.max(selectionBox.startY, selectionBox.currentY);

        const topLeft = fromSvgPosition(x1, y1);
        const bottomRight = fromSvgPosition(x2, y2);
        // Note: fromSvgPosition flips Y, so topLeft.y > bottomRight.y
        const minX = topLeft.x;
        const maxX = bottomRight.x;
        const minY = bottomRight.y;
        const maxY = topLeft.y;

        const boxSelected = inserts.filter((insert) => {
          const dims = getRotatedDimensions(insert);
          const cx = insert.x + dims.width / 2;
          const cy = insert.y + dims.depth / 2;
          return cx >= minX && cx <= maxX && cy >= minY && cy <= maxY;
        });

        setSelectedIds(new Set(boxSelected.map((i) => i.id)));
      }
      setSelectionBox(null);
      return;
    }

    if (!dragState) return;

    // Apply position updates
    for (const id of dragState.insertIds) {
      const orig = dragState.origPositions.get(id);
      const insert = inserts.find((i) => i.id === id);
      if (!orig || !insert) continue;

      const dims = getRotatedDimensions(insert);
      const newX = Math.max(0, Math.min(orig.x + dragOffset.dx, innerWidth - dims.width));
      const newY = Math.max(0, Math.min(orig.y + dragOffset.dy, innerDepth - dims.depth));

      updateInsert(id, {
        x: Math.round(newX * 10) / 10,
        y: Math.round(newY * 10) / 10,
      });
    }

    setDragState(null);
    setDragOffset({ dx: 0, dy: 0 });
    setSnapGuides([]);
  }, [dragState, dragOffset, selectionBox, inserts, innerWidth, innerDepth, updateInsert, fromSvgPosition]);

  const handleBackgroundMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Start drag-box selection on background
      if (e.target === svgRef.current || (e.target as Element).getAttribute('data-floor') === 'true') {
        const rect = svgRef.current?.getBoundingClientRect();
        if (!rect) return;
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        if (!e.shiftKey) {
          setSelectedIds(new Set());
        }
        setSelectionBox({ startX: x, startY: y, currentX: x, currentY: y });
      }
    },
    []
  );

  // -- Keyboard handlers --

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (selectedIds.size === 0 && !(e.ctrlKey && e.key === 'v') && !(e.ctrlKey && e.key === 'a')) return;

      switch (e.key) {
        case 'Delete':
        case 'Backspace': {
          e.preventDefault();
          for (const id of selectedIds) {
            removeInsert(id);
          }
          setSelectedIds(new Set());
          break;
        }
        case 'r':
        case 'R': {
          if (e.ctrlKey || e.metaKey) return; // Don't intercept browser refresh
          e.preventDefault();
          const nextRotation = (r: 0 | 90 | 180 | 270): 0 | 90 | 180 | 270 => {
            const rotations: (0 | 90 | 180 | 270)[] = [0, 90, 180, 270];
            const dir = e.shiftKey ? -1 : 1;
            const idx = rotations.indexOf(r);
            return rotations[(idx + dir + 4) % 4];
          };
          for (const id of selectedIds) {
            const insert = inserts.find((i) => i.id === id);
            if (insert) {
              updateInsert(id, { rotation: nextRotation(insert.rotation) });
            }
          }
          break;
        }
        case 'a': {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            setSelectedIds(new Set(inserts.map((i) => i.id)));
          }
          break;
        }
        case 'c': {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const copied = inserts.filter((i) => selectedIds.has(i.id));
            setClipboard(copied);
          }
          break;
        }
        case 'v': {
          if ((e.ctrlKey || e.metaKey) && clipboard.length > 0) {
            e.preventDefault();
            const newIds: string[] = [];
            for (const insert of clipboard) {
              const dims = getRotatedDimensions(insert);
              const newId = crypto.randomUUID();
              const pastedX = Math.min(insert.x + PASTE_OFFSET, Math.max(0, innerWidth - dims.width));
              const pastedY = Math.min(insert.y + PASTE_OFFSET, Math.max(0, innerDepth - dims.depth));
              addInsert({
                ...insert,
                id: newId,
                x: Math.round(pastedX * 10) / 10,
                y: Math.round(pastedY * 10) / 10,
              });
              newIds.push(newId);
            }
            setSelectedIds(new Set(newIds));
            // Shift clipboard offset for subsequent pastes
            setClipboard(
              clipboard.map((i) => ({
                ...i,
                x: i.x + PASTE_OFFSET,
                y: i.y + PASTE_OFFSET,
              }))
            );
          }
          break;
        }
      }
    },
    [selectedIds, inserts, clipboard, innerWidth, innerDepth, removeInsert, updateInsert, addInsert]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('keydown', handleKeyDown as unknown as EventListener);
    return () => {
      container.removeEventListener('keydown', handleKeyDown as unknown as EventListener);
    };
  }, [handleKeyDown]);

  // Clear selection when inserts change externally (e.g., undo)
  useEffect(() => {
    setSelectedIds((prev) => {
      const validIds = new Set(inserts.map((i) => i.id));
      const filtered = new Set([...prev].filter((id) => validIds.has(id)));
      return filtered.size === prev.size ? prev : filtered;
    });
  }, [inserts]);

  if (inserts.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="space-y-1.5"
      tabIndex={0}
      role="application"
      aria-label="Insert floor plan editor"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-content-secondary">Floor Plan</span>
        {selectedIds.size > 0 && (
          <span className="text-[10px] text-content-tertiary">
            {selectedIds.size} selected
          </span>
        )}
      </div>
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
        onMouseDown={handleBackgroundMouseDown}
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
          data-floor="true"
        />

        {/* Snap guide lines */}
        {snapGuides.map((guide, idx) =>
          guide.orientation === 'vertical' ? (
            <line
              key={`guide-${idx}`}
              x1={PADDING + guide.position * scale}
              y1={PADDING}
              x2={PADDING + guide.position * scale}
              y2={PADDING + innerDepth * scale}
              stroke={GUIDE_STROKE}
              strokeWidth={1}
              strokeDasharray="3 2"
              pointerEvents="none"
            />
          ) : (
            <line
              key={`guide-${idx}`}
              x1={PADDING}
              y1={PADDING + (innerDepth - guide.position) * scale}
              x2={PADDING + innerWidth * scale}
              y2={PADDING + (innerDepth - guide.position) * scale}
              stroke={GUIDE_STROKE}
              strokeWidth={1}
              strokeDasharray="3 2"
              pointerEvents="none"
            />
          )
        )}

        {/* Insert shapes */}
        {inserts.map((insert) => {
          const isDragging = dragState?.insertIds.includes(insert.id) ?? false;
          const orig = isDragging ? dragState?.origPositions.get(insert.id) : undefined;
          const effectiveX = isDragging && orig ? orig.x + dragOffset.dx : insert.x;
          const effectiveY = isDragging && orig ? orig.y + dragOffset.dy : insert.y;
          const isSelected = selectedIds.has(insert.id);

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

        {/* Drag-box selection */}
        {selectionBox && (
          <rect
            x={Math.min(selectionBox.startX, selectionBox.currentX)}
            y={Math.min(selectionBox.startY, selectionBox.currentY)}
            width={Math.abs(selectionBox.currentX - selectionBox.startX)}
            height={Math.abs(selectionBox.currentY - selectionBox.startY)}
            fill={SELECTION_BOX_FILL}
            stroke={SELECTION_BOX_STROKE}
            strokeWidth={1}
            strokeDasharray="4 2"
            pointerEvents="none"
          />
        )}
      </svg>
      <p className="text-[10px] text-content-tertiary">
        {selectedIds.size > 0
          ? 'Drag to move. R: rotate. Del: remove. Ctrl+C/V: copy/paste.'
          : 'Click to select. Shift+click for multi-select. Drag background for box select.'}
      </p>
    </div>
  );
}

/**
 * Render an SVG shape for a floor-plan insert at the given position and scale.
 *
 * The rendered shape is chosen from `insert.shape` and positioned using `x`/`y`
 * in millimeters; `innerDepth` is used to convert the floor-plan Y coordinate
 * to SVG coordinates. Selection state modifies fill/stroke and stroke width.
 *
 * @param insert - Insert metadata (uses `width`, `depth`, `shape`, optional `cornerRadius` and `label`)
 * @param x - Insert X position in millimeters from the interior left edge
 * @param y - Insert Y position in millimeters from the interior bottom edge
 * @param scale - Scale factor converting millimeters to SVG units (pixels)
 * @param innerDepth - Inner floor depth in millimeters used to flip Y into SVG space
 * @param isSelected - If true, render selected visual styling
 * @param onMouseDown - Mouse-down handler attached to the rendered SVG shape
 * @returns An SVG element (`<rect>`, `<ellipse>`, or `<polygon>`) representing the insert
 */
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

  // Get rotated dimensions for positioning
  const dims = getRotatedDimensions(insert);

  // Convert mm position to SVG coords (Y flipped)
  const svgX = PADDING + x * scale;
  const svgY = PADDING + (innerDepth - y - dims.depth) * scale;
  const w = dims.width * scale;
  const h = dims.depth * scale;

  // Center point for rotation transform
  const cx = svgX + w / 2;
  const cy = svgY + h / 2;

  // For rotation, we render the original shape and apply SVG transform
  const origW = insert.width * scale;
  const origH = insert.depth * scale;
  const rotation = insert.rotation;

  const sharedProps = {
    fill,
    stroke,
    strokeWidth: isSelected ? 2 : 1,
    onMouseDown,
    style: { cursor: 'move' } as React.CSSProperties,
    'aria-label': `${insert.label || insert.shape} insert${rotation ? ` rotated ${rotation} degrees` : ''}`,
  };

  // Apply rotation as SVG transform around the shape center
  const transform = rotation ? `rotate(${rotation}, ${cx}, ${cy})` : undefined;

  // When rotated, we render with original dimensions but offset so center stays the same
  const renderX = rotation ? cx - origW / 2 : svgX;
  const renderY = rotation ? cy - origH / 2 : svgY;
  const renderW = rotation ? origW : w;
  const renderH = rotation ? origH : h;

  switch (insert.shape) {
    case 'circle': {
      // Circle uses min(width, depth) as diameter (matches 3D generator)
      const diameter = Math.min(renderW, renderH);
      return (
        <ellipse
          cx={cx}
          cy={cy}
          rx={diameter / 2}
          ry={diameter / 2}
          transform={transform}
          {...sharedProps}
        />
      );
    }
    case 'hexagon': {
      const r = Math.min(renderW, renderH) / 2;
      const points = Array.from({ length: 6 }, (_, i) => {
        const angle = (i * 60 - 90) * (Math.PI / 180);
        return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
      }).join(' ');
      return <polygon points={points} transform={transform} {...sharedProps} />;
    }
    case 'rounded-rect': {
      const rx = Math.min(insert.cornerRadius * scale, renderW / 2, renderH / 2);
      return (
        <rect
          x={renderX}
          y={renderY}
          width={renderW}
          height={renderH}
          rx={rx}
          ry={rx}
          transform={transform}
          {...sharedProps}
        />
      );
    }
    default: // rectangle, slot
      return (
        <rect
          x={renderX}
          y={renderY}
          width={renderW}
          height={renderH}
          transform={transform}
          {...sharedProps}
        />
      );
  }
}
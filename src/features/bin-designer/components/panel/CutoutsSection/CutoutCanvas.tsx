/**
 * Pure SVG canvas for rendering cutout shapes.
 *
 * Receives all data and callbacks as props — no store access.
 * Used by both the sidebar CutoutEditor and the full CutoutWorkspace.
 */

import { useMemo } from 'react';
import type { Cutout, CutoutShape as CutoutShapeType } from '@/features/bin-designer/types';
import type { ResizeHandle, InteractionMode, PreviewMap } from './useCutoutInteraction';
import type { AlignmentGuide } from './geometry';
import { getResizeCursor, computeBounds } from './geometry';
import { EditorBackground } from './EditorBackground';
import { CutoutShape } from './CutoutShape';
import { CutoutResizeHandles } from './CutoutResizeHandles';
import { RotationHandle } from './RotationHandle';
import { SmartGuides } from './SmartGuides';
import { DimensionTooltip } from './DimensionTooltip';
import { MarqueeBox } from './MarqueeBox';

interface DrawingPreview {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly depth: number;
  readonly shape: CutoutShapeType;
}

export interface CutoutCanvasProps {
  readonly cutouts: readonly Cutout[];
  readonly binWidth: number;
  readonly binDepth: number;
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly scale: number;
  readonly viewBox?: string;
  readonly selection: ReadonlySet<string>;
  readonly preview: PreviewMap;
  readonly mode: InteractionMode;
  readonly drawingPreview: DrawingPreview | null;
  readonly activeGuides: readonly AlignmentGuide[];
  readonly marquee: { x: number; y: number; w: number; h: number } | null;
  // Canvas event handlers
  readonly onCanvasPointerDown: (e: React.PointerEvent<SVGSVGElement>) => void;
  readonly onCanvasPointerMove: (e: React.PointerEvent<SVGSVGElement>) => void;
  readonly onCanvasPointerUp: () => void;
  readonly onContextMenu: (e: React.MouseEvent<SVGSVGElement>) => void;
  readonly svgRef: React.RefObject<SVGSVGElement | null>;
  // Shape interaction callbacks
  readonly onSelectCutout: (id: string, additive: boolean) => void;
  readonly onDoubleClickCutout: (id: string) => void;
  readonly onDragStart?: (id: string, mmX: number, mmY: number) => void;
  readonly onResizeStart: (id: string, handle: ResizeHandle, mmX: number, mmY: number) => void;
  readonly onRotateStart: (id: string, startAngle: number) => void;
  readonly onGroupRotateStart: (startAngle: number) => void;
  readonly onGroupScaleStart: (mmX: number, mmY: number) => void;
}

export function CutoutCanvas({
  cutouts,
  binWidth,
  binDepth,
  canvasWidth,
  canvasHeight,
  scale,
  viewBox,
  selection,
  preview,
  mode,
  drawingPreview,
  activeGuides,
  marquee,
  onCanvasPointerDown,
  onCanvasPointerMove,
  onCanvasPointerUp,
  onContextMenu,
  svgRef,
  onSelectCutout,
  onDoubleClickCutout,
  onDragStart,
  onResizeStart,
  onRotateStart,
  onGroupRotateStart,
  onGroupScaleStart,
}: CutoutCanvasProps) {
  const isDragging = mode.type === 'dragging';
  const isResizing = mode.type === 'resizing';
  const isInteracting =
    isDragging ||
    isResizing ||
    mode.type === 'rotating' ||
    mode.type === 'group-rotating' ||
    mode.type === 'group-scaling';

  // Memoize dragStart ref so CutoutShape (React.memo) doesn't re-render on mode changes
  const memoizedDragStart = useMemo(
    () => (mode.type === 'idle' ? onDragStart : undefined),
    [mode.type, onDragStart]
  );

  const selectedCutout =
    selection.size === 1 ? (cutouts.find((c) => selection.has(c.id)) ?? null) : null;

  // Compute tooltip info from mode and preview
  const tooltipInfo = useMemo(() => {
    if (mode.type === 'dragging' && preview.size > 0) {
      const [firstId, firstUpdates] = [...preview.entries()][0];
      const orig = cutouts.find((c) => c.id === firstId);
      if (!orig) return null;
      const effective = { ...orig, ...firstUpdates };
      const x = effective.x;
      const y = effective.y;
      const svgX = x * scale + 10;
      const svgY = (binDepth - y) * scale - 10;
      return { type: 'drag' as const, x, y, svgX, svgY };
    }
    if (mode.type === 'resizing' && preview.size > 0) {
      const [id, updates] = [...preview.entries()][0];
      const orig = cutouts.find((c) => c.id === id);
      if (!orig) return null;
      const effective = { ...orig, ...updates };
      const width = effective.width;
      const depth = effective.depth;
      const x = effective.x;
      const y = effective.y;
      const svgX = (x + width) * scale + 5;
      const svgY = (binDepth - y - depth) * scale;
      return { type: 'resize' as const, width, depth, svgX, svgY };
    }
    return null;
  }, [mode, preview, cutouts, scale, binDepth]);

  // Group bounding box for multi-selection handles
  const groupBoundsCutout = useMemo(() => {
    if (selection.size < 2 || isDragging || isResizing || mode.type === 'rotating') return null;
    const selectedCutouts = cutouts.filter((c) => selection.has(c.id));
    if (selectedCutouts.length < 2) return null;
    const bounds = computeBounds(selectedCutouts);
    return {
      id: '__group__' as const,
      shape: 'rectangle' as const,
      x: bounds.minX,
      y: bounds.minY,
      width: bounds.maxX - bounds.minX,
      depth: bounds.maxY - bounds.minY,
      cutDepth: 0,
      rotation: 0,
      cornerRadius: 0,
      label: '',
      groupId: null,
    };
  }, [selection, cutouts, isDragging, isResizing, mode.type]);

  // Derive cursor class based on current mode
  const getCursorClass = (): string => {
    if (mode.type === 'placing' || mode.type === 'drawing') return 'cursor-crosshair';
    if (mode.type === 'dragging') return 'cursor-grabbing';
    if (mode.type === 'resizing') return '';
    return 'cursor-default';
  };

  const getCursorStyle = (): React.CSSProperties | undefined => {
    if (mode.type === 'resizing') {
      return { cursor: getResizeCursor(mode.handle) };
    }
    return undefined;
  };

  const resolvedViewBox = viewBox ?? `0 0 ${canvasWidth} ${canvasHeight}`;

  return (
    <svg
      ref={svgRef}
      width={canvasWidth}
      height={canvasHeight}
      viewBox={resolvedViewBox}
      className={`block select-none ${getCursorClass()}`}
      style={getCursorStyle()}
      onPointerDown={onCanvasPointerDown}
      onPointerMove={onCanvasPointerMove}
      onPointerUp={onCanvasPointerUp}
      onContextMenu={onContextMenu}
    >
      {/* Background grid and crosshair */}
      <EditorBackground
        binWidth={binWidth}
        binDepth={binDepth}
        scale={scale}
        canvasWidth={canvasWidth}
        canvasHeight={canvasHeight}
      />

      {/* Cutout shapes */}
      {cutouts.map((cutout) => (
        <CutoutShape
          key={cutout.id}
          cutout={cutout}
          scale={scale}
          binDepth={binDepth}
          isSelected={selection.has(cutout.id)}
          isGrouped={cutout.groupId !== null}
          isDragging={isDragging && selection.has(cutout.id)}
          previewOverrides={preview.get(cutout.id)}
          onSelect={onSelectCutout}
          onDoubleClick={onDoubleClickCutout}
          onDragStart={memoizedDragStart}
        />
      ))}

      {/* Smart guides during drag */}
      {isDragging && (
        <SmartGuides
          guides={activeGuides}
          scale={scale}
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
          binDepth={binDepth}
        />
      )}

      {/* Dimension tooltip during drag or resize */}
      {tooltipInfo && (
        <DimensionTooltip
          type={tooltipInfo.type}
          width={tooltipInfo.type === 'resize' ? tooltipInfo.width : undefined}
          depth={tooltipInfo.type === 'resize' ? tooltipInfo.depth : undefined}
          x={tooltipInfo.type === 'drag' ? tooltipInfo.x : undefined}
          y={tooltipInfo.type === 'drag' ? tooltipInfo.y : undefined}
          svgX={tooltipInfo.svgX}
          svgY={tooltipInfo.svgY}
        />
      )}

      {/* Resize handles on single selected cutout (not during interactions) */}
      {selectedCutout && !isInteracting && (
        <CutoutResizeHandles
          cutout={selectedCutout}
          scale={scale}
          binDepth={binDepth}
          onResizeStart={onResizeStart}
        />
      )}

      {/* Rotation handle for all shapes (not during interactions) */}
      {selectedCutout && !isInteracting && (
        <RotationHandle
          cutout={selectedCutout}
          scale={scale}
          binDepth={binDepth}
          onRotateStart={onRotateStart}
        />
      )}

      {/* Group bounding box + handles for multi-selection */}
      {groupBoundsCutout && (
        <>
          <rect
            x={groupBoundsCutout.x * scale}
            y={(binDepth - groupBoundsCutout.y - groupBoundsCutout.depth) * scale}
            width={groupBoundsCutout.width * scale}
            height={groupBoundsCutout.depth * scale}
            fill="none"
            stroke="#fbbf24"
            strokeWidth={1}
            strokeDasharray="4 2"
            opacity={0.5}
          />
          <CutoutResizeHandles
            cutout={groupBoundsCutout}
            scale={scale}
            binDepth={binDepth}
            onResizeStart={(_id, _handle, mmX, mmY) => {
              onGroupScaleStart(mmX, mmY);
            }}
          />
          <RotationHandle
            cutout={groupBoundsCutout}
            scale={scale}
            binDepth={binDepth}
            onRotateStart={(_id, startAngle) => {
              onGroupRotateStart(startAngle);
            }}
          />
        </>
      )}

      {/* Drawing preview (corner-to-corner) */}
      {drawingPreview && (
        <rect
          x={drawingPreview.x * scale}
          y={(binDepth - drawingPreview.y - drawingPreview.depth) * scale}
          width={drawingPreview.width * scale}
          height={drawingPreview.depth * scale}
          rx={drawingPreview.shape === 'circle' ? (drawingPreview.width * scale) / 2 : 0}
          ry={drawingPreview.shape === 'circle' ? (drawingPreview.depth * scale) / 2 : 0}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={1.5}
          strokeDasharray="4 2"
          opacity={0.6}
        />
      )}

      {/* Marquee selection box */}
      {marquee && Math.abs(marquee.w) + Math.abs(marquee.h) > 5 && (
        <MarqueeBox x={marquee.x} y={marquee.y} width={marquee.w} height={marquee.h} />
      )}
    </svg>
  );
}

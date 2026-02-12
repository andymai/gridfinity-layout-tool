/**
 * WebGL canvas for rendering cutout shapes via Three.js + R3F.
 *
 * Replaces the SVG CutoutCanvas. Receives all data and callbacks as props —
 * no store access. Used by both the sidebar CutoutEditor and the full CutoutWorkspace.
 *
 * World coordinates: mm, Y-up. No SVG Y-inversion needed.
 */

import { useCallback, useEffect, useMemo, useState, type RefObject } from 'react';
import { Canvas } from '@react-three/fiber';
import type { RootState } from '@react-three/fiber';
import type {
  Cutout,
  CutoutShape as CutoutShapeType,
  PathPoint,
} from '@/features/bin-designer/types';
import type { ResizeHandle, InteractionMode, PreviewMap } from '../useCutoutInteraction';
import type { SegmentHoverInfo } from '../handlers';
import type { RulerMeasurement } from '../handlers/rulerHandler';
import type { AlignmentGuide } from '../geometry';
import { computeBounds } from '../geometry';
import { SceneContent } from './SceneContent';

/** Read the user's selected bin preview color */
const PREVIEW_COLOR_KEY = 'gridfinity-designer-preview-color';
const DEFAULT_BIN_COLOR = '#d4d8dc';

function useBinPreviewColor(): string {
  const [color, setColor] = useState(() => {
    try {
      return localStorage.getItem(PREVIEW_COLOR_KEY) ?? DEFAULT_BIN_COLOR;
    } catch {
      return DEFAULT_BIN_COLOR;
    }
  });
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (detail) setColor(detail);
    };
    window.addEventListener('preview-color-change', handler);
    return () => window.removeEventListener('preview-color-change', handler);
  }, []);
  return color;
}

interface DrawingPreview {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly depth: number;
  readonly shape: CutoutShapeType;
}

export interface CutoutCanvas3DProps {
  readonly cutouts: readonly Cutout[];
  readonly binWidth: number;
  readonly binDepth: number;
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly selection: ReadonlySet<string>;
  readonly preview: PreviewMap;
  readonly mode: InteractionMode;
  readonly drawingPreview: DrawingPreview | null;
  readonly pathDrawingPreview: {
    readonly points: readonly PathPoint[];
    readonly cursorX: number;
    readonly cursorY: number;
    readonly canClose: boolean;
  } | null;
  readonly activeGuides: readonly AlignmentGuide[];
  readonly marquee: { x: number; y: number; w: number; h: number } | null;
  // Interaction callbacks — receive world-space mm coordinates directly
  readonly onBackgroundPointerDown: (
    worldX: number,
    worldY: number,
    nativeEvent: PointerEvent
  ) => void;
  readonly onPointerMove: (worldX: number, worldY: number, nativeEvent: PointerEvent) => void;
  readonly onPointerUp: () => void;
  // Shape callbacks
  readonly onSelectCutout: (id: string, additive: boolean) => void;
  readonly onDoubleClickCutout: (id: string) => void;
  readonly onDragStart?: (id: string, mmX: number, mmY: number, altKey?: boolean) => void;
  readonly onResizeStart: (id: string, handle: ResizeHandle, mmX: number, mmY: number) => void;
  readonly onRotateStart: (id: string, startAngle: number) => void;
  readonly onGroupRotateStart: (startAngle: number) => void;
  readonly onGroupScaleStart: (mmX: number, mmY: number) => void;
  readonly segmentHover?: SegmentHoverInfo | null;
  readonly onPathDrawingVertexDown?: (index: number, mmX: number, mmY: number) => void;
  readonly onVertexPointDown?: (index: number, mmX: number, mmY: number) => void;
  readonly onVertexHandleDown?: (
    index: number,
    handleType: 'in' | 'out',
    mmX: number,
    mmY: number
  ) => void;
  /** Externally-managed camera zoom (workspace mode). When provided, the R3F camera syncs to this value. */
  readonly externalZoom?: number;
  /** Externally-managed camera center (workspace mode). When provided, the R3F camera syncs to this position. */
  readonly externalCameraCenter?: { x: number; y: number };
  /** Active ruler measurement to render */
  readonly rulerMeasurement?: RulerMeasurement | null;
  /** Ref to keep ruler handler informed of current zoom */
  readonly rulerZoomRef?: RefObject<number>;
}

export function CutoutCanvas3D({
  cutouts,
  binWidth,
  binDepth,
  canvasWidth,
  canvasHeight,
  selection,
  preview,
  mode,
  drawingPreview,
  pathDrawingPreview,
  activeGuides,
  marquee,
  onBackgroundPointerDown,
  onPointerMove,
  onPointerUp,
  onSelectCutout,
  onDoubleClickCutout,
  onDragStart,
  onResizeStart,
  onRotateStart,
  onGroupRotateStart,
  onGroupScaleStart,
  segmentHover,
  onPathDrawingVertexDown,
  onVertexPointDown,
  onVertexHandleDown,
  externalZoom,
  externalCameraCenter,
  rulerMeasurement,
  rulerZoomRef,
}: CutoutCanvas3DProps) {
  const binColor = useBinPreviewColor();
  const isDragging = mode.type === 'dragging';
  const isResizing = mode.type === 'resizing';
  const isInteracting =
    isDragging ||
    isResizing ||
    mode.type === 'rotating' ||
    mode.type === 'group-rotating' ||
    mode.type === 'group-scaling';

  // Determine cursor style based on interaction mode
  const cursorStyle = useMemo(() => {
    if (
      mode.type === 'placing' ||
      mode.type === 'pending-place' ||
      mode.type === 'drawing' ||
      mode.type === 'path-drawing' ||
      mode.type === 'ruler-ready' ||
      mode.type === 'measuring'
    ) {
      return 'crosshair';
    }
    if (mode.type === 'dragging') {
      return 'move';
    }
    if (mode.type === 'resizing') {
      const handle = mode.handle;
      if (handle === 'nw' || handle === 'se') return 'nwse-resize';
      if (handle === 'ne' || handle === 'sw') return 'nesw-resize';
      if (handle === 'n' || handle === 's') return 'ns-resize';
      // Remaining handles are 'e' or 'w'
      return 'ew-resize';
    }
    if (mode.type === 'rotating' || mode.type === 'group-rotating') {
      return 'grabbing';
    }
    if (mode.type === 'group-scaling') {
      return 'nwse-resize';
    }
    if (mode.type === 'vertex-editing' && segmentHover) {
      return 'copy'; // Plus cursor indicating "add point here"
    }
    return 'default';
  }, [mode, segmentHover]);

  // Memoize dragStart ref so CutoutShapeMesh (React.memo) doesn't re-render on mode changes
  const memoizedDragStart = useMemo(
    () => (mode.type === 'idle' ? onDragStart : undefined),
    [mode.type, onDragStart]
  );

  const selectedCutout =
    selection.size === 1 ? (cutouts.find((c) => selection.has(c.id)) ?? null) : null;

  // Tooltip info from mode and preview
  const tooltipInfo = useMemo(() => {
    if (mode.type === 'dragging' && preview.size > 0) {
      const [firstId, firstUpdates] = [...preview.entries()][0];
      const orig = cutouts.find((c) => c.id === firstId);
      if (!orig) return null;
      const effective = { ...orig, ...firstUpdates };
      return {
        type: 'drag' as const,
        x: effective.x,
        y: effective.y,
        worldX: effective.x + 3,
        worldY: effective.y + 3,
      };
    }
    if (mode.type === 'resizing' && preview.size > 0) {
      const [id, updates] = [...preview.entries()][0];
      const orig = cutouts.find((c) => c.id === id);
      if (!orig) return null;
      const effective = { ...orig, ...updates };
      return {
        type: 'resize' as const,
        width: effective.width,
        depth: effective.depth,
        worldX: effective.x + effective.width + 2,
        worldY: effective.y + effective.depth,
      };
    }
    return null;
  }, [mode, preview, cutouts]);

  // Group bounding box for multi-selection
  const groupBounds = useMemo(() => {
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
      topOffset: 0,
      rotation: 0,
      cornerRadius: 0,
      label: '',
      groupId: null,
    };
  }, [selection, cutouts, isDragging, isResizing, mode.type]);

  // Marquee in mm world coords
  const marqueeWorld = useMemo(() => {
    if (!marquee || Math.abs(marquee.w) + Math.abs(marquee.h) <= 2) return null;
    return { x: marquee.x, y: marquee.y, width: marquee.w, depth: marquee.h };
  }, [marquee]);

  // Compute camera zoom to fit bin in canvas (default for sidebar mode)
  const defaultZoom = Math.min(canvasWidth / binWidth, canvasHeight / binDepth) * 0.84;

  // Set camera lookAt straight down on creation so the view isn't tilted
  const handleCreated = useCallback(
    (state: RootState) => {
      const cam = state.camera;
      cam.lookAt(binWidth / 2, binDepth / 2, 0);
      cam.updateProjectionMatrix();
      state.invalidate();
    },
    [binWidth, binDepth]
  );

  return (
    <Canvas
      orthographic
      frameloop="demand"
      style={{ width: canvasWidth, height: canvasHeight, cursor: cursorStyle }}
      camera={{
        position: [binWidth / 2, binDepth / 2, 100],
        zoom: defaultZoom,
        near: 0.1,
        far: 1000,
      }}
      gl={{ antialias: true, stencil: true }}
      onCreated={handleCreated}
      onContextMenu={(e) => e.preventDefault()}
    >
      <SceneContent
        cutouts={cutouts}
        binWidth={binWidth}
        binDepth={binDepth}
        binColor={binColor}
        selection={selection}
        preview={preview}
        mode={mode}
        isDragging={isDragging}
        isInteracting={isInteracting}
        memoizedDragStart={memoizedDragStart}
        selectedCutout={selectedCutout}
        tooltipInfo={tooltipInfo}
        groupBounds={groupBounds}
        drawingPreview={drawingPreview}
        pathDrawingPreview={pathDrawingPreview}
        activeGuides={activeGuides}
        marqueeWorld={marqueeWorld}
        onBackgroundPointerDown={onBackgroundPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onSelectCutout={onSelectCutout}
        onDoubleClickCutout={onDoubleClickCutout}
        onResizeStart={onResizeStart}
        onRotateStart={onRotateStart}
        onGroupRotateStart={onGroupRotateStart}
        onGroupScaleStart={onGroupScaleStart}
        segmentHover={segmentHover}
        onPathDrawingVertexDown={onPathDrawingVertexDown}
        onVertexPointDown={onVertexPointDown}
        onVertexHandleDown={onVertexHandleDown}
        externalZoom={externalZoom}
        externalCameraCenter={externalCameraCenter}
        rulerMeasurement={rulerMeasurement}
        rulerZoomRef={rulerZoomRef}
      />
    </Canvas>
  );
}

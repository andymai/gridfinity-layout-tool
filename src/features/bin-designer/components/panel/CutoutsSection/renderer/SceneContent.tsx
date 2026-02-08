/**
 * Inner scene content component for the cutout editor.
 *
 * Must be inside the R3F <Canvas> to access useThree().
 * Composes all 3D child components (background, shapes, handles, guides, etc.).
 */

import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import type { Cutout, CutoutShape as CutoutShapeType } from '@/features/bin-designer/types';
import type { ResizeHandle, InteractionMode, PreviewMap } from '../useCutoutInteraction';
import type { AlignmentGuide } from '../geometry';
import { EditorBackground3D } from './EditorBackground3D';
import { CutoutShapeMesh } from './CutoutShapeMesh';
import { CutoutHandles3D } from './CutoutHandles3D';
import { RotationHandle3D } from './RotationHandle3D';
import { SmartGuides3D } from './SmartGuides3D';
import { DimensionTooltip3D } from './DimensionTooltip3D';
import { DimensionAnnotations3D } from './DimensionAnnotations3D';
import { DrawingPreview3D } from './DrawingPreview3D';
import { GroupBounds3D } from './GroupBounds3D';
import { MarqueeBox3D } from './MarqueeBox3D';
import { InteractionPlane } from './InteractionPlane';

interface DrawingPreview {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly depth: number;
  readonly shape: CutoutShapeType;
}

interface TooltipInfo {
  readonly type: 'drag' | 'resize';
  readonly x?: number;
  readonly y?: number;
  readonly width?: number;
  readonly depth?: number;
  readonly worldX: number;
  readonly worldY: number;
}

interface GroupBoundsData {
  readonly id: '__group__';
  readonly shape: 'rectangle';
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly depth: number;
  readonly cutDepth: number;
  readonly topOffset: number;
  readonly rotation: number;
  readonly cornerRadius: number;
  readonly label: string;
  readonly groupId: null;
}

export interface SceneContentProps {
  readonly cutouts: readonly Cutout[];
  readonly binWidth: number;
  readonly binDepth: number;
  readonly binColor: string;
  readonly selection: ReadonlySet<string>;
  readonly preview: PreviewMap;
  readonly mode: InteractionMode;
  readonly isDragging: boolean;
  readonly isInteracting: boolean;
  readonly memoizedDragStart?: (id: string, mmX: number, mmY: number, altKey?: boolean) => void;
  readonly selectedCutout: Cutout | null;
  readonly tooltipInfo: TooltipInfo | null;
  readonly groupBounds: GroupBoundsData | null;
  readonly drawingPreview: DrawingPreview | null;
  readonly activeGuides: readonly AlignmentGuide[];
  readonly marqueeWorld: { x: number; y: number; width: number; depth: number } | null;
  readonly onBackgroundPointerDown: (
    worldX: number,
    worldY: number,
    nativeEvent: PointerEvent
  ) => void;
  readonly onPointerMove: (worldX: number, worldY: number, nativeEvent: PointerEvent) => void;
  readonly onPointerUp: () => void;
  readonly onSelectCutout: (id: string, additive: boolean) => void;
  readonly onDoubleClickCutout: (id: string) => void;
  readonly onResizeStart: (id: string, handle: ResizeHandle, mmX: number, mmY: number) => void;
  readonly onRotateStart: (id: string, startAngle: number) => void;
  readonly onGroupRotateStart: (startAngle: number) => void;
  readonly onGroupScaleStart: (mmX: number, mmY: number) => void;
  /** Externally-managed camera zoom (workspace mode) */
  readonly externalZoom?: number;
  /** Externally-managed camera center (workspace mode) */
  readonly externalCameraCenter?: { x: number; y: number };
}

export function SceneContent({
  cutouts,
  binWidth,
  binDepth,
  binColor,
  selection,
  preview,
  isDragging,
  isInteracting,
  memoizedDragStart,
  selectedCutout,
  tooltipInfo,
  groupBounds,
  drawingPreview,
  activeGuides,
  marqueeWorld,
  onBackgroundPointerDown,
  onPointerMove,
  onPointerUp,
  onSelectCutout,
  onDoubleClickCutout,
  onResizeStart,
  onRotateStart,
  onGroupRotateStart,
  onGroupScaleStart,
  externalZoom,
  externalCameraCenter,
}: SceneContentProps) {
  // Force R3F invalidation on state changes
  const { camera, invalidate } = useThree();
  const cameraRef = useRef(camera);
  // Invalidate whenever key props change
  invalidate();

  // Sync camera to externally-managed zoom/pan state (workspace mode)
  useEffect(() => {
    if (externalZoom !== undefined) {
      const cam = cameraRef.current;
      cam.zoom = externalZoom;
      cam.updateProjectionMatrix();
      invalidate();
    }
  }, [externalZoom, invalidate]);

  useEffect(() => {
    if (externalCameraCenter) {
      const cam = cameraRef.current;
      cam.position.x = externalCameraCenter.x;
      cam.position.y = externalCameraCenter.y;
      cam.updateProjectionMatrix();
      invalidate();
    }
  }, [externalCameraCenter, invalidate]);

  return (
    <>
      {/* Scene clear color — matches 3D preview background */}
      <color attach="background" args={['#1a1a22']} />

      {/* Background grid and bin surface */}
      <EditorBackground3D
        binWidth={binWidth}
        binDepth={binDepth}
        zoom={camera.zoom}
        binColor={binColor}
      />

      {/* Interaction plane for background clicks and pointer tracking */}
      <InteractionPlane
        binWidth={binWidth}
        binDepth={binDepth}
        onPointerDown={(worldX, worldY, e: ThreeEvent<PointerEvent>) => {
          onBackgroundPointerDown(worldX, worldY, e.nativeEvent);
        }}
        onPointerMove={(worldX, worldY, e: ThreeEvent<PointerEvent>) => {
          onPointerMove(worldX, worldY, e.nativeEvent);
        }}
        onPointerUp={onPointerUp}
      />

      {/* Ungrouped cutout shapes — normal rendering */}
      {cutouts
        .filter((c) => c.groupId === null)
        .map((cutout) => (
          <CutoutShapeMesh
            key={cutout.id}
            cutout={cutout}
            isSelected={selection.has(cutout.id)}
            isGrouped={false}
            isDragging={isDragging && selection.has(cutout.id)}
            previewOverrides={preview.get(cutout.id)}
            binColor={binColor}
            onSelect={onSelectCutout}
            onDoubleClick={onDoubleClickCutout}
            onDragStart={memoizedDragStart}
          />
        ))}

      {/* Grouped cutouts — stencil fill pass (interactive, handles pointer events) */}
      {cutouts
        .filter((c) => c.groupId !== null)
        .map((cutout) => (
          <CutoutShapeMesh
            key={`${cutout.id}-fill`}
            cutout={cutout}
            isSelected={selection.has(cutout.id)}
            isGrouped={true}
            isDragging={isDragging && selection.has(cutout.id)}
            previewOverrides={preview.get(cutout.id)}
            binColor={binColor}
            renderMode="fill"
            onSelect={onSelectCutout}
            onDoubleClick={onDoubleClickCutout}
            onDragStart={memoizedDragStart}
          />
        ))}
      {/* Grouped cutouts — stencil stroke pass (visual-only, no interaction) */}
      {cutouts
        .filter((c) => c.groupId !== null)
        .map((cutout) => (
          <CutoutShapeMesh
            key={`${cutout.id}-stroke`}
            cutout={cutout}
            isSelected={selection.has(cutout.id)}
            isGrouped={true}
            isDragging={isDragging && selection.has(cutout.id)}
            previewOverrides={preview.get(cutout.id)}
            binColor={binColor}
            renderMode="stroke"
            onSelect={onSelectCutout}
            onDoubleClick={onDoubleClickCutout}
            onDragStart={memoizedDragStart}
          />
        ))}

      {/* Smart guides during drag */}
      {isDragging && (
        <SmartGuides3D
          guides={activeGuides}
          binWidth={binWidth}
          binDepth={binDepth}
          zoom={camera.zoom}
        />
      )}

      {/* Dimension tooltip during resize (not drag — position shown in inspector) */}
      {tooltipInfo && tooltipInfo.type === 'resize' && (
        <DimensionTooltip3D
          type={tooltipInfo.type}
          width={tooltipInfo.width}
          depth={tooltipInfo.depth}
          worldX={tooltipInfo.worldX}
          worldY={tooltipInfo.worldY}
        />
      )}

      {/* Dimension annotations for selected cutouts (high zoom only) */}
      {!isInteracting && (
        <DimensionAnnotations3D
          cutouts={cutouts}
          selection={selection}
          preview={preview}
          zoom={camera.zoom}
        />
      )}

      {/* Resize handles on single selected cutout (not during interactions) */}
      {selectedCutout && !isInteracting && (
        <CutoutHandles3D cutout={selectedCutout} onResizeStart={onResizeStart} />
      )}

      {/* Rotation handle (not during interactions) */}
      {selectedCutout && !isInteracting && (
        <RotationHandle3D cutout={selectedCutout} onRotateStart={onRotateStart} />
      )}

      {/* Group bounding box + handles for multi-selection */}
      {groupBounds && (
        <>
          <GroupBounds3D
            x={groupBounds.x}
            y={groupBounds.y}
            width={groupBounds.width}
            depth={groupBounds.depth}
          />
          <CutoutHandles3D
            cutout={groupBounds}
            onResizeStart={(_id, _handle, mmX, mmY) => {
              onGroupScaleStart(mmX, mmY);
            }}
          />
          <RotationHandle3D
            cutout={groupBounds}
            onRotateStart={(_id, startAngle) => {
              onGroupRotateStart(startAngle);
            }}
          />
        </>
      )}

      {/* Drawing preview (corner-to-corner) */}
      {drawingPreview && (
        <DrawingPreview3D
          x={drawingPreview.x}
          y={drawingPreview.y}
          width={drawingPreview.width}
          depth={drawingPreview.depth}
          shape={drawingPreview.shape}
        />
      )}

      {/* Marquee selection box */}
      {marqueeWorld && (
        <MarqueeBox3D
          x={marqueeWorld.x}
          y={marqueeWorld.y}
          width={marqueeWorld.width}
          depth={marqueeWorld.depth}
        />
      )}
    </>
  );
}

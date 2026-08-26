/**
 * Inner scene content component for the cutout editor.
 *
 * Must be inside the R3F <Canvas> to access useThree().
 * Composes all 3D child components (background, shapes, handles, guides, etc.).
 */

import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import type {
  Cutout,
  CutoutShape as CutoutShapeType,
  PathPoint,
} from '@/features/bin-designer/types';
import type { CellMask } from '@/shared/utils/cellMask';
import type { LidCutoutWindow } from '@/shared/utils/lidCutoutPlan';
import type { TaperBandSides } from '@/features/bin-designer/utils/binDimensions';
import type { ResizeHandle, InteractionMode, PreviewMap } from '../useCutoutInteraction';
import type { SegmentHoverInfo } from '../handlers';
import type { AlignmentGuide } from '../geometry';
import { EditorBackground3D } from './EditorBackground3D';
import { TaperBand3D } from './TaperBand3D';
import { ReferenceOutline3D } from './ReferenceOutline3D';
import { CutoutShapeMesh } from './CutoutShapeMesh';
import { dimmedBinColor } from './dimmedBinColor';
import { isWithin } from '@/features/bin-designer/utils/cutoutHierarchy';
import { OffBoardFrames3D } from './OffBoardFrames3D';
import { KeepoutCircles3D } from './KeepoutCircles3D';
import { CutoutLabel3D } from './CutoutLabel3D';
import { CutoutHandles3D } from './CutoutHandles3D';
import { RotationHandle3D } from './RotationHandle3D';
import { SmartGuides3D } from './SmartGuides3D';
import { DimensionTooltip3D } from './DimensionTooltip3D';
import { DimensionAnnotations3D } from './DimensionAnnotations3D';
import { CutoutArrayMeshes } from './CutoutArrayMeshes';
import { DrawingPreview3D } from './DrawingPreview3D';
import { FitCueOverlay3D } from './FitCueOverlay3D';
import type { FitCue } from '../cutoutSectionVisibility';
import { GroupBounds3D } from './GroupBounds3D';
import { MarqueeBox3D } from './MarqueeBox3D';
import { InteractionPlane } from './InteractionPlane';
import { PathDrawingPreview3D } from './PathDrawingPreview3D';
import { PathEditOverlay3D } from './PathEditOverlay3D';
import { RulerMeasurement3D } from './RulerMeasurement3D';
import { LockBadge3D } from './LockBadge3D';
import { GroupResultMesh } from './GroupResultMesh';
import { expandCutoutArray, expandCutoutGroup } from '@/shared/utils/cutoutArray';
import type { RulerMeasurement } from '../handlers/rulerHandler';
import { useThreeColors } from '@/shared/hooks/useThemeEffect';

const EMPTY_IDS: ReadonlySet<string> = new Set();

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
  /** Non-rectangular footprint mask — when present background renders the polygon. */
  readonly cellMask?: CellMask;
  /** Per-side strip a full-depth cutout is trimmed out of; null when untapered. */
  readonly taperBand?: TaperBandSides | null;
  /**
   * Another part's footprint, drawn faintly under the board purely so the user can
   * line shapes up with it. Set when the editor is on the LID, whose window is a
   * different frame from the bin's interior. Absent on the bin's own board.
   */
  readonly referenceOutline?: { readonly width: number; readonly depth: number } | null;
  readonly lidWindow?: LidCutoutWindow | null;
  readonly binColor: string;
  /** Groups the editor is drilled into; shapes outside the branch render faded. */
  readonly groupContext?: readonly string[];
  readonly selection: ReadonlySet<string>;
  /** Cutouts stranded past the board edge — framed with a red warning outline. */
  readonly offBoardIds?: ReadonlySet<string>;
  readonly preview: PreviewMap;
  readonly mode: InteractionMode;
  readonly isDragging: boolean;
  readonly isInteracting: boolean;
  readonly memoizedDragStart?: (id: string, mmX: number, mmY: number, altKey?: boolean) => void;
  readonly onLabelDragStart?: (id: string, mmX: number, mmY: number) => void;
  readonly selectedCutout: Cutout | null;
  readonly tooltipInfo: TooltipInfo | null;
  readonly groupBounds: GroupBoundsData | null;
  readonly drawingPreview: DrawingPreview | null;
  /** Active insertion-fit cue to draw on the single-selected cutout. */
  readonly fitCue?: FitCue;
  readonly pathDrawingPreview: {
    readonly points: readonly PathPoint[];
    readonly cursorX: number;
    readonly cursorY: number;
    readonly canClose: boolean;
  } | null;
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
  readonly segmentHover?: SegmentHoverInfo | null;
  readonly onPathDrawingVertexDown?: (index: number, mmX: number, mmY: number) => void;
  readonly onVertexPointDown?: (index: number, mmX: number, mmY: number) => void;
  readonly onVertexHandleDown?: (
    index: number,
    handleType: 'in' | 'out',
    mmX: number,
    mmY: number
  ) => void;
  /** Externally-managed camera zoom (workspace mode) */
  readonly externalZoom?: number;
  /** Externally-managed camera center (workspace mode) */
  readonly externalCameraCenter?: { x: number; y: number };
  /** Active ruler measurement */
  readonly rulerMeasurement?: RulerMeasurement | null;
  /** Ref to keep ruler handler informed of current zoom */
  readonly rulerZoomRef?: RefObject<number>;
}

export function SceneContent({
  cutouts,
  binWidth,
  binDepth,
  cellMask,
  taperBand,
  referenceOutline,
  lidWindow,
  binColor,
  groupContext,
  selection,
  offBoardIds = EMPTY_IDS,
  preview,
  mode,
  isDragging,
  isInteracting,
  memoizedDragStart,
  onLabelDragStart,
  selectedCutout,
  tooltipInfo,
  groupBounds,
  drawingPreview,
  fitCue,
  pathDrawingPreview,
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
  segmentHover,
  onPathDrawingVertexDown,
  onVertexPointDown,
  onVertexHandleDown,
  externalZoom,
  externalCameraCenter,
  rulerMeasurement,
  rulerZoomRef,
}: SceneContentProps) {
  const colors = useThreeColors();

  /**
   * Surface colour a shape draws against. Shapes outside the entered group get
   * a brightened one so they fade toward the board — the canvas half of the
   * drill-in cue the breadcrumb states in words.
   */
  const surfaceColorFor = useCallback(
    (cutout: Cutout): string =>
      groupContext && groupContext.length > 0 && !isWithin(cutout, groupContext)
        ? dimmedBinColor(binColor)
        : binColor,
    [binColor, groupContext]
  );
  // Force R3F invalidation on state changes
  const { camera, invalidate } = useThree();

  // Keep ruler zoom ref in sync with camera zoom
  useEffect(() => {
    if (rulerZoomRef) {
      rulerZoomRef.current = camera.zoom;
    }
  }, [rulerZoomRef, camera.zoom]);
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
      <color attach="background" args={[colors.canvasBg]} />

      {/* Background grid and bin surface */}
      <EditorBackground3D
        binWidth={binWidth}
        binDepth={binDepth}
        cellMask={cellMask}
        zoom={camera.zoom}
        binColor={binColor}
      />

      {/* Where another part sits under this board — alignment reference only */}
      {referenceOutline && (
        <ReferenceOutline3D
          binWidth={binWidth}
          binDepth={binDepth}
          width={referenceOutline.width}
          depth={referenceOutline.depth}
        />
      )}

      {/* The magnet bosses a lid cutout is clipped around — scenery, not a boundary */}
      {lidWindow && <KeepoutCircles3D keepouts={lidWindow.keepouts} />}

      {/* Where a full-depth cutout gets trimmed by the tapered wall */}
      {taperBand && <TaperBand3D binWidth={binWidth} binDepth={binDepth} band={taperBand} />}

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

      {/* Ungrouped cutout shapes — normal rendering (arrays expand to instances) */}
      {cutouts
        .filter((c) => c.groupId === null)
        .map((cutout) => {
          const isVertexEditing = mode.type === 'vertex-editing' && mode.cutoutId === cutout.id;
          const isRulerActive = mode.type === 'ruler-ready' || mode.type === 'measuring';
          if (cutout.array) {
            return (
              <CutoutArrayMeshes
                key={cutout.id}
                master={cutout}
                isSelected={selection.has(cutout.id)}
                isDragging={isDragging && selection.has(cutout.id)}
                previewOverride={preview.get(cutout.id)}
                binColor={surfaceColorFor(cutout)}
                onSelect={onSelectCutout}
                onDoubleClick={onDoubleClickCutout}
                onDragStart={memoizedDragStart}
                disablePointerEvents={isVertexEditing || isRulerActive}
              />
            );
          }
          return (
            <CutoutShapeMesh
              key={cutout.id}
              cutout={cutout}
              isSelected={selection.has(cutout.id)}
              isGrouped={false}
              isDragging={isDragging && selection.has(cutout.id)}
              previewOverrides={preview.get(cutout.id)}
              binColor={surfaceColorFor(cutout)}
              onSelect={onSelectCutout}
              onDoubleClick={onDoubleClickCutout}
              onDragStart={memoizedDragStart}
              disablePointerEvents={isVertexEditing || isRulerActive}
            />
          );
        })}

      {/*
       * Grouped cutouts split into two render strategies by op:
       *   - union (or missing op) → stencil fill+stroke passes that merge
       *     member outlines visually. The historical path; pixel-perfect SDF.
       *   - subtract / intersect / exclude → polygon-clipped result mesh.
       *     Member shapes still render as faint outlines so the user can
       *     interact with each one; the boolean polygon shows the final cut.
       */}
      {(() => {
        const grouped = cutouts.filter((c) => c.groupId !== null);
        const isUnionLike = (c: Cutout): boolean => !c.groupOp || c.groupOp === 'union';
        // A grouped Repeat copies the whole assembly, so every member draws
        // once per copy. The preview override is merged BEFORE expanding, so a
        // mid-drag group carries its copies with it; clicks and drags on any
        // copy still address the member that owns it.
        const live = (c: Cutout): Cutout => {
          const o = preview.get(c.id);
          return o ? { ...c, ...o } : c;
        };
        const copiesOf = (c: Cutout): Cutout[] => expandCutoutArray(live(c));
        const unionMembers = grouped.filter(isUnionLike);
        const otherMembers = grouped.filter((c) => !isUnionLike(c));
        const nonUnionGroups = new Map<string, Cutout[]>();
        for (const c of otherMembers) {
          if (c.groupId === null) continue;
          const list = nonUnionGroups.get(c.groupId);
          if (list) list.push(c);
          else nonUnionGroups.set(c.groupId, [c]);
        }
        return (
          <>
            {unionMembers.flatMap((cutout) => {
              const isVertexEditing = mode.type === 'vertex-editing' && mode.cutoutId === cutout.id;
              const isRulerActive = mode.type === 'ruler-ready' || mode.type === 'measuring';
              return copiesOf(cutout).map((copy) => (
                <CutoutShapeMesh
                  key={`${copy.id}-fill`}
                  cutout={copy}
                  isSelected={selection.has(cutout.id)}
                  isGrouped={true}
                  isDragging={isDragging && selection.has(cutout.id)}
                  binColor={surfaceColorFor(cutout)}
                  renderMode="fill"
                  onSelect={(_id, additive) => onSelectCutout(cutout.id, additive)}
                  onDoubleClick={() => onDoubleClickCutout(cutout.id)}
                  onDragStart={
                    memoizedDragStart
                      ? (_id, mmX, mmY, altKey) => memoizedDragStart(cutout.id, mmX, mmY, altKey)
                      : undefined
                  }
                  disablePointerEvents={isVertexEditing || isRulerActive}
                />
              ));
            })}
            {unionMembers.flatMap((cutout) =>
              copiesOf(cutout).map((copy) => (
                <CutoutShapeMesh
                  key={`${copy.id}-stroke`}
                  cutout={copy}
                  isSelected={selection.has(cutout.id)}
                  isGrouped={true}
                  isDragging={isDragging && selection.has(cutout.id)}
                  binColor={surfaceColorFor(cutout)}
                  renderMode="stroke"
                  onSelect={(_id, additive) => onSelectCutout(cutout.id, additive)}
                  onDoubleClick={() => onDoubleClickCutout(cutout.id)}
                  onDragStart={
                    memoizedDragStart
                      ? (_id, mmX, mmY, altKey) => memoizedDragStart(cutout.id, mmX, mmY, altKey)
                      : undefined
                  }
                />
              ))
            )}
            {[...nonUnionGroups.entries()].flatMap(([gid, members]) => {
              const anySelected = members.some((m) => selection.has(m.id));
              // One boolean result per copy, matching how the worker builds a
              // repeated group: the op runs on the assembly as drawn and the
              // result is what repeats.
              return expandCutoutGroup(members.map(live)).map((copy, i) => (
                <GroupResultMesh
                  key={`group-result-${gid}-${i}`}
                  members={copy}
                  isSelected={anySelected}
                  binColor={surfaceColorFor(members[0])}
                />
              ));
            })}
            {otherMembers.flatMap((cutout) => {
              const isVertexEditing = mode.type === 'vertex-editing' && mode.cutoutId === cutout.id;
              const isRulerActive = mode.type === 'ruler-ready' || mode.type === 'measuring';
              return copiesOf(cutout).map((copy) => (
                <CutoutShapeMesh
                  key={`${copy.id}-outline`}
                  cutout={copy}
                  isSelected={selection.has(cutout.id)}
                  isGrouped={true}
                  isDragging={isDragging && selection.has(cutout.id)}
                  binColor={surfaceColorFor(cutout)}
                  renderMode="stroke"
                  onSelect={(_id, additive) => onSelectCutout(cutout.id, additive)}
                  onDoubleClick={() => onDoubleClickCutout(cutout.id)}
                  onDragStart={
                    memoizedDragStart
                      ? (_id, mmX, mmY, altKey) => memoizedDragStart(cutout.id, mmX, mmY, altKey)
                      : undefined
                  }
                  disablePointerEvents={isVertexEditing || isRulerActive}
                />
              ));
            })}
          </>
        );
      })()}

      {/* Engraved/embossed labels mirroring the printed bin-top text. Grab-to-move
          is gated to idle mode by the parent (mirrors memoizedDragStart). */}
      <CutoutLabel3D
        cutouts={cutouts}
        binWidth={binWidth}
        binDepth={binDepth}
        binColor={binColor}
        preview={preview}
        onLabelDragStart={onLabelDragStart}
      />

      {/* Lock badges on locked cutouts */}
      {cutouts
        .filter((c) => c.locked && !c.hidden)
        .map((cutout) => {
          const overrides = preview.get(cutout.id);
          const x = overrides?.x ?? cutout.x;
          const y = overrides?.y ?? cutout.y;
          const w = overrides?.width ?? cutout.width;
          const d = overrides?.depth ?? cutout.depth;
          // Compute top-right corner relative to center, then rotate
          const cx = x + w / 2;
          const cy = y + d / 2;
          const localX = w / 2;
          const localY = d / 2;
          const rad = -((overrides?.rotation ?? cutout.rotation) * Math.PI) / 180;
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);
          const worldX = cx + localX * cos - localY * sin;
          const worldY = cy + localX * sin + localY * cos;
          return <LockBadge3D key={`lock-${cutout.id}`} worldX={worldX} worldY={worldY} />;
        })}

      {/* Off-board warning frames — one per stranded array instance, framed at
          its true footprint (kept in lockstep with detection). */}
      <OffBoardFrames3D
        cutouts={cutouts}
        offBoardIds={offBoardIds}
        preview={preview}
        binWidth={binWidth}
        binDepth={binDepth}
        cellMask={cellMask}
        lidWindow={lidWindow}
      />

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

      {/* Resize handles on single selected cutout (not during interactions).
          Mesh imprints are shape-locked: their footprint is derived from the
          imported mesh, so resizing is meaningless — move/rotate only. Text
          elements likewise: their box follows the caption and its set size. */}
      {selectedCutout &&
        selectedCutout.shape !== 'mesh' &&
        selectedCutout.shape !== 'text' &&
        !isInteracting && <CutoutHandles3D cutout={selectedCutout} onResizeStart={onResizeStart} />}

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

      {/* Insertion-fit cue: dashed true-footprint while a fit field is focused */}
      {fitCue && selectedCutout && (
        <FitCueOverlay3D
          cutout={
            preview.get(selectedCutout.id)
              ? { ...selectedCutout, ...preview.get(selectedCutout.id) }
              : selectedCutout
          }
          cue={fitCue}
        />
      )}

      {/* Path drawing preview (pen tool) */}
      {pathDrawingPreview && (
        <PathDrawingPreview3D
          points={pathDrawingPreview.points}
          cursorX={pathDrawingPreview.cursorX}
          cursorY={pathDrawingPreview.cursorY}
          canClose={pathDrawingPreview.canClose}
          onVertexDown={onPathDrawingVertexDown}
        />
      )}

      {/* Vertex editing overlay for path cutouts */}
      {mode.type === 'vertex-editing' &&
        (() => {
          const editCutout = cutouts.find((c) => c.id === mode.cutoutId);
          if (!editCutout) return null;
          return (
            <PathEditOverlay3D
              cutout={editCutout}
              selectedPointIndex={mode.selectedPointIndex}
              previewOverrides={preview.get(editCutout.id)}
              segmentHover={segmentHover}
              onPointDown={(index, mmX, mmY) => onVertexPointDown?.(index, mmX, mmY)}
              onHandleDown={(index, handleType, mmX, mmY) =>
                onVertexHandleDown?.(index, handleType, mmX, mmY)
              }
            />
          );
        })()}

      {/* Marquee selection box */}
      {marqueeWorld && (
        <MarqueeBox3D
          x={marqueeWorld.x}
          y={marqueeWorld.y}
          width={marqueeWorld.width}
          depth={marqueeWorld.depth}
        />
      )}

      {rulerMeasurement && <RulerMeasurement3D measurement={rulerMeasurement} zoom={camera.zoom} />}
    </>
  );
}

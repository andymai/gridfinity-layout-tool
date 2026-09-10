/** Scene composition for the Workshop editor: base, parts, ghost, controls. */
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsType } from 'three-stdlib';
import type { Group, Vector3 } from 'three';
import { GradientBackground } from '@/shared/components/preview/GradientBackground';
import { CameraRig, type Projection } from '@/shared/components/preview/CameraRig';
import { SceneLighting } from '@/features/bin-designer/components/PreviewCanvas/previewCanvasCamera';
import { FootprintGrid } from '@/features/bin-designer/components/preview/FootprintGrid/FootprintGrid';
import type { AssemblyStructure } from '@/shared/types/assembly';
import type { ItemEnvelope } from '@/shared/types/item';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { AlignmentGuides } from './AlignmentGuides';
import { WorkshopDragTip } from './WorkshopDragTip';
import { WedgeFillerMesh } from './WedgeFillerMesh';
import { BasePlateMesh } from './BasePlateMesh';
import { MoveHandle3D } from './MoveHandle3D';
import { ResizeHandles3D } from './ResizeHandles3D';
import { RotationGizmo3D } from './RotationGizmo3D';
import { PartProxyMesh } from './PartProxyMesh';
import { PlacementGhost } from './PlacementGhost';
import { WorkshopSharpMesh } from './WorkshopSharpMesh';
import { useWorkshopSharpen } from './useWorkshopSharpen';
import { diffNewPartIds } from './hologramTracker';
import { baseExtentMm, ROTATION_RING_LIFT_MM } from './workshopPlacement';
import { useWorkshopInteraction } from './useWorkshopInteraction';
import { InvalidateBridge, ScenePickBridge, FrameSelectionBridge } from './WorkshopSceneBridges';
import type { MarqueeRect } from './WorkshopSceneBridges';
import { RotationCatchPlane, DragCatchPlane } from './WorkshopCatchPlanes';
export { InvalidateBridge, ScenePickBridge, FrameSelectionBridge } from './WorkshopSceneBridges';
export type { MarqueeRect } from './WorkshopSceneBridges';

interface WorkshopSceneProps {
  structure: AssemblyStructure;
  envelope: ItemEnvelope;
  projection?: Projection;
  /** performance.now() of the last armed click that hit nothing. */
  missFlashAt?: number;
  controlsRef?: RefObject<OrbitControlsType | null>;
  invalidateRef?: RefObject<(() => void) | null>;
  onPartContextMenu?: (partId: string, clientX: number, clientY: number) => void;
  /** Consulted (and consumed) when a base click would clear the selection. */
  shouldSwallowBaseClick?: () => boolean;
  /** Called when a scene gesture claims a pointerdown; the marquee skips those. */
  onGestureStart?: () => void;
  /** Filled with a screen-rect → part-ids projector for the marquee overlay. */
  pickRef?: RefObject<((rect: MarqueeRect) => string[]) | null>;
  /** Filled with a zoom-to-selection trigger (used by the F key and the view bar). */
  frameRef?: RefObject<(() => void) | null>;
  /** Reports which part the pointer rests on (null over the base or mid-gesture). */
  onHoverPart?: (partId: string | null) => void;
}

export function WorkshopScene({
  structure,
  envelope,
  projection = 'perspective',
  missFlashAt = 0,
  controlsRef,
  invalidateRef,
  onPartContextMenu,
  shouldSwallowBaseClick,
  onGestureStart,
  pickRef,
  frameRef,
  onHoverPart,
}: WorkshopSceneProps) {
  const extent = useMemo(() => baseExtentMm(envelope), [envelope]);
  const interaction = useWorkshopInteraction(structure, extent, {
    shouldSwallowBaseClick,
    onGestureStart,
  });
  const { w, d } = extent;
  const wedge = structure.base.wedge;
  const wedgeAngle = wedge !== undefined && wedge.angleDeg > 0 ? wedge.angleDeg : 0;
  // Hinge at the floor plate's bottom low edge (the socket top), mirroring
  // the worker's transform: the socket and plinth never tilt.
  const plateBottom = -structure.base.floorThickness;
  const tilt = useMemo(() => {
    if (wedgeAngle <= 0 || wedge === undefined) return null;
    const rad = (wedgeAngle * Math.PI) / 180;
    switch (wedge.lowEdge) {
      case 'front':
        return { at: [0, -d / 2, plateBottom] as const, rotation: [rad, 0, 0] as const };
      case 'back':
        return { at: [0, d / 2, plateBottom] as const, rotation: [-rad, 0, 0] as const };
      case 'left':
        return { at: [-w / 2, 0, plateBottom] as const, rotation: [0, -rad, 0] as const };
      default:
        return { at: [w / 2, 0, plateBottom] as const, rotation: [0, rad, 0] as const };
    }
  }, [d, plateBottom, w, wedge, wedgeAngle]);
  const flatFrameRef = useRef<Group | null>(null);
  const sceneFromWorld = useCallback((point: Vector3): Vector3 => {
    const frame = flatFrameRef.current;
    return frame ? frame.worldToLocal(point.clone()) : point;
  }, []);
  const cameraDistance = Math.max(w, d) * 1.4 + 80;
  const sharp = useWorkshopSharpen();
  // A resize-handle drag regenerates params continuously; letting the sharp
  // mesh swap in mid-gesture flashes the scan-in over the whole build.
  const [resizing, setResizing] = useState(false);
  const showSharp =
    sharp && !resizing && interaction.draggingId === null && interaction.rotatingId === null;

  const knownIdsRef = useRef<ReadonlySet<string> | null>(null);
  const [holograms, setHolograms] = useState<Map<string, number>>(new Map());
  useEffect(() => {
    const { ids, fresh } = diffNewPartIds(knownIdsRef.current, interaction.placements);
    knownIdsRef.current = ids;
    if (fresh.length > 0) {
      const now = performance.now();
      setHolograms((prev) => {
        const next = new Map(prev);
        for (const id of fresh) next.set(id, now);
        return next;
      });
    }
  }, [interaction.placements]);
  const hoveredPartId =
    interaction.draggingId !== null ||
    interaction.rotatingId !== null ||
    interaction.pendingType !== null
      ? null
      : (interaction.hover?.parentId ?? null);
  useEffect(() => {
    onHoverPart?.(hoveredPartId);
  }, [hoveredPartId, onHoverPart]);

  const endHologram = (id: string): void => {
    setHolograms((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  };

  return (
    <>
      <CameraRig
        projection={projection}
        initialPosition={[cameraDistance * 0.55, -cameraDistance * 0.55, cameraDistance * 0.45]}
        target={[0, 0, 15]}
        far={4000}
      />
      <GradientBackground />
      <SceneLighting />
      <FootprintGrid
        width={envelope.width}
        depth={envelope.depth}
        gridUnitMm={envelope.gridUnitMm}
      />
      {showSharp && <WorkshopSharpMesh floorThickness={structure.base.floorThickness} />}
      {/* Everything in the FLAT placement frame sits inside the tilt group;
          the worker's sharp mesh is already wedge-shaped and stays outside.
          Pointer math resolves through sceneFromWorld. */}
      <group
        position={tilt ? [tilt.at[0], tilt.at[1], tilt.at[2]] : [0, 0, 0]}
        rotation={tilt ? [tilt.rotation[0], tilt.rotation[1], tilt.rotation[2]] : [0, 0, 0]}
      >
        <group
          position={tilt ? [-tilt.at[0], -tilt.at[1], -tilt.at[2]] : [0, 0, 0]}
          ref={flatFrameRef}
        >
          <BasePlateMesh
            sceneFromWorld={sceneFromWorld}
            envelope={envelope}
            base={structure.base}
            hidden={showSharp}
            flashAt={missFlashAt}
            onSurfaceMove={interaction.onSurfaceMove}
            onSurfaceLeave={interaction.onSurfaceLeave}
            onSurfaceClick={interaction.onSurfaceClick}
          />
          {interaction.placements.map((placed) => (
            <PartProxyMesh
              key={placed.key}
              placed={placed}
              baseW={w}
              baseD={d}
              selected={interaction.selectedIds.has(placed.selectId)}
              raycastDisabled={
                (interaction.draggingId !== null &&
                  interaction.isInDraggedSubtree(placed.selectId)) ||
                interaction.rotatingId !== null
              }
              hidden={showSharp}
              mirrorAxis={structure.mirrorAxis}
              hologramStart={holograms.get(placed.selectId) ?? null}
              onHologramEnd={endHologram}
              onSurfaceMove={interaction.onSurfaceMove}
              onSurfaceLeave={interaction.onSurfaceLeave}
              onSurfaceClick={interaction.onSurfaceClick}
              onPartPointerDown={interaction.onPartPointerDown}
              onPartContextMenu={onPartContextMenu}
              sceneFromWorld={sceneFromWorld}
            />
          ))}
          {(interaction.draggingId !== null || interaction.rotatingId !== null) &&
            (() => {
              const activeId = interaction.draggingId ?? interaction.rotatingId;
              const placed = activeId !== null ? interaction.placedById.get(activeId) : undefined;
              return placed ? (
                <WorkshopDragTip
                  placed={placed}
                  mode={interaction.rotatingId !== null ? 'rotate' : 'move'}
                  baseW={w}
                  baseD={d}
                />
              ) : null;
            })()}
          {interaction.pendingType &&
            interaction.ghostPosition &&
            interaction.draggingId === null && (
              <PlacementGhost
                type={interaction.pendingType}
                cutterShape={interaction.pendingCutterShape}
                position={interaction.ghostPosition}
                baseW={w}
                baseD={d}
              />
            )}
          {interaction.draggingId !== null && (
            <DragCatchPlane
              baseW={w}
              baseD={d}
              onSurfaceMove={interaction.onSurfaceMove}
              sceneFromWorld={sceneFromWorld}
            />
          )}
          {interaction.draggingId !== null &&
            interaction.alignGuides !== null &&
            (() => {
              const guides = interaction.alignGuides;
              const parent =
                guides.parentId === null
                  ? null
                  : (interaction.placedById.get(guides.parentId) ?? null);
              return guides.parentId !== null && parent === null ? null : (
                <AlignmentGuides guides={guides} parent={parent} baseW={w} baseD={d} />
              );
            })()}
          {interaction.rotationHub !== null &&
            interaction.draggingId === null &&
            interaction.pendingType === null && (
              <RotationGizmo3D
                hub={interaction.rotationHub}
                baseW={w}
                baseD={d}
                active={interaction.rotatingId !== null}
                onBeginRotate={interaction.beginRotate}
              />
            )}
          {interaction.selectedIds.size === 1 &&
            interaction.selectedId !== null &&
            interaction.draggingId === null &&
            interaction.rotatingId === null &&
            interaction.pendingType === null &&
            (() => {
              const selectedPlaced = interaction.placedById.get(interaction.selectedId);
              return selectedPlaced ? (
                <ResizeHandles3D
                  placed={selectedPlaced}
                  baseW={w}
                  baseD={d}
                  onGestureStart={onGestureStart}
                  onResizingChange={setResizing}
                />
              ) : null;
            })()}
          {interaction.rotatingId !== null && interaction.rotationHub !== null && (
            <RotationCatchPlane
              baseW={w}
              baseD={d}
              z={interaction.rotationHub.topZ + ROTATION_RING_LIFT_MM}
              onRotateMove={interaction.onRotateMove}
              sceneFromWorld={sceneFromWorld}
            />
          )}
          {interaction.selectedViaTouch &&
            interaction.selectedId !== null &&
            interaction.draggingId === null &&
            interaction.pendingType === null &&
            (() => {
              const selectedPlaced = interaction.placedById.get(interaction.selectedId);
              return selectedPlaced ? (
                <MoveHandle3D
                  placed={selectedPlaced}
                  baseW={w}
                  baseD={d}
                  onBeginDrag={interaction.beginPartDrag}
                />
              ) : null;
            })()}
          {invalidateRef && <InvalidateBridge invalidateRef={invalidateRef} />}
          {pickRef && (
            <ScenePickBridge
              pickRef={pickRef}
              placements={interaction.placements}
              flatFrameRef={flatFrameRef}
              baseW={w}
              baseD={d}
            />
          )}
          {frameRef && (
            <FrameSelectionBridge
              frameRef={frameRef}
              controlsRef={controlsRef}
              placements={interaction.placements}
              flatFrameRef={flatFrameRef}
              baseW={w}
              baseD={d}
            />
          )}
        </group>
      </group>
      {tilt !== null && wedge !== undefined && (
        <WedgeFillerMesh envelope={envelope} base={structure.base} wedge={wedge} />
      )}
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.12}
        minDistance={30}
        maxDistance={1500}
        maxPolarAngle={Math.PI * 0.85}
        target={[0, 0, 15]}
      />
    </>
  );
}

/** Scene composition for the Workshop editor: base, parts, ghost, controls. */
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsType } from 'three-stdlib';
import { useThree } from '@react-three/fiber';
import type { Group, Vector3 } from 'three';
import { GradientBackground } from '@/shared/components/preview/GradientBackground';
import { CameraRig } from '@/shared/components/preview/CameraRig';
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
import { RotationGizmo3D } from './RotationGizmo3D';
import { PartProxyMesh } from './PartProxyMesh';
import { PlacementGhost } from './PlacementGhost';
import { WorkshopSharpMesh } from './WorkshopSharpMesh';
import { useWorkshopSharpen } from './useWorkshopSharpen';
import { diffNewPartIds } from './hologramTracker';
import { baseExtentMm, ROTATION_RING_LIFT_MM, sceneToStore } from './workshopPlacement';
import { useWorkshopInteraction, type HoverSurface } from './useWorkshopInteraction';

interface WorkshopSceneProps {
  structure: AssemblyStructure;
  envelope: ItemEnvelope;
  /** performance.now() of the last armed click that hit nothing. */
  missFlashAt?: number;
  controlsRef?: RefObject<OrbitControlsType | null>;
  invalidateRef?: RefObject<(() => void) | null>;
  onPartContextMenu?: (partId: string, clientX: number, clientY: number) => void;
}

function InvalidateBridge({ invalidateRef }: { invalidateRef: RefObject<(() => void) | null> }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    invalidateRef.current = invalidate;
    return () => {
      invalidateRef.current = null;
    };
  }, [invalidate, invalidateRef]);
  return null;
}

export function WorkshopScene({
  structure,
  envelope,
  missFlashAt = 0,
  controlsRef,
  invalidateRef,
  onPartContextMenu,
}: WorkshopSceneProps) {
  const extent = useMemo(() => baseExtentMm(envelope), [envelope]);
  const interaction = useWorkshopInteraction(structure, extent);
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
  const showSharp = sharp && interaction.draggingId === null && interaction.rotatingId === null;

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
        projection="perspective"
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
        position={tilt ? [tilt.at[0], tilt.at[1], tilt.at[2]] : undefined}
        rotation={tilt ? [tilt.rotation[0], tilt.rotation[1], tilt.rotation[2]] : undefined}
      >
        <group
          position={tilt ? [-tilt.at[0], -tilt.at[1], -tilt.at[2]] : undefined}
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
              selected={interaction.selectedId === placed.selectId}
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
          {interaction.selectedId !== null &&
            interaction.draggingId === null &&
            interaction.pendingType === null &&
            (() => {
              const selectedPlaced = interaction.placedById.get(interaction.selectedId);
              return selectedPlaced ? (
                <RotationGizmo3D
                  placed={selectedPlaced}
                  baseW={w}
                  baseD={d}
                  active={interaction.rotatingId !== null}
                  onBeginRotate={interaction.beginPartRotate}
                />
              ) : null;
            })()}
          {interaction.rotatingId !== null &&
            (() => {
              const rotating = interaction.placedById.get(interaction.rotatingId);
              return (
                <RotationCatchPlane
                  baseW={w}
                  baseD={d}
                  z={(rotating ? rotating.topZ : 0) + ROTATION_RING_LIFT_MM}
                  onRotateMove={interaction.onRotateMove}
                  sceneFromWorld={sceneFromWorld}
                />
              );
            })()}
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

/**
 * While the gizmo is grabbed, every pointer move must resolve to a world
 * point on the ring's plane regardless of what is underneath — same trick
 * as DragCatchPlane, at the ring's height so the angle has no parallax.
 */
function RotationCatchPlane({
  baseW,
  baseD,
  z,
  onRotateMove,
  sceneFromWorld,
}: {
  baseW: number;
  baseD: number;
  z: number;
  onRotateMove: (world: { x: number; y: number }) => void;
  sceneFromWorld: (point: Vector3) => Vector3;
}) {
  return (
    <mesh
      position={[0, 0, z]}
      onPointerMove={(e) => {
        const local = sceneFromWorld(e.point);
        onRotateMove({
          x: sceneToStore(local.x, baseW),
          y: sceneToStore(local.y, baseD),
        });
      }}
    >
      <planeGeometry args={[baseW * 6, baseD * 6]} />
      <meshBasicMaterial visible={false} />
    </mesh>
  );
}

/**
 * While a part is dragged, pointer moves over empty space still need a
 * surface — an oversized invisible plane at the base floor answers them.
 */
function DragCatchPlane({
  baseW,
  baseD,
  onSurfaceMove,
  sceneFromWorld,
}: {
  baseW: number;
  baseD: number;
  onSurfaceMove: (surface: HoverSurface) => void;
  sceneFromWorld: (point: Vector3) => Vector3;
}) {
  return (
    <mesh
      position={[0, 0, -0.05]}
      onPointerMove={(e) => {
        const local = sceneFromWorld(e.point);
        onSurfaceMove({
          parentId: null,
          topZ: 0,
          x: sceneToStore(local.x, baseW),
          y: sceneToStore(local.y, baseD),
        });
      }}
    >
      <planeGeometry args={[baseW * 4, baseD * 4]} />
      <meshBasicMaterial visible={false} />
    </mesh>
  );
}

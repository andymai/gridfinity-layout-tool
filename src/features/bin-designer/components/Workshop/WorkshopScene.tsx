/** Scene composition for the Workshop editor: base, parts, ghost, controls. */
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsType } from 'three-stdlib';
import { useThree } from '@react-three/fiber';
import type { Group, Vector3 } from 'three';
import { OrthographicCamera, Vector3 as Vector3Impl } from 'three';
import { GradientBackground } from '@/shared/components/preview/GradientBackground';
import { CameraRig, type Projection } from '@/shared/components/preview/CameraRig';
import {
  CAMERA_FOV,
  SceneLighting,
} from '@/features/bin-designer/components/PreviewCanvas/previewCanvasCamera';
import { FootprintGrid } from '@/features/bin-designer/components/preview/FootprintGrid/FootprintGrid';
import type { AssemblyStructure } from '@/shared/types/assembly';
import type { ItemEnvelope } from '@/shared/types/item';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { partFootprint } from '@/shared/types/assemblyPlacement';
import { distanceToOrthoZoom } from '@/shared/utils/cameraProjection';
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
import {
  baseExtentMm,
  ROTATION_RING_LIFT_MM,
  sceneToStore,
  storeToScene,
  type PlacedPart,
} from './workshopPlacement';
import { useWorkshopInteraction, type HoverSurface } from './useWorkshopInteraction';

/** Screen-space rectangle in canvas-relative CSS pixels. */
export interface MarqueeRect {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

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

/** Projects part centers to canvas pixels so the DOM marquee can pick them. */
function ScenePickBridge({
  pickRef,
  placements,
  flatFrameRef,
  baseW,
  baseD,
}: {
  pickRef: RefObject<((rect: MarqueeRect) => string[]) | null>;
  placements: PlacedPart[];
  flatFrameRef: RefObject<Group | null>;
  baseW: number;
  baseD: number;
}) {
  const { camera, size } = useThree();
  useEffect(() => {
    pickRef.current = (rect: MarqueeRect): string[] => {
      const point = new Vector3Impl();
      const ids = new Set<string>();
      for (const placed of placements) {
        point.set(
          storeToScene(placed.x, baseW),
          storeToScene(placed.y, baseD),
          (placed.z + placed.topZ) / 2
        );
        flatFrameRef.current?.localToWorld(point);
        point.project(camera);
        const sx = (point.x * 0.5 + 0.5) * size.width;
        const sy = (1 - (point.y * 0.5 + 0.5)) * size.height;
        if (sx >= rect.minX && sx <= rect.maxX && sy >= rect.minY && sy <= rect.maxY) {
          ids.add(placed.selectId);
        }
      }
      return [...ids];
    };
    return () => {
      pickRef.current = null;
    };
  }, [baseD, baseW, camera, flatFrameRef, pickRef, placements, size.height, size.width]);
  return null;
}

const FRAME_MS = 350;
const FRAME_FILL = 0.65;

/**
 * Zoom-to-selection: tween the orbit target to the selection's center and
 * the camera to a distance that fits its bounding sphere, keeping the
 * current view direction. No selection frames the whole build.
 */
function FrameSelectionBridge({
  frameRef,
  controlsRef,
  placements,
  flatFrameRef,
  baseW,
  baseD,
}: {
  frameRef: RefObject<(() => void) | null>;
  controlsRef?: RefObject<OrbitControlsType | null>;
  placements: PlacedPart[];
  flatFrameRef: RefObject<Group | null>;
  baseW: number;
  baseD: number;
}) {
  const { camera, invalidate, size } = useThree();
  const animRef = useRef<number | null>(null);
  const placementsRef = useRef(placements);
  useEffect(() => {
    placementsRef.current = placements;
  }, [placements]);

  const frame = useCallback((): void => {
    const controls = controlsRef?.current;
    if (!controls) return;
    const selection = new Set(useDesignerStore.getState().ui.selectedAssemblyPartIds);
    const all = placementsRef.current;
    const targets = selection.size > 0 ? all.filter((p) => selection.has(p.selectId)) : all;

    let center: Vector3;
    let radius: number;
    if (targets.length === 0) {
      center = new Vector3Impl(0, 0, 10);
      radius = Math.hypot(baseW, baseD) / 2;
    } else {
      let minX = Infinity;
      let minY = Infinity;
      let minZ = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      let maxZ = -Infinity;
      for (const placed of targets) {
        const footprint = partFootprint(placed.node);
        const half = Math.max(footprint.w, footprint.d) / 2;
        minX = Math.min(minX, storeToScene(placed.x, baseW) - half);
        maxX = Math.max(maxX, storeToScene(placed.x, baseW) + half);
        minY = Math.min(minY, storeToScene(placed.y, baseD) - half);
        maxY = Math.max(maxY, storeToScene(placed.y, baseD) + half);
        minZ = Math.min(minZ, placed.z);
        maxZ = Math.max(maxZ, placed.topZ);
      }
      center = new Vector3Impl((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2);
      radius = Math.max(10, Math.hypot(maxX - minX, maxY - minY, maxZ - minZ) / 2);
    }
    flatFrameRef.current?.localToWorld(center);

    const halfFovRad = (CAMERA_FOV / 2) * (Math.PI / 180);
    const distance = (radius / Math.sin(halfFovRad)) * (1 / FRAME_FILL);
    const direction = camera.position.clone().sub(controls.target).normalize();
    const targetPos = direction.multiplyScalar(distance).add(center);

    const startPos = camera.position.clone();
    const startTarget = controls.target.clone();
    const ortho = camera instanceof OrthographicCamera ? camera : null;
    const startZoom = ortho?.zoom ?? 1;
    const targetZoom =
      ortho && size.height > 0 ? distanceToOrthoZoom(distance, CAMERA_FOV, size.height) : 1;
    const startTime = performance.now();
    if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    const step = (): void => {
      const progress = Math.min((performance.now() - startTime) / FRAME_MS, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      camera.position.lerpVectors(startPos, targetPos, eased);
      controls.target.lerpVectors(startTarget, center, eased);
      if (ortho) {
        ortho.zoom = startZoom + (targetZoom - startZoom) * eased;
        ortho.updateProjectionMatrix();
      }
      controls.update();
      invalidate();
      animRef.current = progress < 1 ? requestAnimationFrame(step) : null;
    };
    step();
  }, [baseD, baseW, camera, controlsRef, flatFrameRef, invalidate, size.height]);

  useEffect(() => {
    frameRef.current = frame;
    return () => {
      frameRef.current = null;
    };
  }, [frame, frameRef]);

  useEffect(() => {
    const down = (e: KeyboardEvent): void => {
      if (e.key !== 'f' && e.key !== 'F') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      frame();
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [frame]);

  useEffect(
    () => () => {
      if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    },
    []
  );
  return null;
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

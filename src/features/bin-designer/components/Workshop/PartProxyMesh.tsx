/**
 * One placed part instance rendered as its client-side proxy geometry.
 *
 * While the sharp worker mesh is displayed the proxy hides itself but stays
 * in the scene as the raycast target for selection and drag. A newly placed
 * part materializes with a hologram scan-in: a world-space clipping plane
 * sweeps up its height under a cyan emissive glow that settles to solid.
 */
import { useEffect, useMemo, useRef } from 'react';
import { DoubleSide, Plane, Vector3 } from 'three';
import type { MeshStandardMaterial } from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { useThreeColors } from '@/shared/hooks/useThemeEffect';
import { usePrefersReducedMotion } from '@/shared/hooks/usePrefersReducedMotion';
import { partSeatHeight } from '@/shared/types/assemblyPlacement';
import { buildPartGeometry } from './proxyGeometry';
import { sceneToStore, storeToScene, type PlacedPart } from './workshopPlacement';
import type { HoverSurface } from './useWorkshopInteraction';

interface PartProxyMeshProps {
  placed: PlacedPart;
  baseW: number;
  baseD: number;
  selected: boolean;
  raycastDisabled: boolean;
  /** Sharp worker mesh is on screen — render nothing, keep raycast alive. */
  hidden: boolean;
  mirrorAxis: 'x' | 'y';
  /** performance.now() at placement, when this instance should scan in. */
  hologramStart: number | null;
  onHologramEnd: (id: string) => void;
  onSurfaceMove: (surface: HoverSurface) => void;
  onSurfaceLeave: () => void;
  onSurfaceClick: (surface: HoverSurface) => void;
  onPartPointerDown: (
    id: string,
    pointerType: string,
    modifiers?: { shiftKey: boolean; altKey: boolean }
  ) => void;
  onPartContextMenu?: (id: string, clientX: number, clientY: number) => void;
  /** World → flat placement frame (identity unless the base is wedged). */
  sceneFromWorld?: (point: Vector3) => Vector3;
}

const DEG = Math.PI / 180;
const SCAN_MS = 400;
const FADE_MS = 150;
const NO_RAYCAST = (): null => null;

export function PartProxyMesh({
  placed,
  baseW,
  baseD,
  selected,
  raycastDisabled,
  hidden,
  mirrorAxis,
  hologramStart,
  onHologramEnd,
  onSurfaceMove,
  onSurfaceLeave,
  onSurfaceClick,
  onPartPointerDown,
  onPartContextMenu,
  sceneFromWorld,
}: PartProxyMeshProps) {
  const colors = useThreeColors();
  const reducedMotion = usePrefersReducedMotion();
  const invalidate = useThree((s) => s.invalidate);
  const { node } = placed;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on type + params, not node identity: drags path-copy the node and every ancestor per pointermove while params stay reference-equal, and a rebuild here re-uploads geometry for the whole chain each frame
  const geometry = useMemo(() => buildPartGeometry(node), [node.type, node.params]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const materialRef = useRef<MeshStandardMaterial>(null);
  const clipPlaneRef = useRef<Plane | null>(null);
  const animating = hologramStart !== null;

  const sweep = useMemo(() => {
    const height = partSeatHeight(node);
    const isCutter = node.type === 'cutter';
    return {
      from: isCutter && node.type === 'cutter' ? placed.z - node.params.depth : placed.z,
      to: isCutter ? placed.z + 0.5 : placed.z + Math.max(height, 1),
    };
  }, [node, placed.z]);

  // The scan is driven imperatively: render never touches the clipping
  // plane, so the material swap at completion can't cascade renders.
  useEffect(() => {
    if (hologramStart === null) return;
    const material = materialRef.current;
    if (!material) return;
    if (reducedMotion) {
      material.transparent = true;
      material.opacity = 0;
    } else {
      clipPlaneRef.current ??= new Plane(new Vector3(0, 0, -1), 0);
      clipPlaneRef.current.constant = sweep.from;
      material.clippingPlanes = [clipPlaneRef.current];
    }
    invalidate();
    return () => {
      material.clippingPlanes = null;
    };
  }, [hologramStart, reducedMotion, sweep, invalidate]);

  useFrame(() => {
    const material = materialRef.current;
    if (!material || hologramStart === null) return;
    const cutter = node.type === 'cutter';
    const elapsed = performance.now() - hologramStart;
    const duration = reducedMotion ? FADE_MS : SCAN_MS;
    const t = Math.min(elapsed / duration, 1);
    if (reducedMotion) {
      material.opacity = t * (cutter ? 0.45 : 1);
    } else {
      const plane = clipPlaneRef.current;
      if (plane) plane.constant = sweep.from + (sweep.to - sweep.from) * t;
      material.emissiveIntensity = 0.9 * (1 - t) + 0.1;
    }
    if (t >= 1) {
      material.clippingPlanes = null;
      material.emissiveIntensity = selected ? 0.25 : 0;
      material.transparent = cutter;
      material.opacity = cutter ? 0.45 : 1;
      onHologramEnd(placed.selectId);
    }
    invalidate();
  });

  const isCutter = node.type === 'cutter';
  const color = selected
    ? colors.workshopPartSelected
    : isCutter
      ? colors.workshopGhost
      : colors.workshopPart;
  const showSolid = !hidden || selected || animating;

  const toSurface = (e: ThreeEvent<PointerEvent | MouseEvent>): HoverSurface => {
    const local = sceneFromWorld ? sceneFromWorld(e.point) : e.point;
    return toSurfaceFromLocal(local);
  };
  const toSurfaceFromLocal = (local: { x: number; y: number }): HoverSurface => ({
    parentId: placed.selectId,
    topZ: placed.topZ,
    x: sceneToStore(local.x, baseW),
    y: sceneToStore(local.y, baseD),
  });

  return (
    <mesh
      geometry={geometry}
      position={[storeToScene(placed.x, baseW), storeToScene(placed.y, baseD), placed.z]}
      rotation={[0, 0, placed.rotZDeg * DEG]}
      scale={placed.mirrored ? (mirrorAxis === 'x' ? [-1, 1, 1] : [1, -1, 1]) : [1, 1, 1]}
      {...(raycastDisabled ? { raycast: NO_RAYCAST } : {})}
      onPointerMove={(e) => {
        e.stopPropagation();
        onSurfaceMove(toSurface(e));
      }}
      onPointerLeave={onSurfaceLeave}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        onPartPointerDown(placed.selectId, e.pointerType, {
          shiftKey: e.nativeEvent.shiftKey,
          altKey: e.nativeEvent.altKey,
        });
      }}
      onContextMenu={(e) => {
        e.stopPropagation();
        e.nativeEvent.preventDefault();
        onPartContextMenu?.(placed.selectId, e.nativeEvent.clientX, e.nativeEvent.clientY);
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSurfaceClick(toSurface(e));
      }}
    >
      <meshStandardMaterial
        ref={materialRef}
        side={DoubleSide}
        visible={showSolid}
        color={color}
        roughness={0.6}
        metalness={0.1}
        transparent={isCutter || (hidden && selected)}
        opacity={hidden && selected ? 0.4 : isCutter ? 0.45 : 1}
        polygonOffset={hidden && selected}
        polygonOffsetFactor={-2}
        polygonOffsetUnits={-2}
        emissive={animating ? colors.workshopGhost : colors.workshopPartSelected}
        emissiveIntensity={animating ? 0.9 : selected ? 0.25 : 0}
      />
    </mesh>
  );
}

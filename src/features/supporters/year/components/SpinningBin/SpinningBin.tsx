import { useLayoutEffect, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useMeshGeometry } from '@/shared/components/preview/useMeshGeometry';
import type { MeshData } from '@/shared/types/generation';
import type { YearMesh } from '../../hooks/useYearMeshes';
import type { ModelLook } from '../../cards/scene';
import {
  PRINT_LAYERS,
  layerStarts,
  layerWeights,
  printStateAt,
  type PrintState,
} from '../../look/printLayers';
import { assemblyBox, assemblyParts, type PlacedPart } from './assembly';

/** The assembly's bounding sphere, in scene units. */
const FIT_RADIUS = 1.6;
const WHOLE: PrintState = { printed: 1, hotFrom: 0, hotOpacity: 0 };

export interface PrintTiming {
  /** Seconds into the card when the first layer lands. */
  readonly start: number;
  readonly span: number;
}

export interface SpinningBinProps {
  readonly mesh: MeshData;
  readonly restOffset?: YearMesh['restOffset'];
  readonly label: string;
  readonly look: ModelLook;
  /** Degrees about the vertical axis; the card computes it from its clock. */
  readonly angle: number;
  /** Card seconds for the print effect, or null to draw the part whole. */
  readonly printTime?: number | null;
  readonly printTiming?: PrintTiming;
  /** Device pixels per layout pixel, so the canvas matches the screen at any card scale. */
  readonly resolution: number;
}

interface Planes {
  /** Keeps what lies at or below the print height. */
  readonly top: THREE.Plane;
  /** Keeps what lies above the newest layer's base, for the hot band. */
  readonly low: THREE.Plane;
}

function Part({
  part,
  look,
  planes,
  hot,
}: {
  readonly part: PlacedPart;
  readonly look: ModelLook;
  readonly planes: Planes;
  readonly hot: PrintState;
}) {
  const { data, offset } = part;
  const { geometry, edgesGeometry } = useMeshGeometry({
    vertices: data.vertices,
    normals: data.normals,
    indices: data.indices,
    edgeVertices: data.edgeVertices,
  });
  if (!geometry) return null;
  const clipTop = [planes.top];
  return (
    <group position={[offset[0], offset[1], offset[2]]}>
      <mesh geometry={geometry}>
        <meshStandardMaterial
          color={look.tint}
          roughness={0.6}
          metalness={0}
          side={THREE.DoubleSide}
          clippingPlanes={clipTop}
        />
      </mesh>
      {edgesGeometry && (
        <lineSegments geometry={edgesGeometry}>
          <lineBasicMaterial
            color={look.edge}
            transparent
            opacity={look.edgeOpacity}
            clippingPlanes={clipTop}
          />
        </lineSegments>
      )}
      <mesh geometry={geometry} renderOrder={2} visible={hot.hotOpacity > 0.002}>
        <meshBasicMaterial
          color="#ffffff"
          side={THREE.DoubleSide}
          transparent
          opacity={hot.hotOpacity}
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
          clippingPlanes={[planes.top, planes.low]}
        />
      </mesh>
    </group>
  );
}

/** Points the camera at the part from the card's elevation, the whole sphere in frame. */
function Rig({ look, height, radius }: { look: ModelLook; height: number; radius: number }) {
  const set = useThree((state) => state.set);
  const invalidate = useThree((state) => state.invalidate);
  const size = useThree((state) => state.size);
  const aspect = size.height > 0 ? size.width / size.height : 1.5;
  const camera = useMemo(() => {
    const half = THREE.MathUtils.degToRad(look.fov / 2);
    const distance = (radius / Math.sin(half)) * look.fit;
    const elevation = THREE.MathUtils.degToRad(look.elevation);
    const next = new THREE.PerspectiveCamera(look.fov, aspect, 0.05, 100);
    next.position.set(
      0,
      height * 0.4 + Math.sin(elevation) * distance,
      Math.cos(elevation) * distance
    );
    next.lookAt(0, height * 0.4, 0);
    return next;
  }, [look, height, radius, aspect]);
  useLayoutEffect(() => {
    set({ camera });
    invalidate();
  }, [set, invalidate, camera]);
  return null;
}

function Assembly({
  mesh,
  restOffset,
  look,
  angle,
  printTime,
  printTiming,
}: Omit<SpinningBinProps, 'label' | 'resolution'>) {
  const parts = useMemo(() => assemblyParts(mesh, restOffset), [mesh, restOffset]);
  const box = useMemo(() => assemblyBox(parts), [parts]);
  const scale = box.radius > 0 ? FIT_RADIUS / box.radius : 1;
  const height = (box.max[2] - box.min[2]) * scale;
  const starts = useMemo(() => {
    if (!printTiming) return null;
    const weights = Array.from({ length: PRINT_LAYERS }, () => 0);
    for (const part of parts) {
      layerWeights(part.data.vertices, part.data.indices, PRINT_LAYERS).forEach((weight, k) => {
        weights[k] = (weights[k] ?? 0) + weight;
      });
    }
    return layerStarts(weights, printTiming.start, printTiming.span);
  }, [parts, printTiming]);
  const state =
    printTime === null || printTime === undefined || !starts
      ? WHOLE
      : printStateAt(starts, printTime);
  // World y runs from 0 at the part's base to `height` at its top.
  const topAt = state.printed >= 1 ? 1e6 : state.printed * height;
  const lowAt = state.hotFrom * height;
  const planes = useMemo<Planes>(
    () => ({
      top: new THREE.Plane(new THREE.Vector3(0, -1, 0), topAt),
      low: new THREE.Plane(new THREE.Vector3(0, 1, 0), -lowAt),
    }),
    [topAt, lowAt]
  );
  return (
    <>
      <Rig look={look} height={height} radius={FIT_RADIUS} />
      <group rotation={[0, THREE.MathUtils.degToRad(angle), 0]} visible={state.printed > 0}>
        {/* The worker meshes Z-up; the scene is Y-up. */}
        <group rotation={[-Math.PI / 2, 0, 0]} scale={scale}>
          <group position={[-box.center[0], -box.center[1], -box.min[2]]}>
            {parts.map((part, index) => (
              <Part key={index} part={part} look={look} planes={planes} hot={state} />
            ))}
          </group>
        </group>
      </group>
    </>
  );
}

/**
 * One generated bin and its printed companions, tinted into its card: the
 * plastic in the card's hue, the edges and the ground light in its ink. The
 * canvas draws on demand, when the card's time changes, and keeps its buffer
 * so the share image can copy it.
 */
export function SpinningBin({ label, resolution, ...rest }: SpinningBinProps) {
  const { look } = rest;
  return (
    <div className="h-full w-full" role="img" aria-label={label}>
      <Canvas
        dpr={resolution}
        flat
        frameloop="demand"
        resize={{ offsetSize: true }}
        camera={{ fov: look.fov, position: [0, 2, 7], near: 0.05, far: 100 }}
        gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
        onCreated={({ gl }) => {
          gl.localClippingEnabled = true;
        }}
      >
        <hemisphereLight args={[look.sky, look.ground, 2.4]} />
        <directionalLight position={[-1.4, 2.4, 1.8]} intensity={2.2} color="#ffffff" />
        <directionalLight position={[1.8, 0.7, -1.6]} intensity={1.6} color={look.rim} />
        <Assembly {...rest} />
      </Canvas>
    </div>
  );
}

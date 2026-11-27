import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { useMeshGeometry } from '@/shared/components/preview/useMeshGeometry';
import type { MeshData } from '@/shared/types/generation';
import type { YearMesh } from '../../hooks/useYearMeshes';
import { assemblyBox, assemblyParts, type PlacedPart } from './assembly';

const PLASTIC = '#d4d8dc';
/** Radians per second of story time; slow enough to read the part. */
const SPIN_RATE = 0.45;
/** The pose at time zero, turned so two walls show. */
const START_YAW = -0.7;
/**
 * The assembly's bounding sphere, in scene units. The camera sits about 6.8
 * units out with a 30° view, so a sphere up to 1.75 fits; the rest is margin.
 */
const FIT_RADIUS = 1.6;

export interface SpinningBinProps {
  readonly mesh: MeshData;
  readonly restOffset?: YearMesh['restOffset'];
  /**
   * Seconds the bin has turned. The card passes its story-clock time, so a
   * pause, a hold or a seek moves the bin with the rest of the card.
   */
  readonly turnSeconds: number;
  readonly label: string;
}

function Part({ part }: { readonly part: PlacedPart }) {
  const { data, offset } = part;
  const { geometry, edgesGeometry } = useMeshGeometry({
    vertices: data.vertices,
    normals: data.normals,
    indices: data.indices,
    edgeVertices: data.edgeVertices,
  });
  if (!geometry) return null;
  return (
    <group position={[offset[0], offset[1], offset[2]]}>
      <mesh geometry={geometry}>
        <meshStandardMaterial color={PLASTIC} roughness={0.55} metalness={0.05} />
      </mesh>
      {edgesGeometry && (
        <lineSegments geometry={edgesGeometry}>
          <lineBasicMaterial color="#000000" transparent opacity={0.35} />
        </lineSegments>
      )}
    </group>
  );
}

function Assembly({ mesh, restOffset, turnSeconds }: Omit<SpinningBinProps, 'label'>) {
  const parts = useMemo(() => assemblyParts(mesh, restOffset), [mesh, restOffset]);
  const { center, radius } = useMemo(() => assemblyBox(parts), [parts]);
  const scale = radius > 0 ? FIT_RADIUS / radius : 1;
  return (
    <group rotation={[0, START_YAW + turnSeconds * SPIN_RATE, 0]}>
      {/* The worker meshes Z-up; the scene is Y-up. */}
      <group rotation={[-Math.PI / 2, 0, 0]} scale={scale}>
        <group position={[-center[0], -center[1], -center[2]]}>
          {parts.map((part, index) => (
            <Part key={index} part={part} />
          ))}
        </group>
      </group>
    </group>
  );
}

/**
 * One generated bin and its printed companions, turning slowly. The canvas
 * draws on demand, when the card's time changes. The drawing buffer is kept
 * so the share image can copy the canvas.
 */
export function SpinningBin({ mesh, restOffset, turnSeconds, label }: SpinningBinProps) {
  return (
    <div className="h-full w-full" role="img" aria-label={label}>
      <Canvas
        dpr={[1, 2]}
        frameloop="demand"
        camera={{ fov: 30, position: [0, 2.2, 6.4], near: 0.1, far: 50 }}
        gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
      >
        <ambientLight intensity={0.55} />
        <directionalLight position={[3, 5, 4]} intensity={1.15} />
        <directionalLight position={[-4, 2, -3]} intensity={0.45} color="#b9c4d8" />
        <Assembly mesh={mesh} restOffset={restOffset} turnSeconds={turnSeconds} />
      </Canvas>
    </div>
  );
}

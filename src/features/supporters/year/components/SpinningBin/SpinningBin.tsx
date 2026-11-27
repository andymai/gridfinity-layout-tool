import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Center } from '@react-three/drei';
import type { Group } from 'three';
import { useMeshGeometry } from '@/shared/components/preview/useMeshGeometry';
import type { MeshData } from '@/shared/types/generation';

const PLASTIC = '#d4d8dc';
/** Radians per second; slow enough to read the part. */
const SPIN_RATE = 0.45;
/** The bin's longest side, in scene units, at the camera's framing. */
const FIT_SIZE = 2.6;

export interface SpinningBinProps {
  readonly mesh: MeshData;
  readonly spin: boolean;
  readonly label: string;
}

function BinModel({ mesh, spin }: Omit<SpinningBinProps, 'label'>) {
  const { geometry, edgesGeometry } = useMeshGeometry({
    vertices: mesh.vertices,
    normals: mesh.normals,
    indices: mesh.indices,
    edgeVertices: mesh.edgeVertices,
  });
  const turn = useRef<Group>(null);
  const scale = useMemo(() => {
    geometry?.computeBoundingBox();
    const box = geometry?.boundingBox;
    if (!box) return 1;
    const longest = Math.max(box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z);
    return longest > 0 ? FIT_SIZE / longest : 1;
  }, [geometry]);

  // R3F's frame loop runs on requestAnimationFrame, which the video capture controls.
  useFrame((_, delta) => {
    if (spin && turn.current) turn.current.rotation.y += delta * SPIN_RATE;
  });

  if (!geometry) return null;
  return (
    <group ref={turn} rotation={[0, -0.7, 0]}>
      {/* The worker meshes Z-up; the scene is Y-up. */}
      <group rotation={[-Math.PI / 2, 0, 0]} scale={scale}>
        <Center>
          <mesh geometry={geometry}>
            <meshStandardMaterial color={PLASTIC} roughness={0.55} metalness={0.05} />
          </mesh>
          {edgesGeometry && (
            <lineSegments geometry={edgesGeometry}>
              <lineBasicMaterial color="#000000" transparent opacity={0.35} />
            </lineSegments>
          )}
        </Center>
      </group>
    </group>
  );
}

/**
 * One generated bin turning slowly. The drawing buffer is kept so the share
 * image can copy the canvas.
 */
export function SpinningBin({ mesh, spin, label }: SpinningBinProps) {
  return (
    <div className="h-full w-full" role="img" aria-label={label}>
      <Canvas
        dpr={[1, 2]}
        frameloop={spin ? 'always' : 'demand'}
        camera={{ fov: 30, position: [0, 2.2, 6.4], near: 0.1, far: 50 }}
        gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
      >
        <ambientLight intensity={0.55} />
        <directionalLight position={[3, 5, 4]} intensity={1.15} />
        <directionalLight position={[-4, 2, -3]} intensity={0.45} color="#b9c4d8" />
        <BinModel mesh={mesh} spin={spin} />
      </Canvas>
    </div>
  );
}

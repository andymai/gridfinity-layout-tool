import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { BinRenderData } from '@/shared/hooks/useExplodedLayerView';
import { useBinGeometry } from '@/shared/hooks/useBinGeometry';
import type { BinTransition } from '../useBinTransitions';

interface AnimatedBinMeshProps {
  binData: BinRenderData;
  transition: BinTransition;
}

/**
 * A bin mesh that drives its own entrance (spring drop) or exit (shrink+fade)
 * animation via useFrame. Reads transition state directly from the mutable
 * ref managed by useBinTransitions — no per-frame React state updates.
 */
export function AnimatedBinMesh({ binData, transition }: AnimatedBinMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);

  const geometry = useBinGeometry({
    width: binData.bin.width,
    depth: binData.bin.depth,
    height: binData.height,
    baseColor: binData.color,
  });

  useFrame(() => {
    const mesh = meshRef.current;
    const material = materialRef.current;
    if (!mesh || !material) return;

    if (transition.phase === 'entering') {
      // Position: target z + spring offset (spring settles toward 0).
      mesh.position.set(binData.x, binData.y, binData.z + transition.springPos);
      mesh.scale.set(1, 1, 1);
      material.opacity = 1;
      material.transparent = false;
      material.depthWrite = true;
    } else {
      // Exiting: shrink and fade.
      mesh.position.set(binData.x, binData.y, binData.z);
      const s = transition.scale;
      mesh.scale.set(s, s, s);
      material.opacity = transition.opacity;
      material.transparent = transition.opacity < 1;
      material.depthWrite = transition.opacity === 1;
    }
  });

  // Initial position for entering bins (before first useFrame tick).
  const initialZ = transition.phase === 'entering' ? binData.z + transition.springPos : binData.z;

  return (
    <mesh ref={meshRef} position={[binData.x, binData.y, initialZ]} geometry={geometry}>
      <meshStandardMaterial
        ref={materialRef}
        vertexColors
        roughness={0.4}
        metalness={0}
        transparent={binData.opacity < 1}
        opacity={binData.opacity}
        depthWrite={binData.opacity === 1}
        flatShading={false}
        side={THREE.DoubleSide}
        emissive={binData.color}
        emissiveIntensity={0.15}
      />
    </mesh>
  );
}

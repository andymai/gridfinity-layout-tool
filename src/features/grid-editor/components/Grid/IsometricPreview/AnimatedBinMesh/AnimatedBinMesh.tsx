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
    dividers: binData.dividers,
  });

  useFrame(() => {
    const mesh = meshRef.current;
    const material = materialRef.current;
    if (!mesh || !material) return;

    let z: number;
    let scale: number;
    let opacity: number;
    if (transition.phase === 'entering') {
      // Spring settles toward 0 above target z.
      z = binData.z + transition.springPos;
      scale = 1;
      opacity = binData.opacity;
    } else {
      // Exiting: shrink and fade; compose with any dimming in binData.opacity.
      z = binData.z;
      scale = transition.scale;
      opacity = transition.opacity * binData.opacity;
    }

    mesh.position.set(binData.x, binData.y, z);
    mesh.scale.set(scale, scale, scale);
    material.opacity = opacity;
    material.transparent = opacity < 1;
    material.depthWrite = opacity === 1;
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

/** Translucent preview of the armed palette part at the hovered surface. */
import { useEffect, useMemo } from 'react';
import { useThreeColors } from '@/shared/hooks/useThemeEffect';
import type { AssemblyPartType } from '@/shared/types/assembly';
import { createAssemblyPartNode, DEFAULT_PART_TRANSFORM } from '@/shared/items/assembly/descriptor';
import { buildPartGeometry } from './proxyGeometry';
import { storeToScene } from './workshopPlacement';

interface PlacementGhostProps {
  type: AssemblyPartType;
  /** Snapped store-frame position, computed by the interaction hook. */
  position: { x: number; y: number; z: number };
  baseW: number;
  baseD: number;
}

export function PlacementGhost({ type, position, baseW, baseD }: PlacementGhostProps) {
  const colors = useThreeColors();
  const geometry = useMemo(
    () => buildPartGeometry(createAssemblyPartNode(type, 'ghost', { ...DEFAULT_PART_TRANSFORM })),
    [type]
  );
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh
      geometry={geometry}
      position={[storeToScene(position.x, baseW), storeToScene(position.y, baseD), position.z]}
      raycast={() => null}
    >
      <meshStandardMaterial
        color={colors.workshopGhost}
        transparent
        opacity={0.5}
        depthWrite={false}
      />
    </mesh>
  );
}

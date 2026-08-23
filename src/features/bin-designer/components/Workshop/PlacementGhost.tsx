/** Translucent preview of the armed palette part at the hovered surface. */
import { useEffect, useMemo } from 'react';
import { useThreeColors } from '@/shared/hooks/useThemeEffect';
import type { AssemblyPartNode, AssemblyPartType } from '@/shared/types/assembly';
import {
  createAssemblyPartNode,
  defaultCutterProfile,
  DEFAULT_PART_TRANSFORM,
} from '@/shared/items/assembly/descriptor';
import { buildPartGeometry } from './proxyGeometry';
import { storeToScene } from './workshopPlacement';

interface PlacementGhostProps {
  type: AssemblyPartType;
  cutterShape: 'circle' | 'slot' | null;
  /** Snapped store-frame pose (the target frame's rotation included). */
  position: { x: number; y: number; z: number; rotZDeg: number };
  baseW: number;
  baseD: number;
}

export function PlacementGhost({ type, cutterShape, position, baseW, baseD }: PlacementGhostProps) {
  const colors = useThreeColors();
  const geometry = useMemo(() => {
    const base = createAssemblyPartNode(type, 'ghost', { ...DEFAULT_PART_TRANSFORM });
    const node =
      type === 'cutter' && cutterShape
        ? ({
            ...base,
            params: { ...base.params, profile: defaultCutterProfile(cutterShape) },
          } as AssemblyPartNode)
        : base;
    return buildPartGeometry(node);
  }, [type, cutterShape]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh
      geometry={geometry}
      position={[storeToScene(position.x, baseW), storeToScene(position.y, baseD), position.z]}
      rotation={[0, 0, (position.rotZDeg * Math.PI) / 180]}
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

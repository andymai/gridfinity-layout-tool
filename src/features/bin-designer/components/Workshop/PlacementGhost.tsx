/** Translucent preview of the armed palette part at the hovered surface. */
import { useEffect, useMemo } from 'react';
import { useThreeColors } from '@/shared/hooks/useThemeEffect';
import type { AssemblyPartType } from '@/shared/types/assembly';
import { createAssemblyPartNode, DEFAULT_PART_TRANSFORM } from '@/shared/items/assembly/descriptor';
import { buildPartGeometry } from './proxyGeometry';
import { snapCoord, storeToScene } from './workshopPlacement';
import type { HoverSurface } from './useWorkshopInteraction';

interface PlacementGhostProps {
  type: AssemblyPartType;
  hover: HoverSurface;
  baseW: number;
  baseD: number;
}

export function PlacementGhost({ type, hover, baseW, baseD }: PlacementGhostProps) {
  const colors = useThreeColors();
  const geometry = useMemo(
    () => buildPartGeometry(createAssemblyPartNode(type, 'ghost', { ...DEFAULT_PART_TRANSFORM })),
    [type]
  );
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh
      geometry={geometry}
      position={[
        storeToScene(snapCoord(hover.x, false), baseW),
        storeToScene(snapCoord(hover.y, false), baseD),
        hover.topZ,
      ]}
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

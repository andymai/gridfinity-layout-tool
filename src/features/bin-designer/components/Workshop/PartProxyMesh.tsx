/** One placed part instance rendered as its client-side proxy geometry. */
import { useEffect, useMemo } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { useThreeColors } from '@/shared/hooks/useThemeEffect';
import { buildPartGeometry } from './proxyGeometry';
import { sceneToStore, storeToScene, type PlacedPart } from './workshopPlacement';
import type { HoverSurface } from './useWorkshopInteraction';

interface PartProxyMeshProps {
  placed: PlacedPart;
  baseW: number;
  baseD: number;
  selected: boolean;
  raycastDisabled: boolean;
  onSurfaceMove: (surface: HoverSurface) => void;
  onSurfaceLeave: () => void;
  onSurfaceClick: (surface: HoverSurface) => void;
  onPartPointerDown: (id: string, pointerId: number) => void;
}

const DEG = Math.PI / 180;
const NO_RAYCAST = (): null => null;

export function PartProxyMesh({
  placed,
  baseW,
  baseD,
  selected,
  raycastDisabled,
  onSurfaceMove,
  onSurfaceLeave,
  onSurfaceClick,
  onPartPointerDown,
}: PartProxyMeshProps) {
  const colors = useThreeColors();
  const { node } = placed;
  const geometry = useMemo(() => buildPartGeometry(node), [node]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const isCutter = node.type === 'cutter';
  const color = selected
    ? colors.workshopPartSelected
    : isCutter
      ? colors.workshopGhost
      : colors.workshopPart;

  const toSurface = (e: ThreeEvent<PointerEvent | MouseEvent>): HoverSurface => ({
    parentId: placed.selectId,
    topZ: placed.topZ,
    x: sceneToStore(e.point.x, baseW),
    y: sceneToStore(e.point.y, baseD),
  });

  return (
    <mesh
      geometry={geometry}
      position={[storeToScene(placed.x, baseW), storeToScene(placed.y, baseD), placed.z]}
      rotation={[0, 0, placed.rotZDeg * DEG]}
      raycast={raycastDisabled ? NO_RAYCAST : undefined}
      onPointerMove={(e) => {
        e.stopPropagation();
        onSurfaceMove(toSurface(e));
      }}
      onPointerLeave={onSurfaceLeave}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        onPartPointerDown(placed.selectId, e.pointerId);
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSurfaceClick(toSurface(e));
      }}
    >
      <meshStandardMaterial
        color={color}
        roughness={0.6}
        metalness={0.1}
        transparent={isCutter}
        opacity={isCutter ? 0.45 : 1}
        emissive={selected ? colors.workshopPartSelected : '#000000'}
        emissiveIntensity={selected ? 0.25 : 0}
      />
    </mesh>
  );
}

/**
 * Touch move handle: a grab disc floating above the selected part. Dragging
 * it runs the same transactioned move/re-seat machinery as a desktop part
 * drag, which is what keeps a one-finger drag on the part itself free to
 * orbit the camera on touch devices.
 */
import { useThreeColors } from '@/shared/hooks/useThemeEffect';
import type { PlacedPart } from './workshopPlacement';
import { storeToScene } from './workshopPlacement';

const HANDLE_LIFT_MM = 12;
const HANDLE_RADIUS_MM = 7;

interface MoveHandle3DProps {
  placed: PlacedPart;
  baseW: number;
  baseD: number;
  onBeginDrag: (id: string) => void;
}

export function MoveHandle3D({ placed, baseW, baseD, onBeginDrag }: MoveHandle3DProps) {
  const colors = useThreeColors();
  return (
    <mesh
      position={[
        storeToScene(placed.x, baseW),
        storeToScene(placed.y, baseD),
        placed.topZ + HANDLE_LIFT_MM,
      ]}
      onPointerDown={(e) => {
        e.stopPropagation();
        onBeginDrag(placed.selectId);
      }}
    >
      <sphereGeometry args={[HANDLE_RADIUS_MM, 20, 16]} />
      <meshStandardMaterial
        color={colors.workshopPartSelected}
        emissive={colors.workshopPartSelected}
        emissiveIntensity={0.35}
        transparent
        opacity={0.9}
      />
    </mesh>
  );
}

/**
 * In-canvas rotation gizmo. Renders at the interaction's rotation hub — a
 * single part's own ring, or a ring around a multi-selection's centroid.
 * The grab offset is captured at pointerdown so parts never jump to meet
 * the pointer, and rotation flows through the same transactioned move
 * machinery as a drag so undo captures one step.
 */
import { useThreeColors } from '@/shared/hooks/useThemeEffect';
import type { RotationHub } from './useWorkshopInteraction';
import { ROTATION_RING_LIFT_MM, sceneToStore, storeToScene } from './workshopPlacement';

const RING_TUBE_MM = 0.9;
const KNOB_RADIUS_MM = 2.6;

interface RotationGizmo3DProps {
  hub: RotationHub;
  baseW: number;
  baseD: number;
  active: boolean;
  onBeginRotate: (world: { x: number; y: number }) => void;
}

export function RotationGizmo3D({
  hub,
  baseW,
  baseD,
  active,
  onBeginRotate,
}: RotationGizmo3DProps) {
  const colors = useThreeColors();
  const headingRad = (hub.headingDeg * Math.PI) / 180;
  const z = hub.topZ + ROTATION_RING_LIFT_MM;
  const beginRotate = (e: {
    button: number;
    stopPropagation: () => void;
    point: { x: number; y: number };
  }): void => {
    if (e.button !== 0) return;
    e.stopPropagation();
    onBeginRotate({
      x: sceneToStore(e.point.x, baseW),
      y: sceneToStore(e.point.y, baseD),
    });
  };
  return (
    <group position={[storeToScene(hub.x, baseW), storeToScene(hub.y, baseD), z]}>
      <mesh onPointerDown={beginRotate} renderOrder={2}>
        <torusGeometry args={[hub.radius, RING_TUBE_MM, 10, 64]} />
        <meshStandardMaterial
          color={colors.workshopPartSelected}
          emissive={colors.workshopPartSelected}
          emissiveIntensity={active ? 0.6 : 0.3}
          transparent
          opacity={active ? 0.95 : 0.75}
        />
      </mesh>
      <mesh
        position={[hub.radius * Math.cos(headingRad), hub.radius * Math.sin(headingRad), 0]}
        onPointerDown={beginRotate}
        renderOrder={2}
      >
        <sphereGeometry args={[KNOB_RADIUS_MM, 16, 12]} />
        <meshStandardMaterial
          color={colors.workshopPartSelected}
          emissive={colors.workshopPartSelected}
          emissiveIntensity={0.5}
        />
      </mesh>
    </group>
  );
}

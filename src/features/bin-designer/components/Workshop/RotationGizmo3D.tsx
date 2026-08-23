/**
 * In-canvas rotation gizmo. The grab offset is captured at pointerdown so the
 * part never jumps to meet the pointer, and rotation flows through the same
 * transactioned move machinery as a drag so undo captures one step.
 */
import { useMemo } from 'react';
import { useThreeColors } from '@/shared/hooks/useThemeEffect';
import type { PlacedPart } from './workshopPlacement';
import {
  ROTATION_RING_LIFT_MM,
  rotationRingRadiusMm,
  sceneToStore,
  storeToScene,
} from './workshopPlacement';

const RING_TUBE_MM = 0.9;
const KNOB_RADIUS_MM = 2.6;

interface RotationGizmo3DProps {
  placed: PlacedPart;
  baseW: number;
  baseD: number;
  active: boolean;
  onBeginRotate: (id: string, world: { x: number; y: number }) => void;
}

export function RotationGizmo3D({
  placed,
  baseW,
  baseD,
  active,
  onBeginRotate,
}: RotationGizmo3DProps) {
  const colors = useThreeColors();
  const radius = useMemo(() => rotationRingRadiusMm(placed), [placed]);
  const headingRad = (placed.rotZDeg * Math.PI) / 180;
  const z = placed.topZ + ROTATION_RING_LIFT_MM;
  const beginRotate = (e: {
    button: number;
    stopPropagation: () => void;
    point: { x: number; y: number };
  }): void => {
    if (e.button !== 0) return;
    e.stopPropagation();
    onBeginRotate(placed.selectId, {
      x: sceneToStore(e.point.x, baseW),
      y: sceneToStore(e.point.y, baseD),
    });
  };
  return (
    <group position={[storeToScene(placed.x, baseW), storeToScene(placed.y, baseD), z]}>
      <mesh onPointerDown={beginRotate}>
        <torusGeometry args={[radius, RING_TUBE_MM, 10, 64]} />
        <meshStandardMaterial
          color={colors.workshopPartSelected}
          emissive={colors.workshopPartSelected}
          emissiveIntensity={active ? 0.6 : 0.3}
          transparent
          opacity={active ? 0.95 : 0.75}
        />
      </mesh>
      <mesh
        position={[radius * Math.cos(headingRad), radius * Math.sin(headingRad), 0]}
        onPointerDown={beginRotate}
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

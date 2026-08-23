/**
 * Drag-time alignment guides: thin emissive lines through the coordinate a
 * dragged part snapped to (a sibling's center, or the plate center). Guides
 * live in the target parent's frame, so on a rotated parent they draw rotated
 * with it — the line always shows the axis the part actually aligned along.
 */
import type { ReactElement } from 'react';
import { useThreeColors } from '@/shared/hooks/useThemeEffect';
import type { AlignGuides } from './useWorkshopInteraction';
import type { PlacedPart } from './workshopPlacement';
import { parentLocalToWorld, storeToScene } from './workshopPlacement';

const GUIDE_THICKNESS_MM = 0.5;
const GUIDE_HEIGHT_MM = 0.3;
const GUIDE_LIFT_MM = 0.2;

interface AlignmentGuidesProps {
  guides: AlignGuides;
  parent: PlacedPart | null;
  baseW: number;
  baseD: number;
}

export function AlignmentGuides({ guides, parent, baseW, baseD }: AlignmentGuidesProps) {
  const colors = useThreeColors();
  const length = Math.hypot(baseW, baseD);
  const parentRad = ((parent?.rotZDeg ?? 0) * Math.PI) / 180;
  const z = (parent ? parent.topZ : 0) + GUIDE_LIFT_MM;

  const line = (local: { x: number; y: number }, alongY: boolean): ReactElement => {
    const world = parentLocalToWorld(local, parent);
    return (
      <mesh
        position={[storeToScene(world.x, baseW), storeToScene(world.y, baseD), z]}
        rotation={[0, 0, parentRad + (alongY ? 0 : Math.PI / 2)]}
      >
        <boxGeometry args={[GUIDE_THICKNESS_MM, length, GUIDE_HEIGHT_MM]} />
        <meshStandardMaterial
          color={colors.workshopGhost}
          emissive={colors.workshopGhost}
          emissiveIntensity={0.8}
          transparent
          opacity={0.85}
        />
      </mesh>
    );
  };

  const center = parent ? { x: 0, y: 0 } : { x: guides.x ?? baseW / 2, y: guides.y ?? baseD / 2 };
  return (
    <>
      {guides.x !== null && line({ x: guides.x, y: parent ? 0 : center.y }, true)}
      {guides.y !== null && line({ x: parent ? 0 : center.x, y: guides.y }, false)}
    </>
  );
}

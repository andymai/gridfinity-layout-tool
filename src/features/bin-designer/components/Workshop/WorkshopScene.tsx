/** Scene composition for the Workshop editor: base, parts, ghost, controls. */
import { OrbitControls } from '@react-three/drei';
import { GradientBackground } from '@/shared/components/preview/GradientBackground';
import { CameraRig } from '@/shared/components/preview/CameraRig';
import { SceneLighting } from '@/features/bin-designer/components/PreviewCanvas/previewCanvasCamera';
import { FootprintGrid } from '@/features/bin-designer/components/preview/FootprintGrid/FootprintGrid';
import type { AssemblyStructure } from '@/shared/types/assembly';
import type { ItemEnvelope } from '@/shared/types/item';
import { BasePlateMesh } from './BasePlateMesh';
import { PartProxyMesh } from './PartProxyMesh';
import { PlacementGhost } from './PlacementGhost';
import { baseExtentMm, sceneToStore } from './workshopPlacement';
import { useWorkshopInteraction, type HoverSurface } from './useWorkshopInteraction';

interface WorkshopSceneProps {
  structure: AssemblyStructure;
  envelope: ItemEnvelope;
}

export function WorkshopScene({ structure, envelope }: WorkshopSceneProps) {
  const interaction = useWorkshopInteraction(structure);
  const { w, d } = baseExtentMm(envelope);
  const cameraDistance = Math.max(w, d) * 1.4 + 80;

  return (
    <>
      <CameraRig
        projection="perspective"
        initialPosition={[cameraDistance * 0.55, -cameraDistance * 0.55, cameraDistance * 0.45]}
        target={[0, 0, 15]}
        far={4000}
      />
      <GradientBackground />
      <SceneLighting />
      <FootprintGrid
        width={envelope.width}
        depth={envelope.depth}
        gridUnitMm={envelope.gridUnitMm}
      />
      <BasePlateMesh
        envelope={envelope}
        base={structure.base}
        onSurfaceMove={interaction.onSurfaceMove}
        onSurfaceLeave={interaction.onSurfaceLeave}
        onSurfaceClick={interaction.onSurfaceClick}
      />
      {interaction.placements.map((placed) => (
        <PartProxyMesh
          key={placed.key}
          placed={placed}
          baseW={w}
          baseD={d}
          selected={interaction.selectedId === placed.selectId}
          raycastDisabled={
            interaction.draggingId !== null && interaction.isInDraggedSubtree(placed.selectId)
          }
          onSurfaceMove={interaction.onSurfaceMove}
          onSurfaceLeave={interaction.onSurfaceLeave}
          onSurfaceClick={interaction.onSurfaceClick}
          onPartPointerDown={interaction.onPartPointerDown}
        />
      ))}
      {interaction.pendingType && interaction.hover && interaction.draggingId === null && (
        <PlacementGhost
          type={interaction.pendingType}
          hover={interaction.hover}
          baseW={w}
          baseD={d}
        />
      )}
      {interaction.draggingId !== null && (
        <DragCatchPlane baseW={w} baseD={d} onSurfaceMove={interaction.onSurfaceMove} />
      )}
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.12}
        minDistance={30}
        maxDistance={1500}
        maxPolarAngle={Math.PI * 0.85}
        target={[0, 0, 15]}
      />
    </>
  );
}

/**
 * While a part is dragged, pointer moves over empty space still need a
 * surface — an oversized invisible plane at the base floor answers them.
 */
function DragCatchPlane({
  baseW,
  baseD,
  onSurfaceMove,
}: {
  baseW: number;
  baseD: number;
  onSurfaceMove: (surface: HoverSurface) => void;
}) {
  return (
    <mesh
      position={[0, 0, -0.05]}
      onPointerMove={(e) => {
        onSurfaceMove({
          parentId: null,
          topZ: 0,
          x: sceneToStore(e.point.x, baseW),
          y: sceneToStore(e.point.y, baseD),
        });
      }}
    >
      <planeGeometry args={[baseW * 4, baseD * 4]} />
      <meshBasicMaterial visible={false} />
    </mesh>
  );
}

import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { useShallow } from 'zustand/react/shallow';
import { useBaseplatePageStore } from '../../store/baseplatePageStore';
import type { MarginMeshEntry } from '../../store/baseplatePageStore';
import { MESH_MATERIAL_PROPS, EDGE_MATERIAL_PROPS } from './materialProps';
import { useMeshGeometry } from './useMeshGeometry';
import { EXPLODE_GAP_MM } from '../../constants';

/** Extra outward gap (mm) so a rail reads as detached from its body piece. */
const MARGIN_OUTWARD_GAP_MM = 8;

/** Face opacity in xray mode (matches the body/split meshes). */
const XRAY_OPACITY = 0.3;

const SIDE_NORMAL: Record<MarginMeshEntry['side'], readonly [number, number]> = {
  left: [-1, 0],
  right: [1, 0],
  front: [0, -1],
  back: [0, 1],
};

function MarginRailMesh({
  entry,
  color,
  exploded,
  xray,
}: {
  entry: MarginMeshEntry;
  color: string;
  exploded: boolean;
  xray: boolean;
}) {
  const { invalidate } = useThree();
  const { geometry, edgesGeometry, hasPrecomputedNormals } = useMeshGeometry({
    vertices: entry.mesh.vertices,
    normals: entry.mesh.normals,
    indices: entry.mesh.indices,
    edgeVertices: entry.mesh.edgeVertices,
  });

  useEffect(() => {
    if (geometry) invalidate();
  }, [geometry, invalidate]);

  if (!geometry) return null;

  // In exploded view, track the adjacent body piece (col/row * gap, matching
  // SplitBaseplateMeshes) so segments move with their piece, then step outward
  // along the side normal so the rail visibly separates instead of overlapping.
  const [nx, ny] = SIDE_NORMAL[entry.side];
  const explodeX = exploded ? entry.col * EXPLODE_GAP_MM + nx * MARGIN_OUTWARD_GAP_MM : 0;
  const explodeY = exploded ? entry.row * EXPLODE_GAP_MM + ny * MARGIN_OUTWARD_GAP_MM : 0;
  const x = entry.worldOffsetMm.x + explodeX;
  const y = entry.worldOffsetMm.y + explodeY;

  return (
    <group position={[x, y, 0.1]}>
      <mesh geometry={geometry}>
        <meshStandardMaterial
          {...MESH_MATERIAL_PROPS}
          color={color}
          emissive={color}
          flatShading={!hasPrecomputedNormals}
          transparent={xray}
          opacity={xray ? XRAY_OPACITY : 1}
          depthWrite={!xray}
        />
      </mesh>
      {edgesGeometry && (
        <lineSegments geometry={edgesGeometry} renderOrder={1}>
          <lineBasicMaterial {...EDGE_MATERIAL_PROPS} />
        </lineSegments>
      )}
    </group>
  );
}

/**
 * Renders detached margin rails (issue #2392). Each rail mesh is centered at the
 * origin and placed by its `worldOffsetMm`; rails render in every mode (split or
 * not) whenever `detachMargins` produced them.
 */
export function MarginMeshes({ color, xray = false }: { color: string; xray?: boolean }) {
  const { marginMeshes, splitViewMode } = useBaseplatePageStore(
    useShallow((s) => ({ marginMeshes: s.marginMeshes, splitViewMode: s.splitViewMode }))
  );
  if (marginMeshes.length === 0) return null;

  const exploded = splitViewMode === 'exploded';

  return (
    <>
      {marginMeshes.map((entry) => (
        <MarginRailMesh
          key={entry.id}
          entry={entry}
          color={color}
          exploded={exploded}
          xray={xray}
        />
      ))}
    </>
  );
}

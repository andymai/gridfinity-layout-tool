import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { useShallow } from 'zustand/react/shallow';
import { useBaseplatePageStore } from '../../store/baseplatePageStore';
import type { MarginMeshEntry } from '../../store/baseplatePageStore';
import { MESH_MATERIAL_PROPS, EDGE_MATERIAL_PROPS } from './materialProps';
import { useMeshGeometry } from './useMeshGeometry';
import { railPosition } from './railPosition';
import type { StackFieldSize } from './railPosition';

/** Face opacity in xray mode (matches the body/split meshes). */
const XRAY_OPACITY = 0.3;

function MarginRailMesh({
  entry,
  color,
  exploded,
  xray,
  stackField,
}: {
  entry: MarginMeshEntry;
  color: string;
  exploded: boolean;
  xray: boolean;
  stackField?: StackFieldSize | null;
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

  const { x, y } = railPosition(entry, exploded, stackField);

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
 * origin and placed by its `worldOffsetMm`; rails render in every mode (split,
 * unsplit, or stacked) whenever `detachMargins` produced them. In stack-print
 * mode pass `stackField` so rails ring the tower field instead of the absent
 * assembled body (#2641).
 */
export function MarginMeshes({
  color,
  xray = false,
  stackField,
}: {
  color: string;
  xray?: boolean;
  stackField?: StackFieldSize | null;
}) {
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
          stackField={stackField}
        />
      ))}
    </>
  );
}

/**
 * The flat understructure of a wedged build: the socket slab and the plinth
 * whose inclined top the tilted deck sits on — mirroring the worker's filler,
 * which never tilts the socket.
 */
import { useEffect, useMemo } from 'react';
import { ExtrudeGeometry } from 'three';
import type { BufferGeometry } from 'three';
import { useThreeColors } from '@/shared/hooks/useThemeEffect';
import type { ItemEnvelope } from '@/shared/types/item';
import type { AssemblyBase, AssemblyWedge } from '@/shared/types/assembly';
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';
import { baseExtentMm } from './workshopPlacement';
import { roundedRectShape } from './proxyGeometry';

interface WedgeFillerMeshProps {
  envelope: ItemEnvelope;
  base: AssemblyBase;
  wedge: AssemblyWedge;
}

export function WedgeFillerMesh({ envelope, base, wedge }: WedgeFillerMeshProps) {
  const colors = useThreeColors();
  const { w, d } = baseExtentMm(envelope);
  const floorThickness = base.floorThickness;
  const cornerRadius = Math.min(base.cornerRadius ?? 4, w / 2, d / 2);

  const geometries = useMemo((): BufferGeometry[] => {
    const socketHeight = GRIDFINITY_SPEC.SOCKET_HEIGHT;
    const socket = new ExtrudeGeometry(roundedRectShape(w, d, cornerRadius), {
      depth: socketHeight,
      bevelEnabled: false,
    });
    socket.translate(0, 0, -(socketHeight + floorThickness));

    const rad = (wedge.angleDeg * Math.PI) / 180;
    const tan = Math.tan(rad);
    const planeHeight = (x: number, y: number): number => {
      switch (wedge.lowEdge) {
        case 'front':
          return (y + d / 2) * tan;
        case 'back':
          return (d / 2 - y) * tan;
        case 'left':
          return (x + w / 2) * tan;
        default:
          return (w / 2 - x) * tan;
      }
    };
    // A unit-depth extrusion whose top ring is displaced onto the inclined
    // plane: the plane is linear in x/y, so straight wall segments and the
    // cap triangulation land on it exactly. The low wall keeps the worker's
    // blunt minimum face instead of tapering to a knife edge.
    const plinth = new ExtrudeGeometry(roundedRectShape(w, d, cornerRadius), {
      depth: 1,
      bevelEnabled: false,
    });
    const pos = plinth.attributes.position;
    for (let i = 0; i < pos.count; i += 1) {
      if (pos.getZ(i) > 0.5) {
        pos.setZ(i, Math.max(0.3, planeHeight(pos.getX(i), pos.getY(i))));
      }
    }
    plinth.computeVertexNormals();
    plinth.translate(0, 0, -floorThickness);
    return [socket, plinth];
  }, [cornerRadius, d, floorThickness, w, wedge.angleDeg, wedge.lowEdge]);

  useEffect(() => () => geometries.forEach((g) => g.dispose()), [geometries]);

  return (
    <>
      {geometries.map((geometry, i) => (
        <mesh key={i} geometry={geometry} raycast={() => null}>
          <meshStandardMaterial color={colors.workshopBase} roughness={0.85} metalness={0.05} />
        </mesh>
      ))}
    </>
  );
}

import { useEffect, useMemo, useRef } from 'react';
import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Matrix4,
  SRGBColorSpace,
  type InstancedMesh,
} from 'three';
import type { ZonedLayout } from '../../utils/supportersLayout';
import type { SupportersPalette } from '../../scene/palette';
import { createPlateLabelTexture } from '../../scene/labelTexture';
import { MESH_META } from '../../data/meshes';
import type { BakedGeometry } from './supportersSceneGeometry';

const LABEL_DEPTH = 0.32;
const tmpMatrix = new Matrix4();

/**
 * The socketed baseplate: one baked 42mm tile instanced per socket, plus one
 * merged LineSegments carrying every tile's BREP edge overlay (the sockets
 * never move, so pre-translating the lines beats per-tile draw calls).
 */
export function PlateInstances({
  geometry,
  layout,
  palette,
}: {
  geometry: BakedGeometry;
  layout: ZonedLayout;
  palette: SupportersPalette;
}) {
  const ref = useRef<InstancedMesh>(null);

  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    layout.sockets.forEach((socket, i) => {
      tmpMatrix.makeTranslation(socket.x, -MESH_META.plateHeight, socket.z);
      mesh.setMatrixAt(i, tmpMatrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [layout]);

  const edgesGeometry = useMemo(() => {
    const cell = geometry.edges?.getAttribute('position');
    if (!cell) return null;
    const merged = new Float32Array(cell.count * 3 * layout.sockets.length);
    layout.sockets.forEach((socket, i) => {
      for (let v = 0; v < cell.count; v++) {
        const o = (i * cell.count + v) * 3;
        merged[o] = cell.getX(v) + socket.x;
        merged[o + 1] = cell.getY(v) - MESH_META.plateHeight;
        merged[o + 2] = cell.getZ(v) + socket.z;
      }
    });
    const lines = new BufferGeometry();
    lines.setAttribute('position', new BufferAttribute(merged, 3));
    return lines;
  }, [geometry.edges, layout]);
  useEffect(() => () => edgesGeometry?.dispose(), [edgesGeometry]);

  return (
    <>
      <instancedMesh
        ref={ref}
        args={[geometry.solid, undefined, layout.sockets.length]}
        key={layout.sockets.length}
      >
        <meshStandardMaterial
          color={palette.plate}
          roughness={0.78}
          metalness={0.05}
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
        />
      </instancedMesh>
      {edgesGeometry && (
        <lineSegments geometry={edgesGeometry} renderOrder={1}>
          <lineBasicMaterial color={palette.edge} />
        </lineSegments>
      )}
    </>
  );
}

/** Each department's name on a strip of tape in the socket row in front of its zone. */
export function ZoneLabels({
  layout,
  labels,
  palette,
}: {
  layout: ZonedLayout;
  labels: string[];
  palette: SupportersPalette;
}) {
  const strips = useMemo(
    () =>
      layout.zones.map((zone) => {
        const width = zone.width - 0.5;
        return {
          zone,
          width,
          texture: createPlateLabelTexture(
            labels[zone.index] ?? '',
            width / LABEL_DEPTH,
            palette.tape,
            palette.tapeInk
          ),
        };
      }),
    [layout, labels, palette.tape, palette.tapeInk]
  );
  useEffect(() => () => strips.forEach((s) => s.texture?.dispose()), [strips]);

  return (
    <group>
      {strips.map(({ zone, width, texture }) =>
        texture ? (
          <mesh
            key={zone.index}
            position={[zone.label.x, 0.006, zone.label.z]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <planeGeometry args={[width, LABEL_DEPTH]} />
            <meshStandardMaterial map={texture} transparent roughness={0.65} />
          </mesh>
        ) : null
      )}
    </group>
  );
}

/** Soft baked ground shadow under the baseplate (no shadow maps: they grow the three chunk). */
export function ShadowBlob({
  width,
  depth,
  opacity,
}: {
  width: number;
  depth: number;
  opacity: number;
}) {
  const texture = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    canvas.width = 256;
    canvas.height = 256;
    const g = ctx.createRadialGradient(128, 128, 12, 128, 128, 128);
    g.addColorStop(0, 'rgba(0,0,0,0.6)');
    g.addColorStop(0.65, 'rgba(0,0,0,0.24)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    const t = new CanvasTexture(canvas);
    t.colorSpace = SRGBColorSpace;
    return t;
  }, []);
  useEffect(() => () => texture?.dispose(), [texture]);
  if (!texture) return null;
  return (
    <mesh position={[0, -MESH_META.plateHeight - 0.06, 0.25]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[width * 1.9, depth * 2.2]} />
      <meshBasicMaterial map={texture} transparent opacity={opacity} depthWrite={false} />
    </mesh>
  );
}

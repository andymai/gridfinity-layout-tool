import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3, type Group, type LineBasicMaterial, type MeshStandardMaterial } from 'three';
import type { ScenePoint } from '../../utils/supportersLayout';
import type { SupportersPalette } from '../../scene/palette';
import { MESH_META } from '../../data/meshes';
import { SEAT_DEPTH, type BakedGeometry } from './supportersSceneGeometry';

const projected = new Vector3();

/**
 * The finale's empty socket: a translucent bin in the accent colour, breathing
 * over the one vacant seat. It also pins the DOM "The end?" tag above itself
 * each frame, since the camera keeps moving under orbit.
 */
export function VacantSocket({
  geometry,
  point,
  palette,
  visible,
  reducedMotion,
  endTagRef,
  onSelect,
}: {
  geometry: BakedGeometry;
  point: ScenePoint;
  palette: SupportersPalette;
  visible: boolean;
  reducedMotion: boolean;
  endTagRef: React.RefObject<HTMLDivElement | null>;
  onSelect: () => void;
}) {
  const groupRef = useRef<Group>(null);
  const bodyRef = useRef<MeshStandardMaterial>(null);
  const edgeRef = useRef<LineBasicMaterial>(null);
  const fade = useRef(0);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  useFrame((state, delta) => {
    // Reduced motion renders on demand, so an eased fade would stall part way.
    const shown = visible ? 1 : 0;
    fade.current = reducedMotion
      ? shown
      : fade.current + (shown - fade.current) * Math.min(1, delta * 3);
    const pulse = reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(state.clock.elapsedTime * 2.4);
    const group = groupRef.current;
    if (group) {
      group.visible = fade.current > 0.01;
      group.position.y = -SEAT_DEPTH + (reducedMotion ? 0.08 : 0.06 + 0.05 * pulse);
    }
    if (bodyRef.current) bodyRef.current.opacity = fade.current * (0.12 + 0.1 * pulse);
    if (edgeRef.current) edgeRef.current.opacity = fade.current * (0.55 + 0.35 * pulse);

    const tag = endTagRef.current;
    if (!tag) return;
    projected.set(point.x, MESH_META.binHeight + 0.2 - SEAT_DEPTH, point.z).project(camera);
    const onScreen = fade.current > 0.6 && projected.z < 1;
    tag.style.visibility = onScreen ? 'visible' : 'hidden';
    tag.style.transform = `translate(${((projected.x + 1) / 2) * size.width}px, ${
      ((1 - projected.y) / 2) * size.height
    }px) translate(-50%, -135%)`;
  });

  return (
    <group
      ref={groupRef}
      position={[point.x, -SEAT_DEPTH, point.z]}
      visible={false}
      onClick={(e) => {
        if (!visible) return;
        e.stopPropagation();
        onSelect();
      }}
      onPointerOver={() => visible && (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = '')}
    >
      {/* dispose={null}: the geometry is shared with the instanced bins. */}
      <mesh geometry={geometry.solid} dispose={null}>
        <meshStandardMaterial
          ref={bodyRef}
          color={palette.accent}
          emissive={palette.accent}
          emissiveIntensity={0.7}
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>
      {geometry.edges && (
        <lineSegments geometry={geometry.edges} renderOrder={2} dispose={null}>
          <lineBasicMaterial ref={edgeRef} color={palette.accent} transparent opacity={0} />
        </lineSegments>
      )}
    </group>
  );
}

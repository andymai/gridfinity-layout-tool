import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { useLatestRef } from '@/shared/hooks';
import type { ScenePoint } from '../../utils/supportersLayout';
import type { SupportersPalette } from '../../scene/palette';
import { createTabLabelTexture } from '../../scene/labelTexture';
import { MESH_META } from '../../data/meshes';
import type { BakedGeometry } from './supportersSceneGeometry';
import { POST_CREDITS_DELAY, POST_CREDITS_LENGTH, postCreditsPose } from './postCreditsPose';

/**
 * The post-credits scene: once per page view, after the finale has sat still
 * for a while, a stranger's bin drops into the vacant socket, looks around,
 * and is nudged back out.
 */
export function PostCreditsScene({
  geometry,
  point,
  palette,
  armed,
  label,
  onStart,
  onDone,
}: {
  geometry: BakedGeometry;
  point: ScenePoint;
  palette: SupportersPalette;
  armed: boolean;
  label: string;
  onStart: () => void;
  onDone: () => void;
}) {
  const group = useRef<Group>(null);
  const waited = useRef(0);
  const played = useRef(false);
  const clock = useRef(-1);
  const callbacks = useLatestRef({ onStart, onDone });

  const texture = useMemo(
    () => createTabLabelTexture(label, palette.tape, palette.tapeInk),
    [label, palette.tape, palette.tapeInk]
  );
  useEffect(() => () => texture?.dispose(), [texture]);

  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    if (clock.current < 0) {
      g.visible = false;
      if (!armed || played.current) {
        waited.current = 0;
        return;
      }
      waited.current += delta;
      if (waited.current < POST_CREDITS_DELAY) return;
      played.current = true;
      clock.current = 0;
      callbacks.current.onStart();
    }
    clock.current += Math.min(delta, 0.1);
    if (clock.current >= POST_CREDITS_LENGTH) {
      clock.current = -1;
      g.visible = false;
      callbacks.current.onDone();
      return;
    }
    const pose = postCreditsPose(clock.current);
    g.visible = true;
    g.position.set(point.x + pose.x, pose.y, point.z);
    g.rotation.set(0, pose.yaw, pose.roll);
    g.scale.setScalar(Math.max(0.0001, pose.scale));
  });

  const tab = MESH_META.labelTab;
  return (
    <group ref={group} visible={false}>
      {/* dispose={null}: the geometry is shared with the instanced bins. */}
      <mesh geometry={geometry.solid} dispose={null}>
        <meshStandardMaterial color={palette.bin} roughness={0.55} metalness={0.04} />
      </mesh>
      {geometry.edges && (
        <lineSegments geometry={geometry.edges} renderOrder={1} dispose={null}>
          <lineBasicMaterial color={palette.edge} />
        </lineSegments>
      )}
      {texture && (
        <mesh
          position={[(tab.x0 + tab.x1) / 2, tab.y + 0.006, (tab.z0 + tab.z1) / 2]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[tab.x1 - tab.x0, tab.z1 - tab.z0]} />
          <meshStandardMaterial map={texture} transparent roughness={0.6} />
        </mesh>
      )}
    </group>
  );
}

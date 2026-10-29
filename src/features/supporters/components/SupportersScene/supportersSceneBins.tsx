import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Euler,
  LineBasicMaterial,
  MathUtils,
  Matrix4,
  Quaternion,
  Vector3,
  type CanvasTexture,
  type Group,
  type InstancedMesh,
  type MeshStandardMaterial,
} from 'three';
import type { CreditsClock } from '../../utils/creditsClock';
import type { RollSchedule } from '../../utils/rollSchedule';
import type { SupporterBin } from '../../utils/supportersData';
import type { ScenePoint } from '../../utils/supportersLayout';
import type { SupportersPalette } from '../../scene/palette';
import { createTabLabelTexture } from '../../scene/labelTexture';
import { MESH_META } from '../../data/meshes';
import {
  SEAT_DEPTH,
  easeOutBack,
  easeOutCubic,
  type BakedGeometry,
} from './supportersSceneGeometry';

/** Seconds from a bin leaving the air to settling in its socket. */
const DROP_SECONDS = 0.6;
/** Longest wait before a bin joins the cascade when the finale fills the plate at once. */
const CASCADE_SPREAD = 0.9;

const tmpMatrix = new Matrix4();
const tmpPosition = new Vector3();
const tmpQuaternion = new Quaternion();
const tmpScale = new Vector3();
const tmpEuler = new Euler();

function jitter(id: string, salt: number): number {
  let hash = salt;
  for (let i = 0; i < id.length; i++) hash = (Math.imul(hash, 31) + id.charCodeAt(i)) | 0;
  return (Math.abs(hash) % 1000) / 1000;
}

interface BinInstancesProps {
  geometry: BakedGeometry;
  bins: SupporterBin[];
  /** Seat of `bins[i]`. */
  positions: ScenePoint[];
  clock: CreditsClock;
  schedule: RollSchedule | null;
  phase: 'roll' | 'finale';
  palette: SupportersPalette;
  reducedMotion: boolean;
  pointerTarget: React.RefObject<Vector3>;
  focusedId: string | null;
  onSelect: (id: string) => void;
  anonymousLabel: string;
}

/**
 * Every supporter bin as ONE InstancedMesh (one draw call however large the
 * plate grows). During the roll a bin's drop is a function of the shared
 * playhead, so scrubbing back lifts it out again; the visible progress is
 * rate-limited, so a fast scrub or a skip still lands bins one by one instead
 * of popping them in. Label tapes and edge overlays ride in per-bin groups
 * that mirror the instance transforms every frame.
 */
export function BinInstances({
  geometry,
  bins,
  positions,
  clock,
  schedule,
  phase,
  palette,
  reducedMotion,
  pointerTarget,
  focusedId,
  onSelect,
  anonymousLabel,
}: BinInstancesProps) {
  const meshRef = useRef<InstancedMesh>(null);
  const labelGroups = useRef<(Group | null)[]>([]);
  const labelMats = useRef<(MeshStandardMaterial | null)[]>([]);
  const progressRef = useRef(new Float32Array(0));
  const elapsed = useRef(0);
  const finaleElapsed = useRef(0);

  const motion = useMemo(
    () =>
      bins.map((bin) => ({
        startY: 4.2 + jitter(bin.id, 7) * 1.6,
        delay: jitter(bin.id, 13) * CASCADE_SPREAD,
        speed: 1.6 + jitter(bin.id, 29),
      })),
    [bins]
  );

  const anonTexture = useMemo(
    () => createTabLabelTexture(anonymousLabel, palette.tape, palette.tapeInk),
    [anonymousLabel, palette.tape, palette.tapeInk]
  );
  const namedTextures = useMemo(() => {
    const map = new Map<string, CanvasTexture | null>();
    for (const bin of bins) {
      if (bin.name) map.set(bin.id, createTabLabelTexture(bin.name, palette.tape, palette.tapeInk));
    }
    return map;
  }, [bins, palette.tape, palette.tapeInk]);
  // Separate disposal effects: a locale change replaces only anonTexture, and
  // a shared cleanup would also dispose the still-in-use named textures.
  useEffect(() => () => anonTexture?.dispose(), [anonTexture]);
  useEffect(
    () => () => {
      for (const texture of namedTextures.values()) texture?.dispose();
    },
    [namedTextures]
  );

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dt = Math.min(delta, 0.1);
    if (progressRef.current.length !== bins.length)
      progressRef.current = new Float32Array(bins.length);
    const progress = progressRef.current;
    elapsed.current += dt;
    finaleElapsed.current = phase === 'finale' ? finaleElapsed.current + dt : 0;

    for (let i = 0; i < bins.length; i++) {
      const bin = bins[i];
      const seat = positions[i];
      const m = motion[i];
      const focused = focusedId === bin.id;

      let p = 1;
      if (!reducedMotion) {
        let target: number;
        if (phase === 'roll') {
          const seatAt = schedule?.seatTimes.get(bin.id);
          target =
            seatAt === undefined ? 0 : MathUtils.clamp((clock.time - seatAt) / DROP_SECONDS, 0, 1);
        } else {
          const cascade = (finaleElapsed.current - m.delay) / DROP_SECONDS;
          target = Math.max(progress[i], MathUtils.clamp(cascade, 0, 1));
        }
        const step = (dt / DROP_SECONDS) * m.speed;
        p = progress[i] + MathUtils.clamp(target - progress[i], -step, step);
      }
      // Stored in both motion modes: the click guard below reads it.
      progress[i] = p;

      let lift = 0;
      let tiltX = 0;
      let tiltZ = 0;
      if (!reducedMotion && phase === 'finale' && p >= 1) {
        const dx = pointerTarget.current.x - seat.x;
        const dz = pointerTarget.current.z - seat.z;
        const influence = Math.max(0, 1 - Math.hypot(dx, dz) / 2.1);
        lift = influence * 0.32;
        tiltX = MathUtils.clamp(dz * influence * 0.14, -0.18, 0.18);
        tiltZ = MathUtils.clamp(-dx * influence * 0.14, -0.18, 0.18);
      }
      if (bin.isNewest) lift += 0.12;
      if (focused) lift += 0.5;

      const baseY = MathUtils.lerp(m.startY, -SEAT_DEPTH, easeOutCubic(p));
      tmpPosition.set(seat.x, baseY + p * lift, seat.z);
      tmpEuler.set(tiltX, 0, tiltZ);
      tmpQuaternion.setFromEuler(tmpEuler);
      tmpScale.setScalar(Math.max(0.0001, easeOutBack(p) * (focused ? 1.08 : 1)));
      tmpMatrix.compose(tmpPosition, tmpQuaternion, tmpScale);
      mesh.setMatrixAt(i, tmpMatrix);

      const label = labelGroups.current[i];
      if (label) {
        label.position.copy(tmpPosition);
        label.quaternion.copy(tmpQuaternion);
        label.scale.copy(tmpScale);
      }
      const mat = labelMats.current[i];
      if (mat) {
        // A static glow under reduced motion, where the sine would never move.
        const newestGlow = reducedMotion ? 0.22 : 0.16 + 0.1 * Math.sin(elapsed.current * 2.2);
        const glow = focused ? 0.45 : bin.isNewest ? newestGlow : 0;
        mat.emissiveIntensity = MathUtils.lerp(
          mat.emissiveIntensity,
          glow,
          reducedMotion ? 1 : 0.15
        );
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  const edgeMaterial = useMemo(
    () => new LineBasicMaterial({ color: palette.edge }),
    [palette.edge]
  );
  useEffect(() => () => edgeMaterial.dispose(), [edgeMaterial]);

  const tab = MESH_META.labelTab;
  const tabCenter: [number, number, number] = [
    (tab.x0 + tab.x1) / 2,
    tab.y + 0.006,
    (tab.z0 + tab.z1) / 2,
  ];

  return (
    <group>
      <instancedMesh
        ref={meshRef}
        args={[geometry.solid, undefined, bins.length]}
        key={bins.length}
        frustumCulled={false}
        onPointerDown={(e) => {
          if (e.instanceId === undefined) return;
          const bin = bins.at(e.instanceId);
          if (!bin || progressRef.current[e.instanceId] < 0.5) return;
          e.stopPropagation();
          onSelect(bin.id);
        }}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = '')}
      >
        <meshStandardMaterial
          color={palette.bin}
          roughness={0.55}
          metalness={0.04}
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
        />
      </instancedMesh>

      {bins.map((bin, i) => {
        const seat = positions[i];
        const texture = bin.name ? namedTextures.get(bin.id) : anonTexture;
        return (
          <group
            key={bin.id}
            ref={(g) => {
              labelGroups.current[i] = g;
            }}
            position={[seat.x, -SEAT_DEPTH, seat.z]}
            scale={0.0001}
          >
            {geometry.edges && (
              // dispose={null}: the geometry is drei-cached and the material is
              // shared and disposed above, so R3F must not dispose either.
              <lineSegments
                geometry={geometry.edges}
                material={edgeMaterial}
                renderOrder={1}
                dispose={null}
              />
            )}
            {texture && (
              <mesh position={tabCenter} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[tab.x1 - tab.x0, tab.z1 - tab.z0]} />
                <meshStandardMaterial
                  ref={(m) => {
                    labelMats.current[i] = m;
                  }}
                  map={texture}
                  transparent
                  roughness={0.6}
                  emissive={palette.accent}
                  emissiveMap={texture}
                  emissiveIntensity={0}
                  polygonOffset
                  polygonOffsetFactor={-1}
                />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}

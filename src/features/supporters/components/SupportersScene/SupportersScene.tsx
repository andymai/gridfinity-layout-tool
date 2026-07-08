import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import {
  CanvasTexture,
  MathUtils,
  Plane,
  SRGBColorSpace,
  Vector3,
  type Group,
  type MeshStandardMaterial,
} from 'three';
import type { SupporterBin } from '../../utils/supportersData';
import { computeBaseplateLayout } from '../../utils/supportersLayout';
import { getSupportersPalette, type SupportersPalette } from '../../scene/palette';
import { createLabelTexture } from '../../scene/labelTexture';

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t: number) => {
  const c = 1.70158;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};

interface SceneProps {
  bins: SupporterBin[];
  theme: 'light' | 'dark';
  reducedMotion: boolean;
  quality: 'high' | 'low';
  focusedId: string | null;
  onSelect: (id: string) => void;
}

export function SupportersScene({
  bins,
  theme,
  reducedMotion,
  quality,
  focusedId,
  onSelect,
}: SceneProps) {
  const palette = useMemo(() => getSupportersPalette(theme), [theme]);
  const layout = useMemo(() => computeBaseplateLayout(bins.length), [bins.length]);
  const pointerTarget = useRef(new Vector3(0, 0, 0));

  return (
    <group>
      <color attach="background" args={[palette.background]} />
      <fog attach="fog" args={[palette.fog, 12, 30]} />

      <CameraRig reducedMotion={reducedMotion} />
      <Lighting palette={palette} />
      <PointerField target={pointerTarget} enabled={!reducedMotion} />

      <Baseplate palette={palette} width={layout.width} depth={layout.depth} />

      {bins.map((bin, i) => {
        const socket = layout.positions[i];
        return (
          <SupporterBinMesh
            key={bin.id}
            bin={bin}
            x={socket.x}
            z={socket.z}
            palette={palette}
            reducedMotion={reducedMotion}
            delay={reducedMotion ? 0 : 0.25 + i * 0.035}
            pointerTarget={pointerTarget}
            focused={focusedId === bin.id}
            onSelect={onSelect}
          />
        );
      })}

      <ShadowBlob
        width={layout.width}
        depth={layout.depth}
        opacity={theme === 'dark' ? 0.55 : 0.32}
      />

      {quality === 'high' && !reducedMotion && <Dust palette={palette} count={140} />}
    </group>
  );
}

function CameraRig({ reducedMotion }: { reducedMotion: boolean }) {
  const { camera } = useThree();
  const rest = useMemo(() => new Vector3(0, 8.2, 12.2), []);
  const start = useMemo(() => new Vector3(-3, 13.5, 16.5), []);
  const lookAt = useMemo(() => new Vector3(0, -0.3, -0.2), []);
  const elapsed = useRef(0);
  const done = useRef(false);

  useEffect(() => {
    if (reducedMotion) {
      camera.position.copy(rest);
      camera.lookAt(lookAt);
      done.current = true;
    } else {
      // Replay the intro (and clear a prior reduced-motion "done") so toggling
      // reduced-motion off doesn't leave the camera stuck at the start pose.
      camera.position.copy(start);
      camera.lookAt(lookAt);
      elapsed.current = 0;
      done.current = false;
    }
  }, [camera, reducedMotion, rest, start, lookAt]);

  useFrame((_, delta) => {
    if (done.current) return;
    elapsed.current += delta;
    const t = Math.min(elapsed.current / 2.0, 1);
    camera.position.lerpVectors(start, rest, easeOutCubic(t));
    camera.lookAt(lookAt);
    if (t >= 1) done.current = true;
  });

  return null;
}

function Lighting({ palette }: { palette: SupportersPalette }) {
  return (
    <>
      <ambientLight color={palette.ambient} intensity={0.7} />
      <hemisphereLight args={[palette.fillLight, palette.background, 0.5]} />
      <directionalLight color={palette.keyLight} intensity={2.1} position={[5, 9, 6]} />
      <directionalLight color={palette.rimLight} intensity={0.8} position={[-6, 4, -6]} />
    </>
  );
}

/** Tracks the cursor's projection onto the baseplate plane for magnetic bins. */
function PointerField({ target, enabled }: { target: React.RefObject<Vector3>; enabled: boolean }) {
  const { raycaster, pointer, camera } = useThree();
  const plane = useMemo(() => new Plane(new Vector3(0, 1, 0), 0), []);
  const hit = useMemo(() => new Vector3(), []);
  useFrame(() => {
    if (!enabled) return;
    raycaster.setFromCamera(pointer, camera);
    if (raycaster.ray.intersectPlane(plane, hit)) {
      target.current.lerp(hit, 0.18);
    }
  });
  return null;
}

function Baseplate({
  palette,
  width,
  depth,
}: {
  palette: SupportersPalette;
  width: number;
  depth: number;
}) {
  return (
    <group position={[0, -0.25, 0]}>
      <RoundedBox
        args={[width + 0.7, 0.5, depth + 0.7]}
        radius={0.14}
        smoothness={4}
        position={[0, -0.25, 0]}
      >
        <meshStandardMaterial color={palette.baseplate} roughness={0.72} metalness={0.08} />
      </RoundedBox>
    </group>
  );
}

/** Soft baked ground shadow under the baseplate (replaces drei ContactShadows to keep the bundle lean). */
function ShadowBlob({ width, depth, opacity }: { width: number; depth: number; opacity: number }) {
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
    <mesh position={[0, -0.55, 0.25]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[width * 2, depth * 2.4]} />
      <meshBasicMaterial map={texture} transparent opacity={opacity} depthWrite={false} />
    </mesh>
  );
}

interface BinMeshProps {
  bin: SupporterBin;
  x: number;
  z: number;
  palette: SupportersPalette;
  reducedMotion: boolean;
  delay: number;
  pointerTarget: React.RefObject<Vector3>;
  focused: boolean;
  onSelect: (id: string) => void;
}

function SupporterBinMesh({
  bin,
  x,
  z,
  palette,
  reducedMotion,
  delay,
  pointerTarget,
  focused,
  onSelect,
}: BinMeshProps) {
  const group = useRef<Group>(null);
  const labelMat = useRef<MeshStandardMaterial>(null);
  const anonymous = bin.name === null;
  const restY = 0;
  const startY = 5.5 + (bin.id.charCodeAt(bin.id.length - 1) % 5) * 0.4;
  const elapsed = useRef(reducedMotion ? 999 : -delay);

  const labelTexture = useMemo(
    () => (anonymous ? null : createLabelTexture(bin.name ?? '', palette.binInk)),
    [anonymous, bin.name, palette.binInk]
  );
  useEffect(() => () => labelTexture?.dispose(), [labelTexture]);

  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;

    // Entrance: fall + settle with a slight overshoot.
    let appear = 1;
    if (!reducedMotion) {
      elapsed.current += delta;
      appear = MathUtils.clamp(elapsed.current / 0.85, 0, 1);
    }
    const eased = reducedMotion ? 1 : easeOutBack(appear);
    const baseY = MathUtils.lerp(startY, restY, easeOutCubic(MathUtils.clamp(appear, 0, 1)));

    // Magnetic cursor reactivity + focus lift.
    let lift = 0;
    let tiltX = 0;
    let tiltZ = 0;
    if (!reducedMotion) {
      const dx = pointerTarget.current.x - x;
      const dz = pointerTarget.current.z - z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const influence = Math.max(0, 1 - dist / 2.2);
      lift = influence * 0.42;
      tiltX = MathUtils.clamp(dz * influence * 0.18, -0.22, 0.22);
      tiltZ = MathUtils.clamp(-dx * influence * 0.18, -0.22, 0.22);
    }
    if (focused) lift += 0.6;

    // Reduced motion only renders a single frame on demand, so snap to the
    // target pose/glow instead of easing toward it over many frames.
    g.position.x = x;
    g.position.z = z;
    g.position.y = MathUtils.lerp(g.position.y, baseY + appear * lift, reducedMotion ? 1 : 0.15);
    g.rotation.x = MathUtils.lerp(g.rotation.x, tiltX, reducedMotion ? 1 : 0.12);
    g.rotation.z = MathUtils.lerp(g.rotation.z, tiltZ, reducedMotion ? 1 : 0.12);
    const targetScale = eased * (focused ? 1.12 : 1);
    g.scale.setScalar(MathUtils.lerp(g.scale.x, targetScale, reducedMotion ? 1 : 0.18));

    if (labelMat.current) {
      const targetEmissive = focused ? 0.5 : 0;
      labelMat.current.emissiveIntensity = MathUtils.lerp(
        labelMat.current.emissiveIntensity,
        targetEmissive,
        reducedMotion ? 1 : 0.15
      );
    }
  });

  return (
    <group
      ref={group}
      position={[x, reducedMotion ? restY : startY, z]}
      scale={reducedMotion ? 1 : 0}
      onPointerDown={(e) => {
        e.stopPropagation();
        onSelect(bin.id);
      }}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = '')}
    >
      {/* Bin body */}
      <RoundedBox args={[0.92, 0.5, 0.92]} radius={0.09} smoothness={4}>
        {anonymous ? (
          <meshStandardMaterial
            color={palette.binAnon}
            transparent
            opacity={0.42}
            roughness={1}
            metalness={0}
          />
        ) : (
          <meshStandardMaterial color={palette.binNamed} roughness={0.5} metalness={0.05} />
        )}
      </RoundedBox>

      {/* Amber label tab along the front-top edge */}
      <mesh position={[0, 0.26, 0.34]}>
        <boxGeometry args={[0.7, 0.045, 0.14]} />
        <meshStandardMaterial
          color={palette.accent}
          emissive={palette.accent}
          emissiveIntensity={anonymous ? 0.15 : 0.35}
          roughness={0.4}
        />
      </mesh>

      {/* Printed name on the top face */}
      {labelTexture && (
        <mesh position={[0, 0.251, -0.02]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.78, 0.78]} />
          <meshStandardMaterial
            ref={labelMat}
            map={labelTexture}
            transparent
            roughness={0.6}
            emissive={palette.accent}
            emissiveMap={labelTexture}
            emissiveIntensity={0}
          />
        </mesh>
      )}
    </group>
  );
}

/** Slow-drifting ambient motes for depth. */
function Dust({ palette, count }: { palette: SupportersPalette; count: number }) {
  const ref = useRef<Group>(null);
  const seeds = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        x: (Math.sin(i * 12.9898) * 43758.5453) % 1,
        y: (Math.sin(i * 78.233) * 43758.5453) % 1,
        z: (Math.sin(i * 37.719) * 43758.5453) % 1,
        s: (Math.sin(i * 4.129) * 43758.5453) % 1,
      })),
    [count]
  );
  const positions = useMemo(
    () =>
      seeds.map((s) => ({
        x: (Math.abs(s.x) - 0.5) * 20,
        y: Math.abs(s.y) * 8,
        z: (Math.abs(s.z) - 0.5) * 16,
        scale: 0.01 + Math.abs(s.s) * 0.02,
      })),
    [seeds]
  );

  useFrame((state) => {
    if (ref.current) ref.current.rotation.y = state.clock.elapsedTime * 0.012;
  });

  return (
    <group ref={ref}>
      {positions.map((p, i) => (
        <mesh key={i} position={[p.x, p.y, p.z]} scale={p.scale}>
          <sphereGeometry args={[1, 6, 6]} />
          <meshBasicMaterial color={palette.dust} transparent opacity={0.5} />
        </mesh>
      ))}
    </group>
  );
}

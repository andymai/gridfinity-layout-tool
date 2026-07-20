import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Euler,
  LineBasicMaterial,
  MathUtils,
  Matrix4,
  Plane,
  Quaternion,
  SRGBColorSpace,
  Vector3,
  type Group,
  type InstancedMesh,
  type LineSegments,
  type Mesh,
  type MeshStandardMaterial,
} from 'three';
import type { SupporterBin } from '../../utils/supportersData';
import { computeBaseplateLayout, computeCameraFrame } from '../../utils/supportersLayout';
import type { BaseplateLayout, CameraFrame } from '../../utils/supportersLayout';
import { CameraFocus, type FlyToRequest } from './CameraFocus';
import { getSupportersPalette } from '../../scene/palette';
import type { SupportersAccent, SupportersPalette } from '../../scene/palette';
import { createTabLabelTexture } from '../../scene/labelTexture';
import { BIN_MESH_URL, PLATE_CELL_MESH_URL, MESH_META } from '../../data/meshes';

// Self-hosted Draco decoder (public/draco/) — CSP forbids the default CDN.
useGLTF.setDecoderPath('/draco/');

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t: number) => {
  const c = 1.70158;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};

/** Depth a seated bin's foot sinks into the plate socket (scene units). */
const SEAT_DEPTH = MESH_META.plateHeight * 0.82;

interface SceneProps {
  bins: SupporterBin[];
  theme: 'light' | 'dark';
  /** The user's app accent setting — drives hero glow and focus highlight. */
  accent: SupportersAccent;
  reducedMotion: boolean;
  focusedId: string | null;
  onSelect: (id: string) => void;
  /** Localized text printed on anonymous supporters' label tabs. */
  anonymousLabel: string;
  /** Fly the camera to a supporter's bin (find-your-bin); null while idle. */
  flyTo: FlyToRequest | null;
}

interface BakedGeometry {
  solid: BufferGeometry;
  /** BREP edge overlay (LINES primitive) — null on assets baked without one. */
  edges: BufferGeometry | null;
}

/** Triangle mesh + optional edge-line geometry from a baked GLB scene. */
function extractGeometry(scene: Group): BakedGeometry {
  const solids: BufferGeometry[] = [];
  const lines: BufferGeometry[] = [];
  scene.traverse((obj) => {
    // three's own type discriminators — instanceof narrows generics to `any`.
    if ((obj as Partial<LineSegments>).isLineSegments) {
      lines.push((obj as LineSegments).geometry);
    } else if ((obj as Partial<Mesh>).isMesh) {
      solids.push((obj as Mesh).geometry);
    }
  });
  const solid = solids.at(0);
  if (!solid) throw new Error('Baked supporters GLB contains no mesh');
  return { solid, edges: lines.at(0) ?? null };
}

export function SupportersScene({
  bins,
  theme,
  accent,
  reducedMotion,
  focusedId,
  onSelect,
  anonymousLabel,
  flyTo,
}: SceneProps) {
  const binGltf = useGLTF(BIN_MESH_URL, true);
  const plateGltf = useGLTF(PLATE_CELL_MESH_URL, true);
  const binGeometry = useMemo(() => extractGeometry(binGltf.scene), [binGltf]);
  const plateGeometry = useMemo(() => extractGeometry(plateGltf.scene), [plateGltf]);

  const palette = useMemo(() => getSupportersPalette(theme, accent), [theme, accent]);
  const layout = useMemo(() => computeBaseplateLayout(bins.length), [bins.length]);

  const { size } = useThree();
  const frame = useMemo(
    () => computeCameraFrame(layout, size.width / Math.max(1, size.height)),
    [layout, size.width, size.height]
  );

  const pointerTarget = useRef(new Vector3(0, 0, 0));
  const [introDone, setIntroDone] = useState(reducedMotion);

  return (
    <>
      {/* Direct children of the scene so attach targets scene.background/fog
          (inside a <group> they attach to the group and silently do nothing). */}
      <color attach="background" args={[palette.background]} />
      <fog attach="fog" args={[palette.fog, frame.distance * 1.05, frame.distance * 3.4]} />

      <CameraRig frame={frame} reducedMotion={reducedMotion} onIntroDone={setIntroDone} />
      <CameraFocus bins={bins} layout={layout} request={flyTo} reducedMotion={reducedMotion} />
      <OrbitControls
        makeDefault
        enabled={introDone}
        enablePan={false}
        enableDamping={!reducedMotion}
        dampingFactor={0.08}
        minDistance={frame.distance * 0.45}
        maxDistance={frame.distance * 2}
        minPolarAngle={0.3}
        maxPolarAngle={1.32}
        target={frame.target}
      />
      <Lighting palette={palette} />
      <PointerField target={pointerTarget} enabled={!reducedMotion} />

      <PlateInstances geometry={plateGeometry} layout={layout} palette={palette} />
      <BinInstances
        geometry={binGeometry}
        bins={bins}
        layout={layout}
        palette={palette}
        reducedMotion={reducedMotion}
        pointerTarget={pointerTarget}
        focusedId={focusedId}
        onSelect={onSelect}
        anonymousLabel={anonymousLabel}
      />

      <ShadowBlob
        width={layout.width}
        depth={layout.depth}
        opacity={theme === 'dark' ? 0.5 : 0.3}
      />
    </>
  );
}

function CameraRig({
  frame,
  reducedMotion,
  onIntroDone,
}: {
  frame: CameraFrame;
  reducedMotion: boolean;
  onIntroDone: (done: boolean) => void;
}) {
  const { camera } = useThree();
  const elapsed = useRef(0);
  const done = useRef(false);
  const rest = useMemo(() => new Vector3(...frame.position), [frame]);
  const target = useMemo(() => new Vector3(...frame.target), [frame]);
  // Intro starts higher and further out, drifting down onto the bench.
  const start = useMemo(
    () => new Vector3(frame.position[0] - 3, frame.position[1] * 1.5, frame.position[2] * 1.3),
    [frame]
  );

  useEffect(() => {
    if (reducedMotion || done.current) {
      // Re-frame on resize/layout change without replaying the intro.
      camera.position.copy(rest);
      camera.lookAt(target);
      done.current = true;
      onIntroDone(true);
    } else {
      camera.position.copy(start);
      camera.lookAt(target);
      elapsed.current = 0;
    }
  }, [camera, reducedMotion, rest, start, target, onIntroDone]);

  useFrame((_, delta) => {
    if (done.current) return;
    elapsed.current += delta;
    const t = Math.min(elapsed.current / 2.2, 1);
    camera.position.lerpVectors(start, rest, easeOutCubic(t));
    camera.lookAt(target);
    if (t >= 1) {
      done.current = true;
      onIntroDone(true);
    }
  });

  return null;
}

function Lighting({ palette }: { palette: SupportersPalette }) {
  return (
    <>
      <ambientLight color={palette.ambient} intensity={0.9} />
      <hemisphereLight args={[palette.fillLight, palette.background, 0.5]} />
      {/* Neutral key — clean product-shot illumination */}
      <directionalLight color={palette.keyLight} intensity={1.9} position={[4, 9, 5]} />
      {/* Cool fill so shadow sides don't go muddy */}
      <directionalLight color={palette.fillLight} intensity={0.6} position={[-7, 5, -2]} />
      {/* Soft rim to catch stacking lips from behind */}
      <directionalLight color={palette.rimLight} intensity={0.45} position={[-3, 4, -7]} />
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

const tmpMatrix = new Matrix4();
const tmpPosition = new Vector3();
const tmpQuaternion = new Quaternion();
const tmpScale = new Vector3();
const tmpEuler = new Euler();

/**
 * The real socketed baseplate: one baked 42mm tile instanced per socket, plus
 * a single merged LineSegments carrying every tile's BREP edge overlay (the
 * sockets never move, so pre-translating the lines beats per-tile draw calls).
 */
function PlateInstances({
  geometry,
  layout,
  palette,
}: {
  geometry: BakedGeometry;
  layout: BaseplateLayout;
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
    const merged3 = new BufferGeometry();
    merged3.setAttribute('position', new BufferAttribute(merged, 3));
    return merged3;
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

interface BinSeat {
  bin: SupporterBin;
  x: number;
  z: number;
  delay: number;
  startY: number;
}

interface BinInstancesProps {
  geometry: BakedGeometry;
  bins: SupporterBin[];
  layout: BaseplateLayout;
  palette: SupportersPalette;
  reducedMotion: boolean;
  pointerTarget: React.RefObject<Vector3>;
  focusedId: string | null;
  onSelect: (id: string) => void;
  anonymousLabel: string;
}

/**
 * All supporter bins as ONE InstancedMesh (single draw call however large the
 * plate grows). Label tapes and the BREP edge overlay are lightweight children
 * of per-bin groups whose transforms mirror the instance matrices every frame,
 * so they ride their bins through entrance/hover/focus motion.
 */
function BinInstances({
  geometry,
  bins,
  layout,
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
  const elapsed = useRef(0);

  const seats: BinSeat[] = useMemo(() => {
    const totalStagger = Math.min(2.2, bins.length * 0.05);
    return bins.map((bin, i) => ({
      bin,
      x: layout.positions[i].x,
      z: layout.positions[i].z,
      delay: 0.25 + (bins.length <= 1 ? 0 : (i / (bins.length - 1)) * totalStagger),
      startY: 4.5 + (bin.id.charCodeAt(bin.id.length - 1) % 5) * 0.35,
    }));
  }, [bins, layout]);

  // One shared texture for every anonymous tab; one per named supporter.
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

  useEffect(() => {
    elapsed.current = reducedMotion ? Number.POSITIVE_INFINITY : 0;
  }, [seats, reducedMotion]);

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    elapsed.current += delta;

    for (let i = 0; i < seats.length; i++) {
      const seat = seats[i];
      const focused = focusedId === seat.bin.id;

      let appear = 1;
      if (!reducedMotion) {
        appear = MathUtils.clamp((elapsed.current - seat.delay) / 0.85, 0, 1);
      }
      const eased = reducedMotion ? 1 : easeOutBack(appear);
      const baseY = MathUtils.lerp(seat.startY, -SEAT_DEPTH, easeOutCubic(appear));

      let lift = 0;
      let tiltX = 0;
      let tiltZ = 0;
      if (!reducedMotion && appear >= 1) {
        const dx = pointerTarget.current.x - seat.x;
        const dz = pointerTarget.current.z - seat.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        const influence = Math.max(0, 1 - dist / 2.1);
        lift = influence * 0.32;
        tiltX = MathUtils.clamp(dz * influence * 0.14, -0.18, 0.18);
        tiltZ = MathUtils.clamp(-dx * influence * 0.14, -0.18, 0.18);
      }
      // The most recent supporter sits a touch proud so the glow reads as arrival.
      if (seat.bin.isNewest) lift += 0.12;
      if (focused) lift += 0.5;

      tmpPosition.set(seat.x, baseY + appear * lift, seat.z);
      tmpEuler.set(tiltX, 0, tiltZ);
      tmpQuaternion.setFromEuler(tmpEuler);
      const s = Math.max(0.0001, eased * (focused ? 1.08 : 1));
      tmpScale.setScalar(s);
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
        // Focus wins; otherwise the newest supporter breathes a soft glow (a
        // static one under reduced motion, where elapsed is Infinity and sin() NaNs).
        const newestGlow = reducedMotion ? 0.22 : 0.16 + 0.1 * Math.sin(elapsed.current * 2.2);
        const target = focused ? 0.45 : seat.bin.isNewest ? newestGlow : 0;
        mat.emissiveIntensity = MathUtils.lerp(
          mat.emissiveIntensity,
          target,
          reducedMotion ? 1 : 0.15
        );
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  // One material shared by every bin's edge overlay (disposed on change).
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
        args={[geometry.solid, undefined, seats.length]}
        key={seats.length}
        frustumCulled={false}
        onPointerDown={(e) => {
          e.stopPropagation();
          if (e.instanceId !== undefined && seats[e.instanceId]) {
            onSelect(seats[e.instanceId].bin.id);
          }
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

      {seats.map((seat, i) => {
        const texture = seat.bin.name ? namedTextures.get(seat.bin.id) : anonTexture;
        return (
          <group
            key={seat.bin.id}
            ref={(g) => {
              labelGroups.current[i] = g;
            }}
            position={[seat.x, -SEAT_DEPTH, seat.z]}
          >
            {geometry.edges && (
              // dispose={null}: geometry is drei-cached, material is shared
              // across bins and disposed by the effect above — R3F must not
              // auto-dispose either when a bin unmounts.
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

/** Soft baked ground shadow under the baseplate (no shadow maps — bundle). */
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
    <mesh position={[0, -MESH_META.plateHeight - 0.06, 0.25]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[width * 1.9, depth * 2.2]} />
      <meshBasicMaterial map={texture} transparent opacity={opacity} depthWrite={false} />
    </mesh>
  );
}

import { useCallback, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import { Plane, Vector3 } from 'three';
import type { CreditsClock } from '../../utils/creditsClock';
import type { CreditsPlan } from '../../utils/creditsPlan';
import type { RollSchedule } from '../../utils/rollSchedule';
import type { SupporterBin } from '../../utils/supportersData';
import {
  computeCameraFrame,
  type ScenePoint,
  type ZonedLayout,
} from '../../utils/supportersLayout';
import { getSupportersPalette } from '../../scene/palette';
import type { SupportersAccent, SupportersPalette } from '../../scene/palette';
import { BIN_MESH_URL, PLATE_CELL_MESH_URL } from '../../data/meshes';
import { CameraFocus, type FlyToRequest } from './CameraFocus';
import { extractGeometry } from './supportersSceneGeometry';
import { PlateInstances, ShadowBlob, ZoneLabels } from './supportersScenePlate';
import { BinInstances } from './supportersSceneBins';
import { CreditsCamera } from './supportersSceneCamera';
import type { StageFrame } from './supportersSceneStage';
import { VacantSocket } from './supportersSceneVacant';
import { PostCreditsScene } from './supportersScenePostCredits';

// Self-hosted Draco decoder (public/draco/): CSP forbids the default CDN.
useGLTF.setDecoderPath('/draco/');

interface SceneProps {
  bins: SupporterBin[];
  plan: CreditsPlan;
  layout: ZonedLayout;
  clock: CreditsClock;
  /** Null until the credits have been measured, and under reduced motion. */
  schedule: RollSchedule | null;
  phase: 'roll' | 'finale';
  stage: StageFrame;
  theme: 'light' | 'dark';
  accent: SupportersAccent;
  reducedMotion: boolean;
  focusedId: string | null;
  /** Frame the focused bin rather than its department (a paused, clicked credit). */
  focusCamera: boolean;
  onSelect: (id: string) => void;
  onPoke: () => void;
  /** The post-credits scene has played to its end. */
  onPostCredits: () => void;
  /** Taped on the stranger's bin in the post-credits scene. */
  postCreditsLabel: string;
  anonymousLabel: string;
  /** Translated department names, indexed like the plan's zones. */
  departmentLabels: string[];
  flyTo: FlyToRequest | null;
  endTagRef: React.RefObject<HTMLDivElement | null>;
  onVacantSelect: () => void;
}

export function SupportersScene({
  bins,
  plan,
  layout,
  clock,
  schedule,
  phase,
  stage,
  theme,
  accent,
  reducedMotion,
  focusedId,
  focusCamera,
  onSelect,
  onPoke,
  onPostCredits,
  postCreditsLabel,
  anonymousLabel,
  departmentLabels,
  flyTo,
  endTagRef,
  onVacantSelect,
}: SceneProps) {
  const binGltf = useGLTF(BIN_MESH_URL, true);
  const plateGltf = useGLTF(PLATE_CELL_MESH_URL, true);
  const binGeometry = useMemo(() => extractGeometry(binGltf.scene), [binGltf]);
  const plateGeometry = useMemo(() => extractGeometry(plateGltf.scene), [plateGltf]);
  const palette = useMemo(() => getSupportersPalette(theme, accent), [theme, accent]);

  const seatOf = useCallback(
    (id: string): ScenePoint | undefined => {
      const seat = plan.seats.get(id);
      return seat ? layout.seat(seat.zone, seat.slot) : undefined;
    },
    [plan, layout]
  );
  const positions = useMemo(
    () => bins.map((bin) => seatOf(bin.id) ?? { x: 0, z: 0 }),
    [bins, seatOf]
  );

  const size = useThree((s) => s.size);
  const frame = useMemo(
    () => computeCameraFrame(layout, size.width / Math.max(1, size.height)),
    [layout, size.width, size.height]
  );

  const pointerTarget = useRef(new Vector3(0, 0, 0));
  const [orbitReady, setOrbitReady] = useState(false);
  const [guest, setGuest] = useState(false);
  const guestLeft = useCallback(() => {
    setGuest(false);
    onPostCredits();
  }, [onPostCredits]);
  const focusSeat = focusCamera && focusedId ? (seatOf(focusedId) ?? null) : null;

  return (
    <>
      {/* Direct children of the scene so attach targets scene.background/fog
          (inside a <group> they attach to the group and silently do nothing). */}
      <color attach="background" args={[palette.background]} />
      <fog attach="fog" args={[palette.fog, frame.distance * 1.05, frame.distance * 3.4]} />

      <CreditsCamera
        clock={clock}
        schedule={schedule}
        layout={layout}
        phase={phase}
        stage={stage}
        focusSeat={focusSeat}
        reducedMotion={reducedMotion}
        onOrbitReady={setOrbitReady}
      />
      {/* Mounted only once the pull-back has handed over, so a search made
          during it waits instead of being undone when the pull-back lands. */}
      {phase === 'finale' && orbitReady && (
        <CameraFocus seatOf={seatOf} request={flyTo} reducedMotion={reducedMotion} />
      )}
      <OrbitControls
        makeDefault
        enabled={phase === 'finale' && orbitReady}
        enablePan={false}
        enableDamping={!reducedMotion}
        dampingFactor={0.08}
        minDistance={frame.distance * 0.3}
        maxDistance={frame.distance * 2}
        minPolarAngle={0.3}
        maxPolarAngle={1.32}
      />
      <Lighting palette={palette} />
      <PointerField target={pointerTarget} enabled={!reducedMotion && phase === 'finale'} />

      <PlateInstances geometry={plateGeometry} layout={layout} palette={palette} />
      <ZoneLabels layout={layout} labels={departmentLabels} palette={palette} />
      <BinInstances
        geometry={binGeometry}
        bins={bins}
        positions={positions}
        clock={clock}
        schedule={schedule}
        phase={phase}
        palette={palette}
        reducedMotion={reducedMotion}
        pointerTarget={pointerTarget}
        focusedId={focusedId}
        onSelect={onSelect}
        onPoke={onPoke}
        anonymousLabel={anonymousLabel}
      />
      <VacantSocket
        geometry={binGeometry}
        point={layout.vacant}
        palette={palette}
        visible={phase === 'finale'}
        occupied={guest}
        reducedMotion={reducedMotion}
        endTagRef={endTagRef}
        onSelect={onVacantSelect}
      />
      <PostCreditsScene
        geometry={binGeometry}
        point={layout.vacant}
        palette={palette}
        armed={phase === 'finale' && orbitReady && !reducedMotion}
        label={postCreditsLabel}
        onStart={() => setGuest(true)}
        onDone={guestLeft}
      />

      <ShadowBlob
        width={layout.width}
        depth={layout.depth}
        opacity={theme === 'dark' ? 0.5 : 0.3}
      />
    </>
  );
}

function Lighting({ palette }: { palette: SupportersPalette }) {
  return (
    <>
      <ambientLight color={palette.ambient} intensity={0.9} />
      <hemisphereLight args={[palette.fillLight, palette.background, 0.5]} />
      {/* Neutral key: clean product-shot illumination */}
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

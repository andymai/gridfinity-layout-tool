import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3, type PerspectiveCamera } from 'three';
import { useLatestRef } from '@/shared/hooks';
import type { CreditsClock } from '../../utils/creditsClock';
import { zoneAt, type RollSchedule } from '../../utils/rollSchedule';
import {
  ZONE_CAMERA_DIR,
  computeCameraFrame,
  type CameraFrame,
  type ScenePoint,
  type ZonedLayout,
} from '../../utils/supportersLayout';
import { FULL_STAGE, type StageFrame } from './supportersSceneStage';

const ZONE_TIGHTNESS = 0.62;
const FOLLOW_RATE = 1.9;
/** The finale hands the camera to orbit controls once it is this close to its framing. */
const SETTLED_FRACTION = 0.02;

interface OrbitControlsLike {
  target: Vector3;
}

const want = new Vector3();
const wantTarget = new Vector3();

interface CreditsCameraProps {
  clock: CreditsClock;
  schedule: RollSchedule | null;
  layout: ZonedLayout;
  phase: 'roll' | 'finale';
  stage: StageFrame;
  /** A paused, clicked credit: frame its bin instead of the department. */
  focusSeat: ScenePoint | null;
  reducedMotion: boolean;
  onOrbitReady: (ready: boolean) => void;
}

/**
 * One controller for the camera through the whole page. During the roll it
 * follows the playhead's department zone (or a paused credit's bin), framed
 * into the part of the canvas the credits leave free by shifting the
 * projection rather than resizing the canvas. In the finale it pulls back to
 * the whole plate and, once settled, hands over to OrbitControls, which only
 * update while enabled and so never fight it before then.
 */
export function CreditsCamera({
  clock,
  schedule,
  layout,
  phase,
  stage,
  focusSeat,
  reducedMotion,
  onOrbitReady,
}: CreditsCameraProps) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const controls = useThree((s) => s.controls) as unknown as OrbitControlsLike | null;
  const look = useRef<Vector3 | null>(null);
  const shift = useRef({ x: 0, y: 0 });
  const handedOff = useRef(false);
  const onOrbitReadyRef = useLatestRef(onOrbitReady);

  useEffect(() => {
    if (phase !== 'finale' && handedOff.current) {
      handedOff.current = false;
      onOrbitReadyRef.current(false);
    }
  }, [phase, onOrbitReadyRef]);

  useEffect(() => () => camera.clearViewOffset(), [camera]);

  useFrame((_, delta) => {
    const k =
      reducedMotion || !look.current ? 1 : 1 - Math.exp(-Math.min(delta, 0.1) * FOLLOW_RATE);

    // Beside a column, the title card holds the whole screen, so the plate
    // starts centred and only glides aside once credits need the room. Stacked
    // on a phone, the card already sits above the plate's half.
    const intro = phase === 'roll' && (!schedule || clock.time < schedule.timeline.introSeconds);
    const frameStage = intro && stage.shiftY === 0 ? FULL_STAGE : stage;
    const sx = frameStage.shiftX * size.width;
    const sy = frameStage.shiftY * size.height;
    shift.current.x += (sx - shift.current.x) * k;
    shift.current.y += (sy - shift.current.y) * k;
    if (sx === 0 && sy === 0 && Math.hypot(shift.current.x, shift.current.y) < 0.5) {
      if (camera.view?.enabled) camera.clearViewOffset();
    } else {
      camera.setViewOffset(
        size.width,
        size.height,
        -shift.current.x,
        -shift.current.y,
        size.width,
        size.height
      );
    }

    if (phase === 'finale' && handedOff.current) return;

    const aspect =
      (size.width * frameStage.widthFraction) /
      Math.max(1, size.height * frameStage.heightFraction);
    let frame: CameraFrame;
    if (phase === 'finale') {
      frame = computeCameraFrame(layout, size.width / Math.max(1, size.height), undefined, 0.9);
    } else if (focusSeat) {
      frame = computeCameraFrame({ width: 3, depth: 3 }, aspect, focusSeat, 1, ZONE_CAMERA_DIR);
    } else {
      const zone = schedule ? zoneAt(schedule, clock.time) : null;
      const z = zone === null ? undefined : layout.zones[zone];
      frame = z
        ? computeCameraFrame(
            { width: z.width + 1, depth: z.depth + 1.6 },
            aspect,
            { x: z.x, z: z.z + 0.5 },
            ZONE_TIGHTNESS,
            ZONE_CAMERA_DIR
          )
        : computeCameraFrame(layout, aspect);
    }

    want.set(...frame.position);
    wantTarget.set(...frame.target);
    if (!look.current) {
      look.current = wantTarget.clone();
      // First frame: start high and wide so the opening drifts down onto the bench.
      camera.position.set(want.x - 3, want.y * 1.5, want.z * 1.3);
      if (reducedMotion) camera.position.copy(want);
    }
    camera.position.lerp(want, k);
    look.current.lerp(wantTarget, k);
    camera.lookAt(look.current);
    if (controls) controls.target.copy(look.current);

    if (
      phase === 'finale' &&
      camera.position.distanceTo(want) < frame.distance * SETTLED_FRACTION &&
      look.current.distanceTo(wantTarget) < frame.distance * SETTLED_FRACTION
    ) {
      handedOff.current = true;
      onOrbitReadyRef.current(true);
    }
  });

  return null;
}

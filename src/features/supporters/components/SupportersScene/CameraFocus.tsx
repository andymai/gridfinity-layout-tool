import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import type { SupporterBin } from '../../utils/supportersData';
import type { BaseplateLayout } from '../../utils/supportersLayout';

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** A "fly the camera to this bin" request; `nonce` re-triggers a repeat search. */
export interface FlyToRequest {
  id: string;
  nonce: number;
}

/** The slice of OrbitControls the fly-to animation drives. */
interface OrbitControlsLike {
  target: Vector3;
  update: () => void;
}

/**
 * Flies the camera to a chosen supporter's bin (find-your-bin), then hands
 * control back to OrbitControls. Drives `controls.target` and the camera in
 * lockstep so damping doesn't fight the move; snaps instead of animating under
 * reduced motion. `nonce` lets the same bin be re-framed on a repeat search.
 */
export function CameraFocus({
  bins,
  layout,
  request,
  reducedMotion,
}: {
  bins: SupporterBin[];
  layout: BaseplateLayout;
  request: FlyToRequest | null;
  reducedMotion: boolean;
}) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as OrbitControlsLike | null;
  const anim = useRef<{
    fromPos: Vector3;
    toPos: Vector3;
    fromTarget: Vector3;
    toTarget: Vector3;
    t: number;
  } | null>(null);
  const lastNonce = useRef(-1);

  useEffect(() => {
    if (!request || request.nonce === lastNonce.current) return;

    const index = bins.findIndex((b) => b.id === request.id);
    if (index < 0) {
      // Nothing to fly to — consume the request so it doesn't re-fire.
      lastNonce.current = request.nonce;
      return;
    }
    const seat = layout.positions[index];

    // Aim above the bin so it lands in the lower-centre of frame, clear of the
    // hero copy up top; a little extra distance keeps neighbours for context.
    const toTarget = new Vector3(seat.x, 1.1, seat.z);
    const dir = new Vector3(0.22, 0.72, 1).normalize();
    const toPos = new Vector3(seat.x, -0.2, seat.z).add(dir.multiplyScalar(5.4));

    if (reducedMotion) {
      camera.position.copy(toPos);
      if (controls) {
        controls.target.copy(toTarget);
        controls.update();
      } else {
        camera.lookAt(toTarget);
      }
      anim.current = null;
      lastNonce.current = request.nonce;
      return;
    }

    // The animated path drives `controls.target`; if OrbitControls isn't
    // registered yet, leave the request unconsumed so this reruns (deps include
    // `controls`) and applies the fly-to once controls mount.
    if (!controls) return;

    anim.current = {
      fromPos: camera.position.clone(),
      toPos,
      fromTarget: controls.target.clone(),
      toTarget,
      t: 0,
    };
    lastNonce.current = request.nonce;
  }, [request, bins, layout, camera, controls, reducedMotion]);

  useFrame((_, delta) => {
    const a = anim.current;
    if (!a || !controls) return;
    a.t = Math.min(a.t + delta / 1.1, 1);
    const e = easeInOutCubic(a.t);
    camera.position.lerpVectors(a.fromPos, a.toPos, e);
    controls.target.lerpVectors(a.fromTarget, a.toTarget, e);
    controls.update();
    if (a.t >= 1) anim.current = null;
  });

  return null;
}

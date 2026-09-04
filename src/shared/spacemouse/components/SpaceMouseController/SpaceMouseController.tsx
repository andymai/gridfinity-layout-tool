import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useId, useRef } from 'react';
import type { Vector3 } from 'three';
import { useFeatureFlag } from '@/shared/hooks/useFeatureFlag';
import {
  applyFrameMotion,
  computeContentBox,
  createContentBoxCache,
  frameBox,
  type OrbitLike,
  presetDirection,
} from '../../cameraCommands';
import { SPACEMOUSE_FEATURE_ID } from '../../constants';
import { computeFrameMotion, isDeflectionIdle, toDeflection } from '../../mapping';
import { createNavlibViewAccessors, type NavlibViewDeps } from '../../navlib/viewAccessors';
import { useSpaceMouseSettings } from '../../settingsStore';
import { spaceMouseBus } from '../../spaceMouseBus';
import type { SpaceMouseCommand } from '../../types';

function directionForCommand(command: SpaceMouseCommand, up: Vector3): Vector3 | undefined {
  switch (command) {
    case 'fit':
      return undefined; // keep the current view direction, just reframe
    case 'reset':
    case 'view-iso':
      return presetDirection('iso', up);
    case 'view-top':
      return presetDirection('top', up);
    case 'view-front':
      return presetDirection('front', up);
    case 'view-right':
      return presetDirection('right', up);
    case 'undo':
    case 'redo':
      return undefined; // handled globally, never reaches a canvas
  }
}

interface SpaceMouseControllerProps {
  /**
   * Marks a canvas that lives inside a modal. It holds the puck for as long as
   * it is mounted, so the canvas it covers stops moving unseen behind it rather
   * than waiting for this one to be hovered.
   */
  modal?: boolean;
}

/**
 * Drives its host canvas's camera from the shared SpaceMouse bus. Mount one
 * inside every OrbitControls-backed `<Canvas>`; it no-ops where there are no
 * controls (e.g. the 2D cutout editor), which includes controls that skipped
 * `makeDefault`. Renders nothing.
 */
export function SpaceMouseController({ modal = false }: SpaceMouseControllerProps): null {
  const enabled = useFeatureFlag(SPACEMOUSE_FEATURE_ID);
  const controls = useThree((s) => s.controls) as OrbitLike | null;
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const gl = useThree((s) => s.gl);
  const settings = useSpaceMouseSettings();
  const id = useId();
  const contentBox = useRef(createContentBoxCache());

  const stateRef = useRef({ enabled, controls, camera, scene, size, invalidate, settings });
  useEffect(() => {
    stateRef.current = { enabled, controls, camera, scene, size, invalidate, settings };
  });

  useEffect(() => {
    if (!enabled) return;
    const runCommand = (command: SpaceMouseCommand): void => {
      const st = stateRef.current;
      if (!st.controls) return;
      const box = computeContentBox(st.scene);
      if (box.isEmpty()) return;
      const aspect = st.size.height > 0 ? st.size.width / st.size.height : 1;
      frameBox(st.camera, st.controls, box, {
        direction: directionForCommand(command, st.camera.up),
        viewportHeight: st.size.height,
        aspect,
      });
      st.invalidate();
    };
    // Camera accessors for the driver-native transport, delegating to this
    // canvas's live state. Created here (not in render) so the deferred ref read
    // stays out of the render phase.
    const navlib = createNavlibViewAccessors((): NavlibViewDeps | null => {
      const st = stateRef.current;
      return st.controls
        ? { camera: st.camera, controls: st.controls, scene: st.scene, invalidate: st.invalidate }
        : null;
    });
    const unregister = spaceMouseBus.register({
      id,
      runCommand,
      invalidate: () => stateRef.current.invalidate(),
      claim: modal,
      navlib,
    });
    const dom = gl.domElement;
    const claimOnHover = (): void => spaceMouseBus.setActive(id);
    dom.addEventListener('pointerenter', claimOnHover);
    return () => {
      dom.removeEventListener('pointerenter', claimOnHover);
      unregister();
    };
  }, [enabled, id, gl, modal]);

  useFrame((_, dt) => {
    const st = stateRef.current;
    if (!st.enabled || !st.controls) return;
    if (!spaceMouseBus.isActive(id)) return;
    const deflection = toDeflection(spaceMouseBus.getRaw(), st.settings);
    if (isDeflectionIdle(deflection)) return;
    // A SpaceMouse and auto-rotate can't coexist; the puck wins once used.
    if (st.controls.autoRotate) st.controls.autoRotate = false;
    const distance = st.camera.position.distanceTo(st.controls.target);
    const motion = computeFrameMotion(deflection, st.settings, dt, distance);
    applyFrameMotion(st.camera, st.controls, motion, contentBox.current(st.scene));
    // Keep the demand-frameloop canvases rendering while the puck is deflected.
    st.invalidate();
  });

  return null;
}

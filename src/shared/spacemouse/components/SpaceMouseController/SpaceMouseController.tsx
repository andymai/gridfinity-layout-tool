import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useId, useRef } from 'react';
import type { Vector3 } from 'three';
import { useFeatureFlag } from '@/shared/hooks/useFeatureFlag';
import {
  applyFrameMotion,
  computeContentBox,
  frameBox,
  type OrbitLike,
  presetDirection,
} from '../../cameraCommands';
import { SPACEMOUSE_FEATURE_ID } from '../../constants';
import { computeFrameMotion, isDeflectionIdle, toDeflection } from '../../mapping';
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

/**
 * Drives its host canvas's camera from the shared SpaceMouse bus. Mount one
 * inside every OrbitControls-backed `<Canvas>`; it no-ops where there are no
 * controls (e.g. the 2D cutout editor). Renders nothing.
 */
export function SpaceMouseController(): null {
  const enabled = useFeatureFlag(SPACEMOUSE_FEATURE_ID);
  const controls = useThree((s) => s.controls) as OrbitLike | null;
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const gl = useThree((s) => s.gl);
  const settings = useSpaceMouseSettings();
  const id = useId();

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
    const unregister = spaceMouseBus.register({
      id,
      runCommand,
      invalidate: () => stateRef.current.invalidate(),
    });
    const dom = gl.domElement;
    const claim = (): void => spaceMouseBus.setActive(id);
    dom.addEventListener('pointerenter', claim);
    return () => {
      dom.removeEventListener('pointerenter', claim);
      unregister();
    };
  }, [enabled, id, gl]);

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
    applyFrameMotion(st.camera, st.controls, motion);
    // Keep the demand-frameloop canvases rendering while the puck is deflected.
    st.invalidate();
  });

  return null;
}

/**
 * A magnified inset of the editor while a point is dragged, so it can be set
 * onto an edge more closely than the canvas's zoom shows.
 *
 * Mounted only for the drag. While mounted it renders each frame itself: the
 * canvas as usual, then the scene again through a closer camera centred on
 * the point, into a square in the top corner away from it, with the edit
 * handles hidden so they never cover what is being placed. R3F renders the
 * frame again on its own once this unmounts.
 */

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { LOUPE_ZOOM, loupeFrustum, loupeRect } from './loupe';

interface VertexMagnifier3DProps {
  /** The dragged point, in world millimetres. */
  readonly at: { readonly x: number; readonly y: number };
}

/** Name of the group left out of the inset, so a handle never sits on the edge below it. */
export const UNMAGNIFIED = 'vertex-magnifier-hidden';

const FRAME_COLOR = '#0d99ff';
/** The crosshair's arms, as shares of the inset's half-width: hollow at the middle. */
const ARM_OUTER = 0.16;
const ARM_INNER = 0.05;

/** A square frame and a crosshair open at its centre, in -1 to 1 screen units. */
function overlayScene(): { scene: THREE.Scene; camera: THREE.OrthographicCamera } {
  const scene = new THREE.Scene();
  const v = [
    [-1, -1, 1, -1],
    [1, -1, 1, 1],
    [1, 1, -1, 1],
    [-1, 1, -1, -1],
    [-ARM_OUTER, 0, -ARM_INNER, 0],
    [ARM_INNER, 0, ARM_OUTER, 0],
    [0, -ARM_OUTER, 0, -ARM_INNER],
    [0, ARM_INNER, 0, ARM_OUTER],
  ].flatMap(([x0, y0, x1, y1]) => [x0 * 0.995, y0 * 0.995, 0, x1 * 0.995, y1 * 0.995, 0]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  scene.add(
    new THREE.LineSegments(
      geometry,
      new THREE.LineBasicMaterial({ color: FRAME_COLOR, depthTest: false })
    )
  );
  return { scene, camera: new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1) };
}

export function VertexMagnifier3D({ at }: VertexMagnifier3DProps) {
  const invalidate = useThree((state) => state.invalidate);
  const loupe = useRef<THREE.OrthographicCamera | null>(null);
  const overlay = useRef<ReturnType<typeof overlayScene> | null>(null);

  useEffect(() => {
    invalidate();
  }, [at, invalidate]);
  useEffect(
    () => () => {
      overlay.current?.scene.traverse((o) => {
        if (o instanceof THREE.LineSegments) {
          (o.geometry as THREE.BufferGeometry).dispose();
          (o.material as THREE.Material).dispose();
        }
      });
      invalidate();
    },
    [invalidate]
  );

  useFrame(({ gl, scene, camera, size }) => {
    gl.setScissorTest(false);
    gl.setViewport(0, 0, size.width, size.height);
    gl.render(scene, camera);

    const main = camera as THREE.OrthographicCamera;
    const screen = new THREE.Vector3(at.x, at.y, 0).project(main);
    const rect = loupeRect(
      { x: ((screen.x + 1) / 2) * size.width, y: ((1 - screen.y) / 2) * size.height },
      size
    );
    if (!rect) return;

    loupe.current ??= new THREE.OrthographicCamera();
    overlay.current ??= overlayScene();
    const lens = loupe.current;
    const { left, right, top, bottom } = loupeFrustum(rect.size);
    Object.assign(lens, { left, right, top, bottom, near: main.near, far: main.far });
    lens.zoom = main.zoom * LOUPE_ZOOM;
    lens.position.set(at.x, at.y, main.position.z);
    lens.quaternion.copy(main.quaternion);
    lens.updateProjectionMatrix();

    const autoClear = gl.autoClear;
    gl.autoClear = false;
    gl.setScissorTest(true);
    gl.setScissor(rect.x, rect.y, rect.size, rect.size);
    gl.setViewport(rect.x, rect.y, rect.size, rect.size);
    gl.clear(true, true, true);
    const hidden = scene.getObjectByName(UNMAGNIFIED);
    const wasVisible = hidden?.visible ?? false;
    if (hidden) hidden.visible = false;
    gl.render(scene, lens);
    if (hidden) hidden.visible = wasVisible;
    gl.clearDepth();
    gl.render(overlay.current.scene, overlay.current.camera);
    gl.setScissorTest(false);
    gl.setViewport(0, 0, size.width, size.height);
    gl.autoClear = autoClear;
  }, 1);

  return null;
}

// @vitest-environment jsdom
import {
  BoxGeometry,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Quaternion,
  Scene,
  Vector3,
} from 'three';
import { OrbitControls } from 'three-stdlib';
import { describe, expect, it } from 'vitest';
import { MIN_POLAR } from '../constants';
import { createNavlibViewAccessors, type NavlibViewDeps } from './viewAccessors';

const Z = new Vector3(0, 0, 1);

function yaw(pose: number[], delta: number): number[] {
  const m = new Matrix4().fromArray(pose);
  const position = new Vector3().setFromMatrixPosition(m);
  const step = new Quaternion().setFromAxisAngle(Z, delta);
  const rotated = new Quaternion().setFromRotationMatrix(m).premultiply(step);
  return new Matrix4()
    .compose(position.applyQuaternion(step), rotated, new Vector3(1, 1, 1))
    .toArray();
}

function screenRight(camera: PerspectiveCamera): Vector3 {
  camera.updateMatrixWorld(true);
  return new Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
}

/** The real controls the previews use, on a jsdom element, re-aiming every frame like drei does. */
function canvas(): NavlibViewDeps & { controls: OrbitControls } {
  const camera = new PerspectiveCamera(50, 1, 0.1, 2000);
  camera.up.set(0, 0, 1);
  camera.position.set(0, 0, 300);
  camera.up.set(0, 1, 0);
  camera.lookAt(0, 0, 0);
  camera.up.set(0, 0, 1);
  const controls = new OrbitControls(camera, document.createElement('div'));
  const scene = new Scene();
  const mesh = new Mesh(new BoxGeometry(168, 168, 42), new MeshBasicMaterial());
  mesh.name = 'model';
  scene.add(mesh);
  scene.updateMatrixWorld(true);
  return { camera, controls, scene, worldUp: Z.clone(), invalidate: () => {} };
}

describe('driver poses through OrbitControls', () => {
  it('keeps a top view heading through the per-frame re-aim, then hands it to the mouse', () => {
    const d = canvas();
    const camera = d.camera as PerspectiveCamera;
    const acc = createNavlibViewAccessors(() => d);
    let pose = acc.getViewMatrix();
    let right = screenRight(camera);
    for (let i = 0; i < 20; i++) {
      const asked = yaw(pose, 0.1);
      acc.setViewMatrix(asked);
      d.controls.update();
      pose = acc.getViewMatrix();
      for (let k = 0; k < 16; k++) expect(pose[k]).toBeCloseTo(asked[k], 5);
      const next = screenRight(camera);
      expect(next.angleTo(right)).toBeCloseTo(0.1, 5);
      right = next;
    }

    acc.endMotion();
    d.controls.update();
    expect(camera.up.distanceTo(Z)).toBeLessThan(1e-9);
    expect(screenRight(camera).angleTo(right)).toBeLessThan(0.02);
    const polar = camera.position.clone().sub(d.controls.target).angleTo(Z);
    expect(polar).toBeGreaterThanOrEqual(MIN_POLAR - 1e-6);
    expect(polar).toBeLessThan(0.02);
  });
});

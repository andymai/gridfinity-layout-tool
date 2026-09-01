import {
  BoxGeometry,
  type Camera,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PerspectiveCamera,
  Scene,
  Vector3,
} from 'three';
import { describe, expect, it } from 'vitest';
import type { OrbitLike } from '../cameraCommands';
import { createNavlibViewAccessors, type NavlibViewDeps } from './viewAccessors';

function makeControls(): OrbitLike {
  return { target: new Vector3(), update: () => {}, enableRotate: true };
}

function makeScene(withModel = true): Scene {
  const scene = new Scene();
  if (withModel) {
    const mesh = new Mesh(new BoxGeometry(2, 2, 2), new MeshBasicMaterial());
    mesh.name = 'model';
    scene.add(mesh);
    scene.updateMatrixWorld(true);
  }
  return scene;
}

function deps(camera: Camera, scene = makeScene()): NavlibViewDeps {
  return { camera, controls: makeControls(), scene, invalidate: () => {} };
}

describe('createNavlibViewAccessors', () => {
  it('reads the camera world matrix column-major (16 numbers)', () => {
    const camera = new PerspectiveCamera(45, 1, 0.1, 1000);
    camera.position.set(0, 0, 10);
    camera.updateMatrixWorld(true);
    const acc = createNavlibViewAccessors(() => deps(camera));
    expect(acc.getViewMatrix()).toEqual(camera.matrixWorld.toArray());
    expect(acc.getViewMatrix()).toHaveLength(16);
  });

  it('applies a written matrix to the camera and round-trips position', () => {
    const camera = new PerspectiveCamera(45, 1, 0.1, 1000);
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    const acc = createNavlibViewAccessors(() => deps(camera));

    const arr = acc.getViewMatrix();
    const moved = new PerspectiveCamera(45, 1, 0.1, 1000);
    const acc2 = createNavlibViewAccessors(() => deps(moved));
    acc2.setViewMatrix(arr);
    expect(moved.position.x).toBeCloseTo(0);
    expect(moved.position.y).toBeCloseTo(0);
    expect(moved.position.z).toBeCloseTo(10);
  });

  it('writes a translation matrix straight onto the camera', () => {
    const camera = new PerspectiveCamera();
    camera.position.set(0, 0, 5);
    const acc = createNavlibViewAccessors(() => deps(camera));
    acc.setViewMatrix(new Matrix4().makeTranslation(5, 6, 7).toArray());
    expect(camera.position.toArray()).toEqual([5, 6, 7]);
  });

  it('reports perspective vs orthographic projection', () => {
    const persp = createNavlibViewAccessors(() => deps(new PerspectiveCamera()));
    const ortho = createNavlibViewAccessors(() =>
      deps(new OrthographicCamera(-1, 1, 1, -1, 0.1, 100))
    );
    expect(persp.getPerspective()).toBe(true);
    expect(ortho.getPerspective()).toBe(false);
  });

  it('exposes orthographic view extents', () => {
    const camera = new OrthographicCamera(-2, 3, 4, -5, 0.5, 50);
    const acc = createNavlibViewAccessors(() => deps(camera));
    // [left, bottom, -far, right, top, -near]
    expect(acc.getViewExtents()).toEqual([-2, -5, -50, 3, 4, -0.5]);
  });

  it('picks the coordinate system from the up axis', () => {
    const yUp = new PerspectiveCamera();
    yUp.up.set(0, 1, 0);
    const zUp = new PerspectiveCamera();
    zUp.up.set(0, 0, 1);
    expect(createNavlibViewAccessors(() => deps(yUp)).getCoordinateSystem()[5]).toBe(1);
    // Z-up remaps: element [6] is -1 (see viewAccessors Z_UP).
    expect(createNavlibViewAccessors(() => deps(zUp)).getCoordinateSystem()[6]).toBe(-1);
  });

  it('returns the model bounding box, or null for an empty scene', () => {
    const camera = new PerspectiveCamera();
    const withModel = createNavlibViewAccessors(() => deps(camera, makeScene(true)));
    expect(withModel.getModelExtents()).toEqual([-1, -1, -1, 1, 1, 1]);
    const empty = createNavlibViewAccessors(() => deps(camera, makeScene(false)));
    expect(empty.getModelExtents()).toBeNull();
  });

  it('degrades safely when no canvas is active', () => {
    const acc = createNavlibViewAccessors(() => null);
    expect(acc.getViewMatrix()).toEqual([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    expect(acc.getModelExtents()).toBeNull();
    expect(acc.getPivotPosition()).toBeNull();
    expect(() => acc.setViewMatrix(new Matrix4().toArray())).not.toThrow();
  });
});

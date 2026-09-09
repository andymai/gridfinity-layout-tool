import {
  BoxGeometry,
  type Camera,
  Frustum,
  type Intersection,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  type Raycaster,
  Scene,
  Vector3,
} from 'three';
import { Line2, LineGeometry, LineMaterial } from 'three-stdlib';
import { describe, expect, it } from 'vitest';
import { computeContentBox, type OrbitLike } from '../cameraCommands';
import { MIN_POLAR } from '../constants';
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

/** Stands in for any Mesh subclass whose raycast reads the camera, as fat lines do. */
class CameraBoundMesh extends Mesh {
  override raycast(raycaster: Raycaster, intersects: Intersection[]): void {
    if ((raycaster as { camera: Camera | null }).camera === null) throw new Error('needs a camera');
    super.raycast(raycaster, intersects);
  }
}

function deps(camera: Camera, scene = makeScene()): NavlibViewDeps {
  return {
    camera,
    controls: makeControls(),
    scene,
    worldUp: camera.up.clone(),
    invalidate: () => {},
  };
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
    // No model, so no pan leash: this is about matrix plumbing, not framing.
    const acc2 = createNavlibViewAccessors(() => deps(moved, makeScene(false)));
    acc2.setViewMatrix(arr);
    expect(moved.position.x).toBeCloseTo(0);
    expect(moved.position.y).toBeCloseTo(0);
    expect(moved.position.z).toBeCloseTo(10);
  });

  it('writes a translation matrix straight onto the camera', () => {
    const camera = new PerspectiveCamera();
    camera.position.set(0, 0, 5);
    const acc = createNavlibViewAccessors(() => deps(camera, makeScene(false)));
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

  it('round-trips orthographic extents including clip planes', () => {
    const source = new OrthographicCamera(-2, 3, 4, -5, 0.5, 50);
    const extents = createNavlibViewAccessors(() => deps(source)).getViewExtents();
    const target = new OrthographicCamera();
    createNavlibViewAccessors(() => deps(target)).setViewExtents(extents);
    expect([target.left, target.bottom, target.right, target.top]).toEqual([-2, -5, 3, 4]);
    expect(target.near).toBeCloseTo(0.5);
    expect(target.far).toBeCloseTo(50);
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

  it('derives the ground plane and front view from the up axis', () => {
    const yUp = new PerspectiveCamera();
    yUp.up.set(0, 1, 0);
    const zUp = new PerspectiveCamera();
    zUp.up.set(0, 0, 1);
    const y = createNavlibViewAccessors(() => deps(yUp));
    const z = createNavlibViewAccessors(() => deps(zUp));
    expect(y.getConstructionPlane()).toEqual([0, 1, 0, 0]);
    expect(z.getConstructionPlane()).toEqual([0, 0, 1, 0]);
    expect(z.getFloorPlane()).toEqual([0, 0, 1, 0]);
    // Front view tracks the coordinate system, so Z-up is not the identity.
    expect(z.getFrontView()[6]).toBe(-1);
    expect(y.getFrontView()[6]).toBe(0);
  });

  it('returns the model bounding box, or null for an empty scene', () => {
    const camera = new PerspectiveCamera();
    const withModel = createNavlibViewAccessors(() => deps(camera, makeScene(true)));
    expect(withModel.getModelExtents()).toEqual([-1, -1, -1, 1, 1, 1]);
    const empty = createNavlibViewAccessors(() => deps(camera, makeScene(false)));
    expect(empty.getModelExtents()).toBeNull();
  });

  it('hit-tests solid meshes only, and survives drei fat lines in the scene', () => {
    // Line2 extends Mesh and its raycast dereferences raycaster.camera; a throw
    // here is never answered on the wire and stalls the driver.
    const camera = new PerspectiveCamera(45, 4 / 3, 0.1, 1000);
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    const scene = makeScene(true);
    const geometry = new LineGeometry();
    geometry.setPositions([-5, 3, 0, 5, 3, 0]);
    const material = new LineMaterial({ linewidth: 2 });
    material.resolution.set(800, 600);
    scene.add(new Line2(geometry, material));
    const aside = new CameraBoundMesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
    aside.position.set(20, 0, 0);
    scene.add(aside);
    scene.updateMatrixWorld(true);
    const acc = createNavlibViewAccessors(() => deps(camera, scene));
    acc.setSelectionOnly(false);
    acc.setLookAperture(0.01);

    // Through the model: hits its front face.
    acc.setLookFrom([0, 0, 10]);
    acc.setLookDirection([0, 0, -1]);
    const onModel = acc.getLookAt();
    expect(onModel).not.toBeNull();
    expect(onModel?.[2]).toBeCloseTo(1, 5);

    // Through the line at (0, 3, 0), clear of the box: a stroke is no pivot target.
    acc.setLookDirection([0, 3, -10]);
    expect(acc.getLookAt()).toBeNull();
  });

  it('does not pivot on a text label in front of the model', () => {
    const camera = new PerspectiveCamera(45, 4 / 3, 0.1, 1000);
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    const scene = makeScene(true);
    const label = new Mesh(
      new PlaneGeometry(4, 1),
      Object.assign(new MeshBasicMaterial(), { isTroikaTextMaterial: true })
    );
    label.position.set(0, 0, 5);
    scene.add(label);
    scene.updateMatrixWorld(true);
    const acc = createNavlibViewAccessors(() => deps(camera, scene));
    acc.setLookFrom([0, 0, 10]);
    acc.setLookDirection([0, 0, -1]);
    expect(acc.getLookAt()?.[2]).toBeCloseTo(1, 5);
  });

  it('degrades safely when no canvas is active', () => {
    const acc = createNavlibViewAccessors(() => null);
    expect(acc.getViewMatrix()).toEqual([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    expect(acc.getModelExtents()).toBeNull();
    expect(acc.getPivotPosition()).toBeNull();
    expect(() => acc.setViewMatrix(new Matrix4().toArray())).not.toThrow();
  });
});

/**
 * One frame of the driver's own navigation: it rotates the whole pose about the
 * pivot, position and orientation together, about the camera's own right axis,
 * so unlike the mouse it can carry the camera over a pole and roll the horizon
 * on the way.
 */
function drivePitch(pose: number[], pivot: Vector3, delta: number): number[] {
  const m = new Matrix4().fromArray(pose);
  const offset = new Vector3().setFromMatrixPosition(m).sub(pivot);
  const step = new Quaternion().setFromAxisAngle(
    new Vector3().setFromMatrixColumn(m, 0).normalize(),
    delta
  );
  const rotated = new Quaternion().setFromRotationMatrix(m).premultiply(step);
  return new Matrix4()
    .compose(pivot.clone().add(offset.applyQuaternion(step)), rotated, new Vector3(1, 1, 1))
    .toArray();
}

/** The driver turning the whole pose about the world up axis through the pivot. */
function driveYaw(pose: number[], pivot: Vector3, up: Vector3, delta: number): number[] {
  const m = new Matrix4().fromArray(pose);
  const offset = new Vector3().setFromMatrixPosition(m).sub(pivot);
  const step = new Quaternion().setFromAxisAngle(up.clone().normalize(), delta);
  const rotated = new Quaternion().setFromRotationMatrix(m).premultiply(step);
  return new Matrix4()
    .compose(pivot.clone().add(offset.applyQuaternion(step)), rotated, new Vector3(1, 1, 1))
    .toArray();
}

function driveTranslate(pose: number[], delta: Vector3): number[] {
  const m = new Matrix4().fromArray(pose);
  return m.setPosition(new Vector3().setFromMatrixPosition(m).add(delta)).toArray();
}

/** The driver dollying along the view direction. */
function driveDolly(pose: number[], distance: number): number[] {
  const m = new Matrix4().fromArray(pose);
  const forward = new Vector3().setFromMatrixColumn(m, 2).negate().normalize();
  return driveTranslate(pose, forward.multiplyScalar(distance));
}

/** The driver rolling the pose about its own view direction. */
function driveRoll(pose: number[], delta: number): number[] {
  const m = new Matrix4().fromArray(pose);
  const forward = new Vector3().setFromMatrixColumn(m, 2).negate().normalize();
  const step = new Quaternion().setFromAxisAngle(forward, delta);
  const rotated = new Quaternion().setFromRotationMatrix(m).premultiply(step);
  return new Matrix4()
    .compose(new Vector3().setFromMatrixPosition(m), rotated, new Vector3(1, 1, 1))
    .toArray();
}

/**
 * A canvas whose controls re-aim the camera on update, as OrbitControls do,
 * using whatever up vector the camera carries at the time.
 */
function aimedDeps(camera: Camera, scene: Scene, extra: Partial<OrbitLike> = {}): NavlibViewDeps {
  const worldUp = camera.up.clone();
  const controls: OrbitLike = {
    target: new Vector3(),
    update: () => {
      camera.lookAt(controls.target);
      camera.updateMatrixWorld(true);
    },
    ...extra,
  };
  controls.update();
  return { camera, controls, scene, worldUp, invalidate: () => {} };
}

function bigModel(): Scene {
  const scene = new Scene();
  const mesh = new Mesh(new BoxGeometry(168, 168, 42), new MeshBasicMaterial());
  mesh.name = 'model';
  scene.add(mesh);
  scene.updateMatrixWorld(true);
  return scene;
}

function screenRight(camera: Camera): Vector3 {
  camera.updateMatrixWorld(true);
  return new Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
}

function polarOf(camera: Camera, d: NavlibViewDeps): number {
  return camera.position.clone().sub(d.controls.target).angleTo(d.worldUp);
}

function expectPose(actual: number[], asked: number[], digits = 5): void {
  for (let i = 0; i < 16; i++) expect(actual[i]).toBeCloseTo(asked[i], digits);
}

/** A camera looking straight down the world up axis with north up the screen. */
function topView(camera: Camera): void {
  camera.position.set(0, 0, 300);
  camera.up.set(0, 1, 0);
  camera.lookAt(0, 0, 0);
  camera.up.set(0, 0, 1);
  camera.updateMatrixWorld(true);
}

describe('driver-written poses', () => {
  const Z = new Vector3(0, 0, 1);
  const centre = new Vector3(0, 0, 0);

  it('follows the driver exactly, over the top included, on a canvas without limits', () => {
    const camera = new PerspectiveCamera(50, 1, 0.1, 2000);
    camera.up.set(0, 0, 1);
    camera.position.set(200, 0, 60);
    const d = aimedDeps(camera, bigModel());
    const acc = createNavlibViewAccessors(() => d);

    let pose = acc.getViewMatrix();
    let right = screenRight(camera);
    let maxTwist = 0;
    let minPolar = Math.PI;
    for (let i = 0; i < 80; i++) {
      const asked = drivePitch(pose, centre, -0.12);
      acc.setViewMatrix(asked);
      d.controls.update();
      pose = acc.getViewMatrix();
      expectPose(pose, asked);
      const next = screenRight(camera);
      maxTwist = Math.max(maxTwist, next.angleTo(right));
      right = next;
      minPolar = Math.min(minPolar, polarOf(camera, d));
    }
    // 80 steps of 0.12 rad is well over a full turn: the view went over the top.
    expect(minPolar).toBeLessThan(0.05);
    expect(maxTwist).toBeLessThan(0.01);
  });

  it("stops at the canvas's own elevation limit without turning the view", () => {
    const camera = new PerspectiveCamera(50, 1, 0.1, 2000);
    camera.up.set(0, 0, 1);
    camera.position.set(200, 0, 60);
    const d = aimedDeps(camera, bigModel(), { minPolarAngle: Math.PI * 0.05 });
    const acc = createNavlibViewAccessors(() => d);

    let pose = acc.getViewMatrix();
    let right = screenRight(camera);
    let maxTwist = 0;
    const polars: number[] = [];
    for (let i = 0; i < 40; i++) {
      acc.setViewMatrix(drivePitch(pose, centre, -0.12));
      d.controls.update();
      pose = acc.getViewMatrix();
      const next = screenRight(camera);
      maxTwist = Math.max(maxTwist, next.angleTo(right));
      right = next;
      polars.push(polarOf(camera, d));
    }
    expect(Math.min(...polars)).toBeGreaterThanOrEqual(Math.PI * 0.05 - 1e-9);
    expect(polars[polars.length - 1]).toBeCloseTo(Math.PI * 0.05, 6);
    expect(maxTwist).toBeLessThan(0.01);
    expect(Math.abs(right.dot(Z))).toBeLessThan(1e-6);
  });

  it('yaws freely in a top view instead of snapping to a fixed heading', () => {
    const camera = new PerspectiveCamera(50, 1, 0.1, 2000);
    topView(camera);
    const d = aimedDeps(camera, bigModel());
    const acc = createNavlibViewAccessors(() => d);

    let pose = acc.getViewMatrix();
    let right = screenRight(camera);
    for (let i = 0; i < 30; i++) {
      const asked = driveYaw(pose, centre, Z, 0.1);
      acc.setViewMatrix(asked);
      d.controls.update();
      pose = acc.getViewMatrix();
      expectPose(pose, asked);
      const next = screenRight(camera);
      expect(next.angleTo(right)).toBeCloseTo(0.1, 5);
      right = next;
    }
  });

  it("places the orbit target at the model's depth, so a dolly is not a pan", () => {
    const camera = new PerspectiveCamera(50, 1, 0.1, 4000);
    camera.up.set(0, 0, 1);
    camera.position.set(0, -300, 200);
    const d = aimedDeps(camera, bigModel());
    const acc = createNavlibViewAccessors(() => d);

    let pose = acc.getViewMatrix();
    for (let i = 0; i < 60; i++) {
      acc.setViewMatrix(driveDolly(pose, 4));
      d.controls.update();
      pose = acc.getViewMatrix();
      expect(d.controls.target.distanceTo(centre)).toBeLessThan(1);
    }
    expect(camera.position.distanceTo(centre)).toBeLessThan(150);
  });

  it('keeps the model in frame while the driver keeps panning', () => {
    const camera = new PerspectiveCamera(50, 1, 0.1, 4000);
    camera.up.set(0, 0, 1);
    camera.position.set(0, -300, 200);
    const scene = bigModel();
    const d = aimedDeps(camera, scene);
    const acc = createNavlibViewAccessors(() => d);

    let pose = acc.getViewMatrix();
    for (let i = 0; i < 200; i++) {
      acc.setViewMatrix(driveTranslate(pose, new Vector3(8, 0, 4)));
      d.controls.update();
      pose = acc.getViewMatrix();
    }
    camera.updateMatrixWorld(true);
    const frustum = new Frustum().setFromProjectionMatrix(
      new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    );
    expect(frustum.intersectsBox(computeContentBox(scene))).toBe(true);
    // The drive asked for 1600 units of travel; the leash stopped it far short.
    expect(camera.position.x).toBeLessThan(400);
  });

  it('hands a level pose to the mouse on world up, just off the pole', () => {
    const camera = new PerspectiveCamera(50, 1, 0.1, 2000);
    topView(camera);
    const d = aimedDeps(camera, bigModel());
    const acc = createNavlibViewAccessors(() => d);
    let pose = acc.getViewMatrix();
    for (let i = 0; i < 7; i++) {
      acc.setViewMatrix(driveYaw(pose, centre, Z, 0.1));
      d.controls.update();
      pose = acc.getViewMatrix();
    }
    const before = screenRight(camera);

    acc.endMotion();
    expect(camera.up.distanceTo(Z)).toBeLessThan(1e-9);
    expect(polarOf(camera, d)).toBeGreaterThanOrEqual(MIN_POLAR - 1e-9);
    expect(polarOf(camera, d)).toBeLessThan(MIN_POLAR + 1e-6);
    expect(screenRight(camera).angleTo(before)).toBeLessThan(0.02);
    // The mouse's own re-aim, on world up, changes nothing further.
    d.controls.update();
    expect(screenRight(camera).angleTo(before)).toBeLessThan(0.02);
  });

  it("keeps a rolled pose's up for the mouse", () => {
    const camera = new PerspectiveCamera(50, 1, 0.1, 2000);
    camera.up.set(0, 0, 1);
    camera.position.set(200, 0, 60);
    const d = aimedDeps(camera, bigModel());
    const acc = createNavlibViewAccessors(() => d);
    const rolled = driveRoll(acc.getViewMatrix(), 0.5);
    acc.setViewMatrix(rolled);
    d.controls.update();
    acc.endMotion();
    d.controls.update();
    expectPose(acc.getViewMatrix(), rolled);
    expect(camera.up.distanceTo(Z)).toBeGreaterThan(0.1);
  });

  it("reads the coordinate system from the canvas up, not the driver's", () => {
    const camera = new PerspectiveCamera();
    camera.up.set(0, 0, 1);
    const d = deps(camera);
    camera.up.set(0, 1, 0);
    const acc = createNavlibViewAccessors(() => d);
    expect(acc.getCoordinateSystem()[6]).toBe(-1);
    expect(acc.getConstructionPlane()).toEqual([0, 0, 1, 0]);
  });
});

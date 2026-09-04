import {
  Box3,
  type Camera,
  Frustum,
  Matrix4,
  OrthographicCamera,
  PerspectiveCamera,
  Vector3,
} from 'three';
import { describe, expect, it } from 'vitest';
import {
  applyFrameMotion,
  boundingSphere,
  computeContentBox,
  fitPerspectiveDistance,
  isScaffoldName,
  type OrbitLike,
  presetDirection,
} from './cameraCommands';
import { MIN_POLAR } from './constants';
import type { FrameMotion } from './types';

const noMotion: FrameMotion = { panX: 0, panY: 0, zoom: 0, orbitH: 0, orbitV: 0 };

function orbit(target = new Vector3()): OrbitLike {
  return { target, update: () => {} };
}

/**
 * OrbitControls' update() ends by re-aiming the camera at the target, and that
 * is the step that snaps the horizon once the view direction reaches the up
 * axis. A no-op update would hide every artifact these tests are about.
 */
function aimingOrbit(camera: Camera, extra: Partial<OrbitLike> = {}): OrbitLike {
  const controls: OrbitLike = {
    target: new Vector3(),
    update: () => {
      camera.lookAt(controls.target);
      camera.updateMatrixWorld(true);
    },
    ...extra,
  };
  controls.update();
  return controls;
}

/** The camera's screen-right axis: what visibly twists when the view folds. */
function screenRight(camera: Camera): Vector3 {
  return new Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
}

function polarOf(camera: Camera, controls: OrbitLike): number {
  return camera.position.clone().sub(controls.target).angleTo(camera.up);
}

function frustumOf(camera: PerspectiveCamera): Frustum {
  camera.updateMatrixWorld(true);
  return new Frustum().setFromProjectionMatrix(
    new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
  );
}

describe('boundingSphere', () => {
  it('returns center and enclosing radius', () => {
    const box = new Box3(new Vector3(-1, -1, -1), new Vector3(1, 1, 1));
    const { center, radius } = boundingSphere(box);
    expect(center.toArray()).toEqual([0, 0, 0]);
    expect(radius).toBeCloseTo(Math.sqrt(3));
  });
});

describe('presetDirection', () => {
  it('top looks along the up axis', () => {
    expect(presetDirection('top', new Vector3(0, 0, 1)).toArray()).toEqual([0, 0, 1]);
  });

  it('front and right are perpendicular to up', () => {
    const up = new Vector3(0, 0, 1);
    expect(presetDirection('front', up).dot(up)).toBeCloseTo(0);
    expect(presetDirection('right', up).dot(up)).toBeCloseTo(0);
  });

  it('iso is a unit vector', () => {
    expect(presetDirection('iso', new Vector3(0, 1, 0)).length()).toBeCloseTo(1);
  });
});

describe('fitPerspectiveDistance', () => {
  it('grows with radius and is positive', () => {
    const near = fitPerspectiveDistance(1, 50, 1);
    const far = fitPerspectiveDistance(4, 50, 1);
    expect(near).toBeGreaterThan(0);
    expect(far).toBeCloseTo(near * 4);
  });
});

describe('applyFrameMotion', () => {
  it('pans camera and target together', () => {
    const camera = new PerspectiveCamera();
    camera.position.set(0, 0, 10);
    const controls = orbit();
    applyFrameMotion(camera, controls, { ...noMotion, panX: 2, panY: -1 });
    expect(camera.position.x).toBeCloseTo(2);
    expect(camera.position.y).toBeCloseTo(-1);
    expect(controls.target.x).toBeCloseTo(2);
    expect(controls.target.y).toBeCloseTo(-1);
  });

  it('dollies toward the target on positive zoom', () => {
    const camera = new PerspectiveCamera();
    camera.position.set(0, 0, 10);
    const controls = orbit();
    applyFrameMotion(camera, controls, { ...noMotion, zoom: 0.1 });
    expect(camera.position.z).toBeCloseTo(10 * Math.exp(-0.1));
  });

  it('orbits around the target preserving distance', () => {
    const camera = new PerspectiveCamera();
    camera.position.set(0, 0, 10);
    camera.up.set(0, 1, 0);
    const controls = orbit();
    applyFrameMotion(camera, controls, { ...noMotion, orbitH: Math.PI / 2 });
    expect(camera.position.length()).toBeCloseTo(10);
    expect(camera.position.x).toBeCloseTo(10);
    expect(camera.position.z).toBeCloseTo(0);
  });

  it('does nothing for an idle frame', () => {
    const camera = new PerspectiveCamera();
    camera.position.set(1, 2, 3);
    const controls = orbit(new Vector3(0, 0, 0));
    applyFrameMotion(camera, controls, noMotion);
    expect(camera.position.toArray()).toEqual([1, 2, 3]);
  });

  it('skips the families the host canvas disables', () => {
    const camera = new PerspectiveCamera();
    camera.position.set(0, 0, 10);
    camera.up.set(0, 1, 0);
    const controls: OrbitLike = {
      ...orbit(),
      enablePan: false,
      enableZoom: false,
      enableRotate: false,
    };
    applyFrameMotion(camera, controls, { panX: 2, panY: -1, zoom: 0.5, orbitH: 1, orbitV: 0.5 });
    expect(camera.position.toArray()).toEqual([0, 0, 10]);
    expect(controls.target.toArray()).toEqual([0, 0, 0]);
  });

  it('treats an unset enable flag as enabled', () => {
    const camera = new PerspectiveCamera();
    camera.position.set(0, 0, 10);
    applyFrameMotion(camera, orbit(), { ...noMotion, panX: 2 });
    expect(camera.position.x).toBeCloseTo(2);
  });
});

describe('computeContentBox', () => {
  it('falls back to the whole scene when there are no meshes', () => {
    const scene = new PerspectiveCamera(); // any Object3D with no meshes
    const box = computeContentBox(scene);
    expect(box.isEmpty()).toBe(true);
  });
});

describe('isScaffoldName', () => {
  it('matches the framing meshes by name, case-insensitively', () => {
    for (const name of ['Grid', 'drop-shadow', 'FloorPlane', 'axesHelper']) {
      expect(isScaffoldName(name), name).toBe(true);
    }
    for (const name of ['bin', 'baseplate', '']) {
      expect(isScaffoldName(name), name).toBe(false);
    }
  });
});

describe('vertical orbit limits', () => {
  function pushVertically(orbitV: number, extra: Partial<OrbitLike> = {}) {
    const camera = new PerspectiveCamera(50, 1, 0.1, 1000);
    camera.up.set(0, 0, 1);
    camera.position.set(60, 0, 20);
    const controls = aimingOrbit(camera, extra);
    let right = screenRight(camera);
    let maxTwist = 0;
    const polars: number[] = [];
    for (let i = 0; i < 60; i++) {
      applyFrameMotion(camera, controls, { ...noMotion, orbitV });
      const next = screenRight(camera);
      maxTwist = Math.max(maxTwist, next.angleTo(right));
      right = next;
      polars.push(polarOf(camera, controls));
    }
    return { polars, maxTwist };
  }

  it('stalls below the zenith instead of folding the view over the top', () => {
    const { polars, maxTwist } = pushVertically(-0.15);
    expect(Math.min(...polars)).toBeGreaterThanOrEqual(MIN_POLAR - 1e-9);
    expect(polars[polars.length - 1]).toBeCloseTo(MIN_POLAR, 6);
    // A fold turns the horizon by half a turn; a pure pitch leaves it alone.
    expect(maxTwist).toBeLessThan(0.05);
  });

  it('stalls above the nadir', () => {
    const { polars, maxTwist } = pushVertically(0.15);
    expect(Math.max(...polars)).toBeLessThanOrEqual(Math.PI - MIN_POLAR + 1e-9);
    expect(polars[polars.length - 1]).toBeCloseTo(Math.PI - MIN_POLAR, 6);
    expect(maxTwist).toBeLessThan(0.05);
  });

  it("stops where the host canvas's own polar limit does", () => {
    const { polars } = pushVertically(-0.15, { minPolarAngle: Math.PI * 0.05 });
    expect(Math.min(...polars)).toBeCloseTo(Math.PI * 0.05, 6);
  });

  it('leaves an orbit that stays inside the limits untouched', () => {
    const camera = new PerspectiveCamera(50, 1, 0.1, 1000);
    camera.up.set(0, 0, 1);
    camera.position.set(60, 0, 20);
    const controls = aimingOrbit(camera);
    const before = polarOf(camera, controls);
    applyFrameMotion(camera, controls, { ...noMotion, orbitV: 0.2 });
    expect(polarOf(camera, controls)).toBeCloseTo(before + 0.2, 6);
    expect(camera.position.length()).toBeCloseTo(Math.sqrt(60 * 60 + 20 * 20), 6);
  });
});

describe('pan limits', () => {
  const model = new Box3(new Vector3(-84, -84, 0), new Vector3(84, 84, 42));

  function panHard(contentBox: Box3 | null): { camera: PerspectiveCamera; target: Vector3 } {
    const camera = new PerspectiveCamera(50, 1, 0.1, 4000);
    camera.up.set(0, 0, 1);
    camera.position.set(0, -300, 200);
    const controls = aimingOrbit(camera);
    for (let i = 0; i < 200; i++) {
      applyFrameMotion(camera, controls, { ...noMotion, panX: 8, panY: 4 }, contentBox);
    }
    return { camera, target: controls.target };
  }

  it('stops panning while the model is still in frame', () => {
    const { camera } = panHard(model);
    expect(frustumOf(camera).intersectsBox(model)).toBe(true);
  });

  it('lets the model leave the frame when no content box is given', () => {
    const { camera } = panHard(null);
    expect(frustumOf(camera).intersectsBox(model)).toBe(false);
  });

  it('leashes the target to one model radius outside the content box', () => {
    const { target } = panHard(model);
    const nearest = model.clampPoint(target, new Vector3());
    expect(target.distanceTo(nearest)).toBeCloseTo(boundingSphere(model).radius, 6);
  });

  it('keeps the leash positive when the driver writes inverted view extents', () => {
    const camera = new OrthographicCamera(1, -1, -1, 1, 0.1, 1000);
    camera.up.set(0, 0, 1);
    camera.position.set(0, -300, 200);
    const controls = aimingOrbit(camera);
    controls.target.set(900, 0, 0);
    applyFrameMotion(camera, controls, { ...noMotion, panX: 1 }, model);
    const nearest = model.clampPoint(controls.target, new Vector3());
    expect(controls.target.distanceTo(nearest)).toBeCloseTo(1, 6);
  });

  it('leaves the leash to a canvas that panned, not one that forbids it', () => {
    const camera = new PerspectiveCamera(50, 1, 0.1, 4000);
    camera.up.set(0, 0, 1);
    camera.position.set(0, -300, 200);
    const controls = aimingOrbit(camera, { enablePan: false });
    controls.target.set(900, 0, 0);
    const before = camera.position.clone();
    applyFrameMotion(camera, controls, { ...noMotion, panX: 8 }, model);
    expect(camera.position.equals(before)).toBe(true);
  });
});

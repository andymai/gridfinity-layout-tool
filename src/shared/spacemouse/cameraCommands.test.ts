import { Box3, PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import {
  applyFrameMotion,
  boundingSphere,
  computeContentBox,
  fitPerspectiveDistance,
  type OrbitLike,
  presetDirection,
} from './cameraCommands';
import type { FrameMotion } from './types';

const noMotion: FrameMotion = { panX: 0, panY: 0, zoom: 0, orbitH: 0, orbitV: 0 };

function orbit(target = new Vector3()): OrbitLike {
  return { target, update: () => {} };
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

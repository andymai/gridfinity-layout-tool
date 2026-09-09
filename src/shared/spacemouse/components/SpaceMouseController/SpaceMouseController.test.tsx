import { render } from '@testing-library/react';
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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { spaceMouseBus } from '../../spaceMouseBus';
import { SpaceMouseController } from './SpaceMouseController';

const h = vi.hoisted(() => ({
  state: null as unknown as Record<string, unknown>,
  frameCb: null as ((state: unknown, dt: number) => void) | null,
}));

vi.mock('@react-three/fiber', () => ({
  useThree: (selector: (s: unknown) => unknown) => selector(h.state),
  useFrame: (cb: (state: unknown, dt: number) => void) => {
    h.frameCb = cb;
  },
}));

vi.mock('@/shared/hooks/useFeatureFlag', () => ({
  useFeatureFlag: () => true,
}));

/** The camera's pose rolled a quarter turn about its view direction, as a column-major matrix. */
function rolledPose(camera: PerspectiveCamera): number[] {
  camera.updateMatrixWorld(true);
  const forward = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  const roll = new Quaternion().setFromAxisAngle(forward, Math.PI / 2);
  return new Matrix4()
    .compose(camera.position, camera.quaternion.clone().premultiply(roll), new Vector3(1, 1, 1))
    .toArray();
}

function makeState() {
  const camera = new PerspectiveCamera(50, 1, 0.1, 1000);
  camera.position.set(0, 0, 10);
  const controls = { target: new Vector3(0, 0, 0), update: vi.fn(), autoRotate: false };
  const scene = new Scene();
  const mesh = new Mesh(new BoxGeometry(2, 2, 2), new MeshBasicMaterial());
  mesh.position.set(5, 0, 0);
  scene.add(mesh);
  return {
    camera,
    controls,
    scene,
    size: { width: 800, height: 600 },
    invalidate: vi.fn(),
    gl: { domElement: document.createElement('canvas') },
  };
}

beforeEach(() => {
  spaceMouseBus._resetForTests();
  h.state = makeState();
  h.frameCb = null;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('SpaceMouseController', () => {
  it('applies puck motion to the active canvas on each frame', () => {
    render(<SpaceMouseController />);
    const camera = h.state.camera as PerspectiveCamera;
    const before = camera.position.clone();
    spaceMouseBus.setTranslation({ x: 350, y: 0, z: 0 }); // full pan right
    h.frameCb?.({}, 1 / 60);
    expect(camera.position.x).not.toBeCloseTo(before.x);
    expect(h.state.invalidate).toHaveBeenCalled();
  });

  it('does nothing when the puck is centered', () => {
    render(<SpaceMouseController />);
    const camera = h.state.camera as PerspectiveCamera;
    const before = camera.position.clone();
    h.frameCb?.({}, 1 / 60);
    expect(camera.position.equals(before)).toBe(true);
  });

  it('frames the content on a fit command', () => {
    render(<SpaceMouseController />);
    const controls = h.state.controls as { target: Vector3 };
    spaceMouseBus.pressButton(0); // fit
    // Target snaps to the mesh center at (5, 0, 0).
    expect(controls.target.x).toBeCloseTo(5);
    expect(h.state.invalidate).toHaveBeenCalled();
  });

  it('restores the canvas up on a fit command after the driver rolled the camera', () => {
    const camera = h.state.camera as PerspectiveCamera;
    camera.up.set(0, 0, 1);
    render(<SpaceMouseController />);
    spaceMouseBus.activeNavlib()?.setViewMatrix(rolledPose(camera));
    expect(camera.up.z).toBeLessThan(0.5);
    spaceMouseBus.pressButton(0); // fit
    expect(camera.up.toArray()).toEqual([0, 0, 1]);
  });

  it('keeps the canvas up across a camera swap', () => {
    const camera = h.state.camera as PerspectiveCamera;
    camera.up.set(0, 0, 1);
    const { rerender } = render(<SpaceMouseController />);
    spaceMouseBus.activeNavlib()?.setViewMatrix(rolledPose(camera));
    // A projection switch builds its camera from the current one, up included.
    const swapped = new PerspectiveCamera(50, 1, 0.1, 1000);
    swapped.up.copy(camera.up);
    h.state = { ...h.state, camera: swapped };
    rerender(<SpaceMouseController />);
    expect(spaceMouseBus.activeNavlib()?.getCoordinateSystem()[6]).toBe(-1);
  });

  it('does not drive a canvas that is not active', () => {
    render(<SpaceMouseController />);
    const camera = h.state.camera as PerspectiveCamera;
    const before = camera.position.clone();
    // A second, different controller becomes active.
    spaceMouseBus.register({ id: 'other', runCommand: vi.fn(), invalidate: vi.fn() });
    spaceMouseBus.setActive('other');
    spaceMouseBus.setTranslation({ x: 350, y: 0, z: 0 });
    h.frameCb?.({}, 1 / 60);
    expect(camera.position.equals(before)).toBe(true);
  });

  it('takes the puck off the covered canvas when mounted as a modal', () => {
    const covered = { id: 'covered', runCommand: vi.fn(), invalidate: vi.fn() };
    spaceMouseBus.register(covered);
    const { unmount } = render(<SpaceMouseController modal />);
    const camera = h.state.camera as PerspectiveCamera;
    const before = camera.position.clone();
    spaceMouseBus.setTranslation({ x: 350, y: 0, z: 0 });
    h.frameCb?.({}, 1 / 60);
    expect(camera.position.x).not.toBeCloseTo(before.x);
    expect(covered.invalidate).not.toHaveBeenCalled();
    unmount();
    expect(spaceMouseBus.isActive('covered')).toBe(true);
  });

  it('leaves motion the host controls disable alone', () => {
    const controls = h.state.controls as { enablePan?: boolean };
    controls.enablePan = false;
    render(<SpaceMouseController />);
    const camera = h.state.camera as PerspectiveCamera;
    const before = camera.position.clone();
    spaceMouseBus.setTranslation({ x: 350, y: 0, z: 0 }); // pan only
    h.frameCb?.({}, 1 / 60);
    expect(camera.position.equals(before)).toBe(true);
  });
});

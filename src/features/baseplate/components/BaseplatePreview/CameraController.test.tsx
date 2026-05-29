import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { createRef } from 'react';
import type { RefObject } from 'react';
import type { OrbitControls as OrbitControlsType } from 'three-stdlib';

vi.mock('three', () => ({
  // Constructable chainable stub — the controller does `new Vector3(...)`.
  Vector3: class Vector3 {
    normalize() {
      return this;
    }
    multiplyScalar() {
      return this;
    }
    add() {
      return this;
    }
    clone() {
      return this;
    }
    sub() {
      return this;
    }
    copy() {}
    set() {}
    lerpVectors() {}
  },
  // Real classes so `instanceof` narrows correctly in the controller.
  PerspectiveCamera: class PerspectiveCamera {
    isPerspectiveCamera = true;
  },
  OrthographicCamera: class OrthographicCamera {
    isOrthographicCamera = true;
  },
}));

vi.mock('@/shared/printSettings/gridfinityGeometry', () => ({
  GRIDFINITY_SPEC: { SOCKET_HEIGHT: 5 },
}));

// Hoisted holders so the useThree mock can hand back distinct closure vs. live
// cameras, mirroring drei's makeDefault swap.
const cameras = vi.hoisted(() => {
  const cam = () => ({
    position: { copy: vi.fn(), clone: vi.fn().mockReturnThis(), distanceTo: vi.fn(() => 100) },
    up: { set: vi.fn(), copy: vi.fn() },
    lookAt: vi.fn(),
    quaternion: { copy: vi.fn() },
  });
  return { staleCamera: cam(), liveCamera: cam() };
});

vi.mock('@react-three/fiber', () => ({
  // `camera` is the stale closure value (R3F's throwaway initial camera);
  // `get().camera` is the live default that drei swapped in.
  useThree: () => ({
    camera: cameras.staleCamera,
    invalidate: vi.fn(),
    size: { height: 600 },
    get: () => ({ camera: cameras.liveCamera }),
  }),
  useFrame: vi.fn(),
}));

const { CameraController } = await import('./CameraController');

function renderController() {
  const controlsRef: RefObject<OrbitControlsType | null> = createRef<OrbitControlsType>();
  const invalidateRef: RefObject<(() => void) | null> = createRef<() => void>();
  return render(
    <CameraController
      controlsRef={controlsRef}
      invalidateRef={invalidateRef}
      width={5}
      depth={5}
      gridUnitMm={42}
      paddingLeft={0}
      paddingRight={0}
      paddingFront={0}
      paddingBack={0}
    />
  );
}

describe('CameraController', () => {
  beforeEach(() => {
    cameras.staleCamera.position.copy.mockClear();
    cameras.liveCamera.position.copy.mockClear();
  });

  it('frames the live default camera, not the stale closure camera', () => {
    renderController();

    // Regression (#1870 camera-rig handoff): drei's makeDefault swaps the real
    // camera in via a layout effect, so the closure here still points at R3F's
    // throwaway initial camera. Framing must target the live default.
    expect(cameras.liveCamera.position.copy).toHaveBeenCalled();
    expect(cameras.staleCamera.position.copy).not.toHaveBeenCalled();
  });
});

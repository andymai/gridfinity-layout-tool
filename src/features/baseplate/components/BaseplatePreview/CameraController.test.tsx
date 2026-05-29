import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { createRef } from 'react';
import type { RefObject } from 'react';
import type { OrbitControls as OrbitControlsType } from 'three-stdlib';

// Shared between the `three` mock and the camera instances so `instanceof
// PerspectiveCamera` narrows correctly inside the controller (the far-plane
// effect early-returns for non-perspective cameras).
const mocks = vi.hoisted(() => {
  class Vector3 {
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
  }
  class PerspectiveCamera {
    isPerspectiveCamera = true;
    far = 0;
    position = {
      copy: vi.fn(),
      clone: vi.fn().mockReturnThis(),
      sub: vi.fn().mockReturnThis(),
      distanceTo: vi.fn(() => 100),
    };
    up = { set: vi.fn(), copy: vi.fn() };
    quaternion = { copy: vi.fn() };
    lookAt = vi.fn();
    updateProjectionMatrix = vi.fn();
  }
  class OrthographicCamera {
    isOrthographicCamera = true;
  }
  return {
    Vector3,
    PerspectiveCamera,
    OrthographicCamera,
    // `staleCamera` is the closure value (R3F's throwaway initial camera);
    // `liveCamera` is the default drei swapped in via makeDefault.
    staleCamera: new PerspectiveCamera(),
    liveCamera: new PerspectiveCamera(),
  };
});

vi.mock('three', () => ({
  Vector3: mocks.Vector3,
  PerspectiveCamera: mocks.PerspectiveCamera,
  OrthographicCamera: mocks.OrthographicCamera,
}));

vi.mock('@/shared/printSettings/gridfinityGeometry', () => ({
  GRIDFINITY_SPEC: { SOCKET_HEIGHT: 5 },
}));

vi.mock('@react-three/fiber', () => ({
  useThree: () => ({
    camera: mocks.staleCamera,
    invalidate: vi.fn(),
    size: { height: 600 },
    get: () => ({ camera: mocks.liveCamera }),
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
    mocks.staleCamera.position.copy.mockClear();
    mocks.liveCamera.position.copy.mockClear();
    mocks.staleCamera.updateProjectionMatrix.mockClear();
    mocks.liveCamera.updateProjectionMatrix.mockClear();
  });

  // Regression (#1870 camera-rig handoff): drei's makeDefault swaps the real
  // camera in via a layout effect, so the closure still points at R3F's
  // throwaway initial camera when the passive effects run. Both the framing
  // and the far-plane effects must target the live default camera instead.
  it('frames the live default camera, not the stale closure camera', () => {
    renderController();

    expect(mocks.liveCamera.position.copy).toHaveBeenCalled();
    expect(mocks.staleCamera.position.copy).not.toHaveBeenCalled();
  });

  it('sets the far plane on the live default camera, not the stale closure camera', () => {
    renderController();

    expect(mocks.liveCamera.updateProjectionMatrix).toHaveBeenCalled();
    expect(mocks.staleCamera.updateProjectionMatrix).not.toHaveBeenCalled();
  });
});

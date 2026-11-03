import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import * as THREE from 'three';
import { LOUPE_MARGIN_PX, LOUPE_PX, LOUPE_ZOOM } from './loupe';

const fiber = vi.hoisted(() => ({
  frame: null as ((state: unknown) => void) | null,
  invalidate: vi.fn(),
}));

vi.mock('@react-three/fiber', () => ({
  useFrame: (callback: (state: unknown) => void) => {
    fiber.frame = callback;
  },
  useThree: (select: (state: { invalidate: () => void }) => unknown) =>
    select({ invalidate: fiber.invalidate }),
}));

import { UNMAGNIFIED, VertexMagnifier3D } from './VertexMagnifier3D';

const SIZE = { width: 800, height: 600 };

/** A canvas-sized orthographic view of the bin from above, as the editor's. */
function editorCamera(): THREE.OrthographicCamera {
  const camera = new THREE.OrthographicCamera(-400, 400, 300, -300, 0.1, 1000);
  camera.position.set(0, 0, 100);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  return camera;
}

interface Drawn {
  readonly scene: THREE.Object3D;
  readonly camera: THREE.Camera;
  readonly handlesVisible: boolean;
  readonly controlsVisible: boolean;
}

function frameAt(size: { width: number; height: number }) {
  const scene = new THREE.Scene();
  const handles = new THREE.Group();
  handles.name = UNMAGNIFIED;
  scene.add(handles);
  // The resize and rotation controls, also left out.
  const controls = new THREE.Group();
  controls.name = UNMAGNIFIED;
  scene.add(controls);
  const camera = editorCamera();
  const drawn: Drawn[] = [];
  const gl = {
    autoClear: true,
    setScissorTest: vi.fn(),
    setScissor: vi.fn(),
    setViewport: vi.fn(),
    clear: vi.fn(),
    clearDepth: vi.fn(),
    render: vi.fn((s: THREE.Object3D, c: THREE.Camera) => {
      drawn.push({
        scene: s,
        camera: c,
        handlesVisible: handles.visible,
        controlsVisible: controls.visible,
      });
    }),
  };
  if (!fiber.frame) throw new Error('useFrame was not called');
  fiber.frame({ gl, scene, camera, size });
  return { gl, scene, camera, handles, controls, drawn };
}

describe('VertexMagnifier3D', () => {
  beforeEach(() => {
    fiber.frame = null;
    fiber.invalidate.mockClear();
  });

  it('draws the canvas, then the point closer with the handles hidden, then the frame', () => {
    render(<VertexMagnifier3D at={{ x: -300, y: 0 }} />);
    const { gl, scene, camera, handles, controls, drawn } = frameAt(SIZE);

    expect(drawn).toHaveLength(3);
    expect(drawn[0]).toEqual({ scene, camera, handlesVisible: true, controlsVisible: true });

    const lens = drawn[1].camera as THREE.OrthographicCamera;
    expect(drawn[1].scene).toBe(scene);
    expect(drawn[1].handlesVisible).toBe(false);
    expect(drawn[1].controlsVisible).toBe(false);
    expect(lens.zoom).toBe(camera.zoom * LOUPE_ZOOM);
    expect([lens.position.x, lens.position.y]).toEqual([-300, 0]);

    expect(drawn[2].scene).not.toBe(scene);
    expect(handles.visible).toBe(true);
    expect(controls.visible).toBe(true);

    // The point is in the left half, so the inset takes the top right corner.
    const x = SIZE.width - LOUPE_MARGIN_PX - LOUPE_PX;
    const y = SIZE.height - LOUPE_MARGIN_PX - LOUPE_PX;
    expect(gl.setScissor).toHaveBeenCalledWith(x, y, LOUPE_PX, LOUPE_PX);
    expect(gl.setViewport).toHaveBeenCalledWith(x, y, LOUPE_PX, LOUPE_PX);

    // Left as R3F expects it for the next frame.
    expect(gl.setViewport).toHaveBeenLastCalledWith(0, 0, SIZE.width, SIZE.height);
    expect(gl.setScissorTest).toHaveBeenLastCalledWith(false);
    expect(gl.autoClear).toBe(true);
  });

  it('draws only the canvas when it is too small for an inset', () => {
    render(<VertexMagnifier3D at={{ x: 0, y: 0 }} />);
    const { gl, drawn } = frameAt({ width: 200, height: 600 });
    expect(drawn).toHaveLength(1);
    expect(gl.setScissor).not.toHaveBeenCalled();
  });

  it('asks for a frame as the point moves, and one more once it is gone', () => {
    const { rerender, unmount } = render(<VertexMagnifier3D at={{ x: 0, y: 0 }} />);
    expect(fiber.invalidate).toHaveBeenCalledTimes(1);
    rerender(<VertexMagnifier3D at={{ x: 5, y: 0 }} />);
    expect(fiber.invalidate).toHaveBeenCalledTimes(2);
    unmount();
    expect(fiber.invalidate).toHaveBeenCalledTimes(3);
  });
});

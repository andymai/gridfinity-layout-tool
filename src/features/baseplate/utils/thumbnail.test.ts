// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PerspectiveCamera, Scene, Mesh, type WebGLRenderer } from 'three';
import {
  captureThumbnail,
  captureBaseplateThumbnailAtPreset,
  setPreviewCanvas,
  setPreviewContext,
  clearPreviewCanvas,
  type BaseplateThumbnailFraming,
} from './thumbnail';

const FRAMING: BaseplateThumbnailFraming = {
  width: 4,
  depth: 4,
  gridUnitMm: 42,
  paddingLeft: 0,
  paddingRight: 0,
  paddingFront: 0,
  paddingBack: 0,
};

describe('captureThumbnail', () => {
  let mockCanvas: HTMLCanvasElement;
  let mockCtx: CanvasRenderingContext2D;

  beforeEach(() => {
    mockCanvas = document.createElement('canvas');
    mockCanvas.width = 800;
    mockCanvas.height = 600;

    mockCtx = { drawImage: vi.fn() } as unknown as CanvasRenderingContext2D;

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
      this: HTMLCanvasElement,
      contextId: string
    ) {
      if (contextId === '2d' && this !== mockCanvas) return mockCtx;
      return null;
    } as typeof HTMLCanvasElement.prototype.getContext);

    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
      'data:image/webp;base64,mockThumb'
    );
  });

  afterEach(() => {
    clearPreviewCanvas();
    vi.restoreAllMocks();
  });

  it('returns null when no canvas is registered', () => {
    expect(captureThumbnail()).toBeNull();
  });

  it('returns null after clearPreviewCanvas', () => {
    setPreviewCanvas(mockCanvas);
    clearPreviewCanvas();
    expect(captureThumbnail()).toBeNull();
  });

  it('captures a WebP data URL center-cropped to 384x384', () => {
    setPreviewCanvas(mockCanvas);

    expect(captureThumbnail()).toBe('data:image/webp;base64,mockThumb');
    // 800x600 → 600x600 centered crop (srcX = 100)
    expect(mockCtx.drawImage).toHaveBeenCalledWith(mockCanvas, 100, 0, 600, 600, 0, 0, 384, 384);
    expect(HTMLCanvasElement.prototype.toDataURL).toHaveBeenCalledWith('image/webp', 0.9);
  });
});

describe('captureBaseplateThumbnailAtPreset', () => {
  let mockCanvas: HTMLCanvasElement;
  let mockCtx: CanvasRenderingContext2D;

  beforeEach(() => {
    mockCanvas = document.createElement('canvas');
    mockCanvas.width = 500;
    mockCanvas.height = 500;
    mockCtx = { drawImage: vi.fn() } as unknown as CanvasRenderingContext2D;

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
      this: HTMLCanvasElement,
      contextId: string
    ) {
      if (contextId === '2d' && this !== mockCanvas) return mockCtx;
      return null;
    } as typeof HTMLCanvasElement.prototype.getContext);

    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
      'data:image/webp;base64,mockThumb'
    );
  });

  afterEach(() => {
    clearPreviewCanvas();
    vi.restoreAllMocks();
  });

  it('falls back to current-view capture when no Three.js context is registered', () => {
    setPreviewCanvas(mockCanvas);
    // No setPreviewContext — should still capture via the fallback path.
    expect(captureBaseplateThumbnailAtPreset(FRAMING)).toBe('data:image/webp;base64,mockThumb');
  });

  it('returns null when nothing is registered at all', () => {
    expect(captureBaseplateThumbnailAtPreset(FRAMING)).toBeNull();
  });

  it('renders one preset frame, captures, then restores the original camera pose', () => {
    const renderer = { render: vi.fn() } as unknown as WebGLRenderer;
    const scene = new Scene();
    scene.add(new Mesh());
    const camera = new PerspectiveCamera(45, 1, 0.1, 20_000);
    camera.position.set(100, -100, 80);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const originalPosition = camera.position.clone();
    const originalQuaternion = camera.quaternion.clone();

    setPreviewCanvas(mockCanvas);
    setPreviewContext(renderer, scene, camera);

    const result = captureBaseplateThumbnailAtPreset(FRAMING);

    expect(result).toBe('data:image/webp;base64,mockThumb');
    // One render at the preset angle + one to restore the visible frame.
    expect(renderer.render).toHaveBeenCalledTimes(2);
    // Camera pose is restored exactly so the user's orbit is untouched.
    expect(camera.position.distanceTo(originalPosition)).toBeLessThan(1e-6);
    expect(camera.quaternion.angleTo(originalQuaternion)).toBeLessThan(1e-6);
  });

  it('hides transient overlays (renderOrder >= 2) during capture and restores them', () => {
    const renderer = { render: vi.fn() } as unknown as WebGLRenderer;
    const scene = new Scene();
    const ghost = new Mesh();
    ghost.renderOrder = 3;
    let visibleAtRender = true;
    (renderer.render as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => {
      // Capture the ghost's visibility as seen by the first (preset) render.
      if ((renderer.render as ReturnType<typeof vi.fn>).mock.calls.length === 1) {
        visibleAtRender = ghost.visible;
      }
    });
    scene.add(ghost);
    const camera = new PerspectiveCamera(45, 1, 0.1, 20_000);

    setPreviewCanvas(mockCanvas);
    setPreviewContext(renderer, scene, camera);

    captureBaseplateThumbnailAtPreset(FRAMING);

    expect(visibleAtRender).toBe(false);
    // Restored after capture so the live preview keeps its overlay.
    expect(ghost.visible).toBe(true);
  });

  it('restores the camera and overlays even when render throws (context loss)', () => {
    const renderCalls = vi.fn();
    const renderer = {
      render: vi.fn(() => {
        // First render (the preset frame) throws, e.g. GL context loss.
        if (renderCalls.mock.calls.length === 0) {
          renderCalls();
          throw new Error('context lost');
        }
        renderCalls();
      }),
    } as unknown as WebGLRenderer;
    const scene = new Scene();
    const ghost = new Mesh();
    ghost.renderOrder = 3;
    scene.add(ghost);
    const camera = new PerspectiveCamera(45, 1, 0.1, 20_000);
    camera.position.set(100, -100, 80);
    camera.lookAt(0, 0, 0);
    const originalPosition = camera.position.clone();
    const originalQuaternion = camera.quaternion.clone();

    setPreviewCanvas(mockCanvas);
    setPreviewContext(renderer, scene, camera);

    // Falls back to a current-view capture rather than throwing.
    expect(captureBaseplateThumbnailAtPreset(FRAMING)).toBe('data:image/webp;base64,mockThumb');
    // The live preview must not be left mutated by the aborted capture.
    expect(ghost.visible).toBe(true);
    expect(camera.position.distanceTo(originalPosition)).toBeLessThan(1e-6);
    expect(camera.quaternion.angleTo(originalQuaternion)).toBeLessThan(1e-6);
  });

  it('invalidates so R3F repaints with the active camera after restoring', () => {
    const renderer = { render: vi.fn() } as unknown as WebGLRenderer;
    const scene = new Scene();
    const camera = new PerspectiveCamera(45, 1, 0.1, 20_000);
    const invalidate = vi.fn();

    setPreviewCanvas(mockCanvas);
    setPreviewContext(renderer, scene, camera, invalidate);

    captureBaseplateThumbnailAtPreset(FRAMING);

    expect(invalidate).toHaveBeenCalledTimes(1);
  });
});

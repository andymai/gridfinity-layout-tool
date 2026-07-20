/**
 * Thumbnail capture utility for the standalone Baseplate page.
 *
 * Mirrors the bin designer's `utils/thumbnail.ts` (module boundaries forbid
 * importing it across features). Captures the live Three.js preview canvas at a
 * canonical isometric angle and downscales it to a WebP data URL for storage in
 * the baseplate library (IndexedDB).
 *
 * The BaseplatePreview `<Canvas>` registers its renderer/scene/camera here via
 * `setPreviewContext` (and the DOM canvas via `setPreviewCanvas`); capture reads
 * those module-level refs. Requires the page to be mounted.
 */

import type { WebGLRenderer, Scene, PerspectiveCamera } from 'three';
import { Vector3 } from 'three';
import { calculateIdealDistance } from '../components/BaseplatePreview/cameraUtils';

/** Thumbnail edge length for IndexedDB storage (crisp at any card size). */
const THUMBNAIL_SIZE = 384;

/**
 * Capture eye direction (normalized). Steeper than the interactive `isometric`
 * preset (~48° vs ~30° elevation): a baseplate is a flat plate, so a shallow
 * angle drops the whole plate below the horizon and wastes the top half of the
 * frame. Normalized inline with plain math so this module makes no Three.js call
 * at import time — `new Vector3` is deferred to the capture function so tests can
 * mock `three`.
 */
const CAPTURE_DIRECTION: readonly [number, number, number] = (() => {
  const [x, y, z] = [0.5, -0.5, 0.8];
  const len = Math.hypot(x, y, z);
  return [x / len, y / len, z / len];
})();

let previewCanvasEl: HTMLCanvasElement | null = null;
let previewRenderer: WebGLRenderer | null = null;
let previewScene: Scene | null = null;
let previewCamera: PerspectiveCamera | null = null;
let previewInvalidate: (() => void) | null = null;

/** Register the DOM canvas used as the capture source. */
export function setPreviewCanvas(canvas: HTMLCanvasElement): void {
  previewCanvasEl = canvas;
}

/**
 * Register the Three.js context for preset-angle captures. `invalidate` is
 * R3F's demand-frame trigger: after a capture restores the camera we call it so
 * R3F repaints with whatever camera is actually active (e.g. the orthographic
 * one), rather than leaving our manual perspective frame on screen.
 */
export function setPreviewContext(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: PerspectiveCamera,
  invalidate?: () => void
): void {
  previewRenderer = renderer;
  previewScene = scene;
  previewCamera = camera;
  previewInvalidate = invalidate ?? null;
}

/** Clear all registered references (on preview unmount). */
export function clearPreviewCanvas(): void {
  previewCanvasEl = null;
  previewRenderer = null;
  previewScene = null;
  previewCamera = null;
  previewInvalidate = null;
}

export interface ThumbnailCaptureOptions {
  /** Output edge length in pixels. Defaults to THUMBNAIL_SIZE. */
  readonly size?: number;
  /** Encoder quality. Defaults to 0.9. */
  readonly quality?: number;
}

/**
 * Capture a centered square WebP data URL of the current preview canvas.
 *
 * Returns `null` if the canvas or a 2D context is unavailable, or the source
 * canvas is tainted.
 */
export function captureThumbnail(options?: ThumbnailCaptureOptions): string | null {
  if (!previewCanvasEl) return null;

  const size = options?.size ?? THUMBNAIL_SIZE;
  const quality = options?.quality ?? 0.9;

  try {
    const offscreen = document.createElement('canvas');
    offscreen.width = size;
    offscreen.height = size;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return null;

    const src = previewCanvasEl;
    const srcSize = Math.min(src.width, src.height);
    const srcX = (src.width - srcSize) / 2;
    const srcY = (src.height - srcSize) / 2;

    ctx.drawImage(src, srcX, srcY, srcSize, srcSize, 0, 0, size, size);
    return offscreen.toDataURL('image/webp', quality);
  } catch {
    return null;
  }
}

/** Plate framing dimensions (grid units + per-side mm padding). */
export interface BaseplateThumbnailFraming {
  readonly width: number;
  readonly depth: number;
  readonly gridUnitMm: number;
  readonly paddingLeft: number;
  readonly paddingRight: number;
  readonly paddingFront: number;
  readonly paddingBack: number;
}

/**
 * Capture a thumbnail from a canonical isometric angle, independent of the
 * user's current camera pose. Temporarily reframes the camera onto the plate,
 * renders one frame, captures, then restores the exact prior pose so the user's
 * orbit is untouched.
 *
 * Falls back to `captureThumbnail()` (current view) when the Three.js context
 * isn't registered.
 */
export function captureBaseplateThumbnailAtPreset(
  framing: BaseplateThumbnailFraming,
  options?: ThumbnailCaptureOptions
): string | null {
  const renderer = previewRenderer;
  const scene = previewScene;
  const camera = previewCamera;
  if (!renderer || !scene || !camera) {
    return captureThumbnail(options);
  }

  // Saved outside the try so restoration in `finally` always runs — even if
  // `render()` throws on context loss, the live preview must not be left at the
  // capture pose with overlays hidden.
  const savedPosition = camera.position.clone();
  const savedUp = camera.up.clone();
  const savedQuaternion = camera.quaternion.clone();
  const hidden: { visible: boolean }[] = [];

  try {
    const { width, depth, gridUnitMm, paddingLeft, paddingRight, paddingFront, paddingBack } =
      framing;
    // The plate is thin and centered on the origin (pockets align to the
    // FootprintGrid), so framing on (0,0,0) is exact enough for a thumbnail.
    const center = new Vector3(0, 0, 0);
    // Top-down framing distance; the isometric angle foreshortens the flat
    // plate, so this over-frames slightly rather than clipping.
    const idealDistance = calculateIdealDistance(
      width,
      depth,
      gridUnitMm,
      paddingLeft,
      paddingRight,
      paddingFront,
      paddingBack,
      camera.fov
    );

    camera.position.copy(
      new Vector3(CAPTURE_DIRECTION[0], CAPTURE_DIRECTION[1], CAPTURE_DIRECTION[2])
        .multiplyScalar(idealDistance)
        .add(center)
    );
    camera.up.set(0, 0, 1);
    camera.lookAt(center);
    camera.updateProjectionMatrix();

    // Hide transient overlays (ghost outline sits at renderOrder 3) so a
    // mid-edit wireframe never bleeds into the saved image.
    scene.traverse((obj) => {
      if (obj.renderOrder >= 2 && obj.visible) {
        hidden.push(obj);
        obj.visible = false;
      }
    });

    renderer.render(scene, camera);
    return captureThumbnail(options);
  } catch {
    return captureThumbnail(options);
  } finally {
    for (const obj of hidden) {
      obj.visible = true;
    }
    camera.position.copy(savedPosition);
    camera.up.copy(savedUp);
    camera.quaternion.copy(savedQuaternion);
    camera.updateProjectionMatrix();
    // Repaint the restored pose. `render()` can throw on context loss, so guard
    // it; `invalidate()` then lets R3F redraw with the actually-active camera
    // (perspective or orthographic) on its next demand frame.
    try {
      renderer.render(scene, camera);
    } catch {
      // Context lost — nothing to restore onto; R3F's error boundary handles it.
    }
    previewInvalidate?.();
  }
}

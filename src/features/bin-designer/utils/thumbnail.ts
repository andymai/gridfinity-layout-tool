/**
 * Thumbnail capture utility for the Bin Designer.
 *
 * Captures the current state of the Three.js preview canvas and
 * resizes it to a small data URL for storage in IndexedDB.
 */

import type { WebGLRenderer, Scene, PerspectiveCamera, Object3D } from 'three';
import { Vector3 } from 'three';
import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';
import { ISOMETRIC_DIRECTION, calculateIdealDistance } from './cameraFraming';

/** Thumbnail size for IndexedDB storage (high res for crisp display at any size) */
const THUMBNAIL_SIZE = 384;

/** Module-level ref to the preview canvas element, set by PreviewCanvas */
let previewCanvasEl: HTMLCanvasElement | null = null;

/** Module-level refs for Three.js context, set by PreviewCanvas */
let previewRenderer: WebGLRenderer | null = null;
let previewScene: Scene | null = null;
let previewCamera: PerspectiveCamera | null = null;
/**
 * Register the provided canvas as the module-level preview canvas used for thumbnail generation.
 *
 * @param canvas - The HTMLCanvasElement to use as the preview source when capturing thumbnails
 */
export function setPreviewCanvas(canvas: HTMLCanvasElement): void {
  previewCanvasEl = canvas;
}

/**
 * Register the Three.js renderer, scene, and camera for preset-angle thumbnail captures.
 */
export function setPreviewContext(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: PerspectiveCamera
): void {
  previewRenderer = renderer;
  previewScene = scene;
  previewCamera = camera;
}

/**
 * Clear the stored preview canvas reference.
 *
 * After calling this, no preview canvas is registered and thumbnail capture will treat the preview as unavailable.
 */
export function clearPreviewCanvas(): void {
  previewCanvasEl = null;
  previewRenderer = null;
  previewScene = null;
  previewCamera = null;
}

/** Thumbnail size for 3MF package (larger than IndexedDB thumbnails for better quality) */
const THREEMF_THUMBNAIL_SIZE = 256;

/**
 * Capture a thumbnail from the 3D preview as PNG Uint8Array.
 * Used for embedding in 3MF packages.
 * Returns null if canvas isn't available.
 */
export function captureThumbnailPNG(): Promise<Uint8Array | null> {
  if (!previewCanvasEl) return Promise.resolve(null);

  try {
    const offscreen = document.createElement('canvas');
    offscreen.width = THREEMF_THUMBNAIL_SIZE;
    offscreen.height = THREEMF_THUMBNAIL_SIZE;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return Promise.resolve(null);

    const src = previewCanvasEl;
    const srcSize = Math.min(src.width, src.height);
    const srcX = (src.width - srcSize) / 2;
    const srcY = (src.height - srcSize) / 2;

    ctx.drawImage(
      src,
      srcX,
      srcY,
      srcSize,
      srcSize,
      0,
      0,
      THREEMF_THUMBNAIL_SIZE,
      THREEMF_THUMBNAIL_SIZE
    );

    return new Promise((resolve) => {
      offscreen.toBlob((blob) => {
        if (!blob) {
          resolve(null);
          return;
        }
        blob.arrayBuffer().then(
          (buf) => resolve(new Uint8Array(buf)),
          () => resolve(null)
        );
      }, 'image/png');
    });
  } catch {
    return Promise.resolve(null);
  }
}

/**
 * Capture a centered square thumbnail of the current 3D preview canvas.
 *
 * Produces a WebP image scaled to THUMBNAIL_SIZE × THUMBNAIL_SIZE by
 * center-cropping the preview canvas. WebP provides better quality than
 * JPEG at similar file sizes.
 *
 * @returns A WebP data URL for the generated thumbnail, or `null` if the
 *   preview canvas or 2D context is unavailable or if an error occurs.
 */
export function captureThumbnail(): string | null {
  if (!previewCanvasEl) return null;

  try {
    // Create an offscreen canvas at thumbnail size
    const offscreen = document.createElement('canvas');
    offscreen.width = THUMBNAIL_SIZE;
    offscreen.height = THUMBNAIL_SIZE;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return null;

    // Draw the preview canvas scaled down to thumbnail size (center-crop to square)
    const src = previewCanvasEl;
    const srcSize = Math.min(src.width, src.height);
    const srcX = (src.width - srcSize) / 2;
    const srcY = (src.height - srcSize) / 2;

    ctx.drawImage(src, srcX, srcY, srcSize, srcSize, 0, 0, THUMBNAIL_SIZE, THUMBNAIL_SIZE);

    // Export as WebP for best quality/size ratio (0.9 quality for crisp details)
    return offscreen.toDataURL('image/webp', 0.9);
  } catch {
    // Canvas may be tainted or unavailable
    return null;
  }
}

/**
 * Capture a thumbnail from the standard isometric angle, regardless of the user's
 * current camera position. Temporarily repositions the camera, renders one frame,
 * captures, then restores.
 *
 * Falls back to `captureThumbnail()` (current view) if Three.js context is unavailable.
 *
 * @param binDimensions - Width, depth, height in grid units for framing
 * @returns WebP data URL or null
 */
export function captureThumbnailAtPreset(binDimensions: {
  width: number;
  depth: number;
  height: number;
}): string | null {
  if (!previewRenderer || !previewScene || !previewCamera) {
    // Context not registered — fall back to current-view capture
    return captureThumbnail();
  }

  try {
    const { width, depth, height } = binDimensions;
    const totalH = height * GRIDFINITY.HEIGHT_UNIT;
    const binCenter = new Vector3(0, 0, totalH / 2);
    const fov = previewCamera.fov;
    const idealDistance = calculateIdealDistance(width, depth, height, fov);

    // Save current camera state (position, up, and orientation quaternion)
    const savedPosition = previewCamera.position.clone();
    const savedUp = previewCamera.up.clone();
    const savedQuaternion = previewCamera.quaternion.clone();

    // Move to isometric preset
    const targetPosition = ISOMETRIC_DIRECTION.clone().multiplyScalar(idealDistance).add(binCenter);
    previewCamera.position.copy(targetPosition);
    previewCamera.up.set(0, 0, 1);
    previewCamera.lookAt(binCenter);
    previewCamera.updateProjectionMatrix();

    // Temporarily hide ghost overlays (renderOrder >= 2) to avoid capturing
    // transient wireframes/dividers that appear during mesh generation
    const hiddenObjects: { obj: Object3D; wasVisible: boolean }[] = [];
    previewScene.traverse((obj) => {
      if (obj.renderOrder >= 2 && obj.visible) {
        hiddenObjects.push({ obj, wasVisible: true });
        obj.visible = false;
      }
    });

    // Render one frame at preset angle
    previewRenderer.render(previewScene, previewCamera);

    // Capture from the canvas
    const result = captureThumbnail();

    // Restore ghost visibility
    for (const { obj } of hiddenObjects) {
      obj.visible = true;
    }

    // Restore camera to exact previous state (preserves user's orbit target)
    previewCamera.position.copy(savedPosition);
    previewCamera.up.copy(savedUp);
    previewCamera.quaternion.copy(savedQuaternion);
    previewCamera.updateProjectionMatrix();

    // Re-render at original position to avoid visual flash
    previewRenderer.render(previewScene, previewCamera);

    return result;
  } catch {
    return captureThumbnail();
  }
}

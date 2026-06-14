/**
 * Thumbnail capture utility for the Bin Designer.
 *
 * Captures the current state of the Three.js preview canvas and
 * resizes it to a small data URL for storage in IndexedDB.
 */

import type { WebGLRenderer, Scene, PerspectiveCamera, Object3D, Material, Color } from 'three';
import {
  Vector3,
  Group,
  Mesh,
  LineSegments,
  LineBasicMaterial,
  BufferGeometry,
  BufferAttribute,
  MeshStandardMaterial,
} from 'three';
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
export interface ThumbnailCaptureOptions {
  /** Output edge length in pixels. Defaults to THUMBNAIL_SIZE. */
  readonly size?: number;
  /** Image MIME type. Defaults to 'image/webp'. */
  readonly mimeType?: 'image/webp' | 'image/png';
  /** Encoder quality (ignored for PNG). Defaults to 0.9. */
  readonly quality?: number;
}

export function captureThumbnail(options?: ThumbnailCaptureOptions): string | null {
  if (!previewCanvasEl) return null;

  const size = options?.size ?? THUMBNAIL_SIZE;
  const mimeType = options?.mimeType ?? 'image/webp';
  const quality = options?.quality ?? 0.9;

  try {
    // Create an offscreen canvas at thumbnail size
    const offscreen = document.createElement('canvas');
    offscreen.width = size;
    offscreen.height = size;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return null;

    // Draw the preview canvas scaled down to thumbnail size (center-crop to square)
    const src = previewCanvasEl;
    const srcSize = Math.min(src.width, src.height);
    const srcX = (src.width - srcSize) / 2;
    const srcY = (src.height - srcSize) / 2;

    ctx.drawImage(src, srcX, srcY, srcSize, srcSize, 0, 0, size, size);

    return offscreen.toDataURL(mimeType, quality);
  } catch {
    // Canvas may be tainted or unavailable
    return null;
  }
}

function isMesh(obj: Object3D): obj is Mesh {
  return 'isMesh' in obj && obj.isMesh === true;
}

function isLineSegments(obj: Object3D): obj is LineSegments {
  return 'isLineSegments' in obj && obj.isLineSegments === true;
}

/** Black edge lines, matching BinMesh's `EDGE_COLOR` in the 2D preview. */
const EXPORT_EDGE_COLOR = 0x000000;

/**
 * `BufferGeometry.getAttribute` is typed non-null upstream but returns
 * `undefined` when the attribute is absent. Re-widen so the runtime guard the
 * value actually needs isn't flagged as an unnecessary condition.
 */
function positionVertexCount(geo: BufferGeometry): number {
  const pos = geo.getAttribute('position') as
    | ReturnType<BufferGeometry['getAttribute']>
    | undefined;
  return pos ? pos.count : 0;
}

export function __debugSceneMaterials(): unknown {
  if (!previewScene) return null;
  const out: unknown[] = [];
  previewScene.traverse((obj) => {
    if (!obj.visible || !isMesh(obj)) return;
    const geo = obj.geometry;
    const mat = obj.material;
    if (Array.isArray(mat)) {
      out.push({
        name: obj.name,
        type: 'array',
        materials: mat.map((m) => {
          const c = (m as { color?: Color }).color;
          return { type: m.type, hex: c ? c.getHexString() : null };
        }),
        groups: geo.groups.map((g) => ({ mi: g.materialIndex, count: g.count })),
        vertexCount: positionVertexCount(geo),
      });
    } else {
      const c = (mat as { color?: Color }).color;
      out.push({
        name: obj.name,
        type: 'single',
        hex: c ? c.getHexString() : null,
        vertexCount: positionVertexCount(geo),
      });
    }
  });
  return out;
}

/** Reads a `.color` Color off a material instance without a non-null assertion. */
function materialColor(material: Material): Color | null {
  const c = (material as { color?: Color }).color;
  return c ?? null;
}

/** Representative finish for the single baked export material (matches BinMesh). */
const EXPORT_ROUGHNESS = 0.45;
const EXPORT_METALNESS = 0;

/**
 * Build a per-vertex linear-RGB color buffer for one mesh's geometry, reading
 * the ACTUAL rendered material color of each face.
 *
 * For an array material, each geometry group names a `materialIndex`; we look up
 * that slot's material `.color` and paint every vertex the group covers. For a
 * single material, every vertex takes that one color. THREE.Color components are
 * already in linear working space, which is exactly what glTF `COLOR_0` expects,
 * so the components are copied straight through with no extra conversion.
 *
 * Returns null for a mesh whose material exposes no color at all (shadow/ground
 * helper planes), so the export can skip it rather than bake stray white.
 */
function bakeVertexColors(
  geo: BufferGeometry,
  material: Material | Material[]
): Float32Array | null {
  const vertexCount = geo.getAttribute('position').count;

  const paint = (
    colors: Float32Array,
    start: number,
    end: number,
    rgb: readonly [number, number, number]
  ): void => {
    for (let v = start; v < end; v++) {
      colors[v * 3] = rgb[0];
      colors[v * 3 + 1] = rgb[1];
      colors[v * 3 + 2] = rgb[2];
    }
  };

  if (Array.isArray(material)) {
    const bodyColor = material.map(materialColor).find((c) => c !== null) ?? null;
    if (!bodyColor) return null;
    const colors = new Float32Array(vertexCount * 3);
    // Body color is the baseline for any vertex no group covers (e.g. ungrouped
    // ranges between feature groups), matching how those faces render gray.
    paint(colors, 0, vertexCount, [bodyColor.r, bodyColor.g, bodyColor.b]);
    for (const grp of geo.groups) {
      const mat = material.at(grp.materialIndex ?? 0);
      const color = mat ? materialColor(mat) : null;
      const rgb: readonly [number, number, number] = color
        ? [color.r, color.g, color.b]
        : [bodyColor.r, bodyColor.g, bodyColor.b];
      paint(colors, grp.start, grp.start + grp.count, rgb);
    }
    return colors;
  }

  const color = materialColor(material);
  if (!color) return null;
  const colors = new Float32Array(vertexCount * 3);
  paint(colors, 0, vertexCount, [color.r, color.g, color.b]);
  return colors;
}

/**
 * Export the registered preview scene as a binary GLB (glTF) ArrayBuffer.
 *
 * Reads each visible mesh's real rendered material color(s) and bakes them into
 * a per-vertex `color` attribute on ONE merged geometry, exported with a single
 * `MeshStandardMaterial({ vertexColors: true })`. Baking the true colors avoids
 * the GLTFExporter default-material substitution that previously dropped some
 * feature colors (e.g. divider teal), and collapsing to one primitive keeps
 * Draco's per-primitive overhead negligible. Lights and line/edge overlays are
 * excluded (only `Mesh` objects are collected).
 *
 * @returns A GLB ArrayBuffer, or `null` if no preview scene is registered or
 *   the scene contains no visible meshes.
 */
export async function exportPreviewGlb(): Promise<ArrayBuffer | null> {
  if (!previewScene) return null;

  previewScene.updateMatrixWorld(true);

  const geometries: BufferGeometry[] = [];
  const edgeGeometries: BufferGeometry[] = [];
  previewScene.traverse((obj) => {
    if (!obj.visible) return;

    // Precomputed BREP edge lines — baked so the live 3D preview shows the same
    // black outlines as the 2D thumbnail. Position only; black material below.
    if (isLineSegments(obj)) {
      const edge = obj.geometry.clone();
      edge.applyMatrix4(obj.matrixWorld);
      const stripped = new BufferGeometry();
      stripped.setAttribute('position', edge.getAttribute('position'));
      edgeGeometries.push(stripped);
      return;
    }

    if (!isMesh(obj)) return;
    let geo = obj.geometry.clone();
    geo.applyMatrix4(obj.matrixWorld);
    // Non-indexed so vertices are unshared across faces: a per-vertex color can
    // then represent per-face material colors without bleeding across groups,
    // and merging never trips on mismatched index buffers. Draco re-indexes at
    // compression time.
    if (geo.index) geo = geo.toNonIndexed();

    const colors = bakeVertexColors(geo, obj.material);
    // A color-less mesh (shadow/ground helper) bakes no buffer — skip it rather
    // than merge a layout-mismatched geometry.
    if (!colors) return;

    // Strip every attribute except position + the baked color so all geometries
    // share one layout and mergeGeometries accepts the batch.
    const merged = new BufferGeometry();
    merged.setAttribute('position', geo.getAttribute('position'));
    merged.setAttribute('color', new BufferAttribute(colors, 3));
    geometries.push(merged);
  });

  if (geometries.length === 0) return null;

  const { mergeGeometries } = await import('three/examples/jsm/utils/BufferGeometryUtils.js');

  // mergeGeometries returns null on incompatible input despite its non-null
  // type; the typed helper isolates that runtime-null contract.
  const merge = (parts: BufferGeometry[]): BufferGeometry | null => {
    const result: unknown = mergeGeometries(parts, false);
    return result instanceof BufferGeometry ? result : null;
  };

  const combined = geometries.length === 1 ? geometries[0] : merge(geometries);
  if (!combined) return null;
  combined.clearGroups();

  const group = new Group();
  group.add(
    new Mesh(
      combined,
      new MeshStandardMaterial({
        vertexColors: true,
        roughness: EXPORT_ROUGHNESS,
        metalness: EXPORT_METALNESS,
      })
    )
  );

  const edges = edgeGeometries.length === 1 ? edgeGeometries[0] : merge(edgeGeometries);
  if (edges) {
    group.add(new LineSegments(edges, new LineBasicMaterial({ color: EXPORT_EDGE_COLOR })));
  }

  const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
  const out = await new GLTFExporter().parseAsync(group, { binary: true, onlyVisible: true });
  return out as ArrayBuffer;
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
export function captureThumbnailAtPreset(
  binDimensions: {
    width: number;
    depth: number;
    height: number;
    gridUnitMm: number;
    heightUnitMm: number;
  },
  options?: ThumbnailCaptureOptions
): string | null {
  if (!previewRenderer || !previewScene || !previewCamera) {
    // Context not registered — fall back to current-view capture
    return captureThumbnail(options);
  }

  try {
    const { width, depth, height, gridUnitMm, heightUnitMm } = binDimensions;
    const totalH = height * heightUnitMm;
    const binCenter = new Vector3(0, 0, totalH / 2);
    const fov = previewCamera.fov;
    const idealDistance = calculateIdealDistance(
      width,
      depth,
      height,
      fov,
      gridUnitMm,
      heightUnitMm
    );

    // Save current camera state (position, up, and orientation quaternion)
    const savedPosition = previewCamera.position.clone();
    const savedUp = previewCamera.up.clone();
    const savedQuaternion = previewCamera.quaternion.clone();

    // Move to isometric preset
    const targetPosition = new Vector3(
      ISOMETRIC_DIRECTION.x,
      ISOMETRIC_DIRECTION.y,
      ISOMETRIC_DIRECTION.z
    )
      .multiplyScalar(idealDistance)
      .add(binCenter);
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
    const result = captureThumbnail(options);

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
    return captureThumbnail(options);
  }
}

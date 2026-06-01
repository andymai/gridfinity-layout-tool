/**
 * Thumbnail capture utility for the Bin Designer.
 *
 * Captures the current state of the Three.js preview canvas and
 * resizes it to a small data URL for storage in IndexedDB.
 */

import type { WebGLRenderer, Scene, PerspectiveCamera, Object3D, Material } from 'three';
import { Vector3, Group, Mesh, BufferGeometry, BufferAttribute } from 'three';
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

/**
 * Key a geometry by its attribute layout. mergeGeometries() requires every
 * member of a merge to share the exact same attribute names and item sizes, so
 * geometries with differing layouts must land in separate merge buckets. Index
 * presence is normalized away before merging (see exportPreviewGlb), so it is
 * deliberately excluded from the signature.
 */
function attributeSignature(geo: BufferGeometry): string {
  return Object.keys(geo.attributes)
    .sort()
    .map((name) => `${name}:${geo.attributes[name].itemSize}`)
    .join(',');
}

/** Material fields that distinguish exported appearance (all optional by type). */
interface MaterialAppearance {
  color?: { getHexString: () => string };
  emissive?: { getHexString: () => string };
  metalness?: number;
  roughness?: number;
  opacity?: number;
  transparent?: boolean;
  side?: number;
  emissiveIntensity?: number;
}

/**
 * Key a material by its visible appearance rather than instance identity. The
 * bin preview assigns a fresh material instance per feature mesh even when the
 * appearance is identical, so identity-keyed buckets never merge. Hashing the
 * appearance lets like-looking meshes collapse into one primitive while keeping
 * distinct colors/finishes separate.
 */
function materialSignature(material: Material): string {
  const m: MaterialAppearance = material;
  return [
    material.type,
    m.color ? m.color.getHexString() : '',
    m.emissive ? m.emissive.getHexString() : '',
    m.metalness === undefined ? '' : String(m.metalness),
    m.roughness === undefined ? '' : String(m.roughness),
    m.opacity === undefined ? '' : String(m.opacity),
    m.transparent === true ? 't' : 'f',
    m.side === undefined ? '' : String(m.side),
    m.emissiveIntensity === undefined ? '' : String(m.emissiveIntensity),
  ].join('|');
}

interface MergeBucket {
  material: Material;
  geometries: BufferGeometry[];
}

/**
 * Route a single-material geometry into a merge bucket keyed by both material
 * appearance and attribute layout, so every geometry in a bucket is mergeable
 * into one primitive that keeps that material's appearance.
 */
function addToBuckets(
  buckets: Map<string, MergeBucket>,
  geo: BufferGeometry,
  material: Material
): void {
  const bucketKey = `${materialSignature(material)}::${attributeSignature(geo)}`;
  const bucket = buckets.get(bucketKey);
  if (bucket) {
    bucket.geometries.push(geo);
  } else {
    buckets.set(bucketKey, { material, geometries: [geo] });
  }
}

/**
 * Split a multi-material (array-material) geometry into one non-indexed
 * geometry per material slot, copying only the triangles each slot's groups
 * cover. The bin body is exported as a single geometry with hundreds of
 * single-material groups; GLTFExporter would emit one primitive per group,
 * re-fragmenting the buffer. Collapsing per slot lets the merge step rebuild it
 * as one primitive per distinct material.
 */
function splitByMaterialGroup(
  geo: BufferGeometry,
  materials: readonly Material[]
): { geometry: BufferGeometry; material: Material }[] {
  const attributeNames = Object.keys(geo.attributes);
  if (!attributeNames.includes('position')) return [];
  const byIndex = new Map<number, number[]>();
  for (const grp of geo.groups) {
    const materialIndex = grp.materialIndex ?? 0;
    const ranges = byIndex.get(materialIndex) ?? [];
    for (let i = grp.start; i < grp.start + grp.count; i++) ranges.push(i);
    byIndex.set(materialIndex, ranges);
  }

  const out: { geometry: BufferGeometry; material: Material }[] = [];
  for (const [materialIndex, vertexIndices] of byIndex) {
    const material = materials.at(materialIndex);
    if (!material) continue;
    const slot = new BufferGeometry();
    for (const name of attributeNames) {
      const src = geo.getAttribute(name);
      const itemSize = src.itemSize;
      const dst = new Float32Array(vertexIndices.length * itemSize);
      for (let v = 0; v < vertexIndices.length; v++) {
        const dstBase = v * itemSize;
        for (let c = 0; c < itemSize; c++) {
          dst[dstBase + c] = src.getComponent(vertexIndices[v], c);
        }
      }
      slot.setAttribute(name, new BufferAttribute(dst, itemSize));
    }
    out.push({ geometry: slot, material });
  }
  return out;
}

/**
 * Export the registered preview scene as a binary GLB (glTF) ArrayBuffer.
 *
 * Bakes world transforms into each visible mesh's geometry and reuses the
 * rendered materials so feature colors carry into the export. Lights and
 * line/edge overlays are excluded (only `Mesh` objects are collected).
 *
 * Geometries sharing one material appearance and attribute layout are merged
 * into a single primitive (multi-material meshes are first split per slot, then
 * merged): the bin preview is built from many small meshes / many single-material
 * groups, and Draco compression at gen time has per-primitive overhead that
 * would otherwise dwarf (and even invert) its savings on hundreds of primitives.
 *
 * @returns A GLB ArrayBuffer, or `null` if no preview scene is registered or
 *   the scene contains no visible meshes.
 */
export async function exportPreviewGlb(): Promise<ArrayBuffer | null> {
  if (!previewScene) return null;

  previewScene.updateMatrixWorld(true);

  // Bucket geometries by (material appearance, attribute layout) so each bucket
  // is mergeable. Keying on appearance (not instance identity) is essential: the
  // preview gives every feature mesh a distinct material instance, so without it
  // every bucket has one member and nothing merges.
  const buckets = new Map<string, MergeBucket>();
  previewScene.traverse((obj) => {
    if (!obj.visible || !isMesh(obj)) return;
    let geo = obj.geometry.clone();
    geo.applyMatrix4(obj.matrixWorld);
    // Normalize to non-indexed so geometries with and without an index buffer
    // (and with differing index types) merge without mergeGeometries rejecting
    // the batch. Draco re-indexes on its own at compression time.
    if (geo.index) geo = geo.toNonIndexed();
    if (Array.isArray(obj.material)) {
      for (const part of splitByMaterialGroup(geo, obj.material)) {
        addToBuckets(buckets, part.geometry, part.material);
      }
      return;
    }
    geo.clearGroups();
    addToBuckets(buckets, geo, obj.material);
  });

  const { mergeGeometries } = await import('three/examples/jsm/utils/BufferGeometryUtils.js');

  const group = new Group();
  for (const { material, geometries } of buckets.values()) {
    if (geometries.length === 1) {
      group.add(new Mesh(geometries[0], material));
      continue;
    }
    // mergeGeometries returns null on incompatible input despite its non-null
    // type; route through unknown so the runtime-null fallback stays honest and
    // nothing is silently dropped from the export.
    const mergeResult: unknown = mergeGeometries(geometries, false);
    if (mergeResult instanceof BufferGeometry) {
      mergeResult.clearGroups();
      group.add(new Mesh(mergeResult, material));
    } else {
      for (const geo of geometries) group.add(new Mesh(geo, material));
    }
  }

  if (group.children.length === 0) return null;

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

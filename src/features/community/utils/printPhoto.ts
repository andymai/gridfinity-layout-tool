/**
 * Turn a user-picked image file into an upload-ready WebP data URL.
 *
 * The re-encode is what strips EXIF: a canvas holds pixels only, so writing a
 * fresh WebP stream from it drops every metadata chunk the original carried,
 * GPS coordinates included. That is a privacy property, not a side effect, and
 * it is the reason this runs before the bytes ever reach the network rather
 * than being cleaned up server-side.
 *
 * The server re-checks bytes and canvas dimensions independently, because a
 * hostile client can post whatever it likes. This module exists to make the
 * honest path cheap, not to enforce the limits.
 */

import type { Result } from '@/core/result';
import { err, ok } from '@/core/result';
import {
  COMMUNITY_PRINT_PHOTO_MAX_BYTES,
  COMMUNITY_PRINT_PHOTO_MAX_EDGE_PX,
  COMMUNITY_PRINT_THUMB_MAX_BYTES,
  COMMUNITY_PRINT_THUMB_MAX_EDGE_PX,
} from '@/shared/types/communityPrint';

export type PrintPhotoError =
  | { kind: 'notAnImage' }
  | { kind: 'sourceTooLarge'; bytes: number }
  | { kind: 'decodeFailed' }
  | { kind: 'encodeFailed' }
  /** Survived the whole quality ladder and still exceeds the cap. */
  | { kind: 'irreducible' };

/**
 * Ceiling on the file a user may hand us, distinct from the encoded output
 * cap. Generous enough for a modern phone photo (a 48MP HEIC/JPEG lands well
 * under this) while bounding what a decode is asked to hold in memory.
 */
export const PRINT_PHOTO_MAX_SOURCE_BYTES = 25_000_000;

/**
 * Quality ladder walked until the encode fits the byte cap. Starts where WebP
 * still looks clean for photographic content and stops before it turns to
 * mush; below this the scale ladder takes over, because dropping resolution
 * looks better than heavy quantisation at the same file size.
 */
const QUALITY_STEPS = [0.82, 0.7, 0.6, 0.5, 0.42] as const;

/** Applied in turn if the full quality ladder still cannot fit the cap. */
const SCALE_STEPS = [1, 0.8, 0.65, 0.5] as const;

function fittedSize(
  width: number,
  height: number,
  maxEdge: number
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const ratio = maxEdge / longest;
  // Round rather than floor: flooring a 1200.4 edge to 1200 is fine, but
  // flooring both axes of a small image can collapse one to 0 and make the
  // canvas throw.
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

function canvasToWebp(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/webp', quality);
  });
}

async function blobToDataUrl(blob: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

async function decode(file: File): Promise<ImageBitmap | null> {
  try {
    // `from-image` applies the EXIF orientation tag during decode. Without it
    // a photo shot in portrait on a phone arrives sideways, because the tag
    // says "rotate 90" and the raw pixel buffer is landscape. Since the
    // re-encode then discards the tag, an unrotated decode would bake the
    // wrong orientation in permanently.
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return null;
  }
}

export interface PreparedPrintPhoto {
  /** `data:image/webp;base64,...`, ready to hand to the prints endpoint. */
  readonly dataUrl: string;
  readonly width: number;
  readonly height: number;
  readonly bytes: number;
  /**
   * Browsing-sized copy of the same image, or null when the browser could not
   * produce one.
   *
   * Every surface that lists photos renders them small — a 78px filmstrip
   * tile, a 117px print-grid cell, a ~200px gallery card — so shipping the
   * 1200px original to those was most of a detail view's image weight. It is
   * cut here, from the decoded bitmap already in hand, rather than server-side:
   * the bytes are already passing through a canvas for the EXIF strip, so the
   * second encode costs one more draw and no new infrastructure.
   *
   * Null rather than fatal: a print with photos and no thumbnails is worth
   * more than no print, and every reader falls back to the full image.
   */
  readonly thumbDataUrl: string | null;
}

/**
 * Encode `bitmap` at `maxEdge`, walking the quality ladder until it fits.
 * Returns null rather than throwing — see thumbDataUrl on why a missing
 * browsing copy is not a failure.
 */
async function encodeThumb(
  bitmap: ImageBitmap,
  maxEdge: number,
  maxBytes: number
): Promise<string | null> {
  const { width, height } = fittedSize(bitmap.width, bitmap.height, maxEdge);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (context === null) return null;
  context.drawImage(bitmap, 0, 0, width, height);
  for (const quality of QUALITY_STEPS) {
    const blob = await canvasToWebp(canvas, quality);
    if (blob === null) continue;
    if (blob.size > maxBytes) continue;
    return await blobToDataUrl(blob);
  }
  return null;
}

export async function preparePrintPhoto(
  file: File
): Promise<Result<PreparedPrintPhoto, PrintPhotoError>> {
  if (!file.type.startsWith('image/')) return err({ kind: 'notAnImage' });
  if (file.size > PRINT_PHOTO_MAX_SOURCE_BYTES) {
    return err({ kind: 'sourceTooLarge', bytes: file.size });
  }

  const bitmap = await decode(file);
  if (bitmap === null) return err({ kind: 'decodeFailed' });

  try {
    const base = fittedSize(bitmap.width, bitmap.height, COMMUNITY_PRINT_PHOTO_MAX_EDGE_PX);
    let encodedAnything = false;

    for (const scale of SCALE_STEPS) {
      const width = Math.max(1, Math.round(base.width * scale));
      const height = Math.max(1, Math.round(base.height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (context === null) return err({ kind: 'encodeFailed' });
      context.drawImage(bitmap, 0, 0, width, height);

      for (const quality of QUALITY_STEPS) {
        const blob = await canvasToWebp(canvas, quality);
        if (blob === null) continue;
        encodedAnything = true;
        if (blob.size > COMMUNITY_PRINT_PHOTO_MAX_BYTES) continue;
        const dataUrl = await blobToDataUrl(blob);
        if (dataUrl === null) return err({ kind: 'encodeFailed' });
        // A photo already inside the browsing size is its own thumbnail;
        // storing a second copy of it would cost an upload and save nothing.
        const thumbDataUrl =
          Math.max(width, height) <= COMMUNITY_PRINT_THUMB_MAX_EDGE_PX
            ? null
            : await encodeThumb(
                bitmap,
                COMMUNITY_PRINT_THUMB_MAX_EDGE_PX,
                COMMUNITY_PRINT_THUMB_MAX_BYTES
              );
        return ok({ dataUrl, width, height, bytes: blob.size, thumbDataUrl });
      }
    }

    // Nothing encoded at all means the browser refused WebP; every attempt
    // landing over the cap is a different failure, and the user can act on it
    // (crop, pick another shot) so it gets its own error.
    return err(encodedAnything ? { kind: 'irreducible' } : { kind: 'encodeFailed' });
  } finally {
    bitmap.close();
  }
}

/**
 * Label images: one PNG per label, sized in printer dots.
 *
 * Thermal heads print dots, not grey, so every pixel is pushed to pure black
 * or white here rather than left to the printer app's dithering, which frays
 * small type. The physical size rides along in a `pHYs` chunk, which desktop
 * label software reads to place the image at its true size.
 */

import type { LabelPath, LabelPlan } from './planLabel';

const MM_PER_INCH = 25.4;

/** Pixel size of a label at `dpi`. */
export function labelPixelSize(plan: LabelPlan, dpi: number): { width: number; height: number } {
  return {
    width: Math.max(1, Math.round((plan.widthMm / MM_PER_INCH) * dpi)),
    height: Math.max(1, Math.round((plan.heightMm / MM_PER_INCH) * dpi)),
  };
}

let crcTable: Uint32Array | null = null;

function crc32(bytes: Uint8Array): number {
  if (crcTable === null) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

const PNG_SIGNATURE_LENGTH = 8;

function physChunk(dpi: number): Uint8Array {
  const pixelsPerMetre = Math.round(dpi / (MM_PER_INCH / 1000));
  const chunk = new Uint8Array(4 + 4 + 9 + 4);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, 9);
  chunk.set([0x70, 0x48, 0x59, 0x73], 4); // "pHYs"
  view.setUint32(8, pixelsPerMetre);
  view.setUint32(12, pixelsPerMetre);
  chunk[16] = 1; // unit: metre
  view.setUint32(17, crc32(chunk.subarray(4, 17)));
  return chunk;
}

/**
 * Set the PNG's resolution to `dpi`, replacing a `pHYs` chunk the encoder
 * wrote or adding one after `IHDR`.
 */
export function withPngDpi(png: Uint8Array, dpi: number): Uint8Array {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const phys = physChunk(dpi);
  let offset = PNG_SIGNATURE_LENGTH;
  let afterHeader = -1;
  while (offset + 8 <= png.length) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(...png.subarray(offset + 4, offset + 8));
    const end = offset + 12 + length;
    if (type === 'IHDR') afterHeader = end;
    if (type === 'pHYs') {
      const out = new Uint8Array(png.length - (end - offset) + phys.length);
      out.set(png.subarray(0, offset));
      out.set(phys, offset);
      out.set(png.subarray(end), offset + phys.length);
      return out;
    }
    if (type === 'IDAT') break;
    offset = end;
  }
  if (afterHeader < 0) return png;
  const out = new Uint8Array(png.length + phys.length);
  out.set(png.subarray(0, afterHeader));
  out.set(phys, afterHeader);
  out.set(png.subarray(afterHeader), afterHeader + phys.length);
  return out;
}

/** Push every pixel to pure black or white, in place. */
export function thresholdToMonochrome(rgba: Uint8ClampedArray): void {
  for (let i = 0; i < rgba.length; i += 4) {
    // Ink is drawn black on white, so the red channel alone carries coverage.
    const value = rgba[i] < 128 ? 0 : 255;
    rgba[i] = value;
    rgba[i + 1] = value;
    rgba[i + 2] = value;
    rgba[i + 3] = 255;
  }
}

/** Draw a planned label into a PNG at `dpi`. Browser only: it needs a canvas. */
export async function renderLabelPng(
  plan: LabelPlan,
  paths: readonly LabelPath[],
  dpi: number
): Promise<Uint8Array> {
  const { width, height } = labelPixelSize(plan, dpi);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is unavailable');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  const scale = dpi / MM_PER_INCH;
  ctx.setTransform(scale, 0, 0, -scale, width / 2, height / 2);
  ctx.fillStyle = '#000000';
  for (const path of paths) {
    ctx.save();
    ctx.translate(path.x, path.y);
    ctx.fill(new Path2D(path.d));
    ctx.restore();
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  const image = ctx.getImageData(0, 0, width, height);
  thresholdToMonochrome(image.data);
  ctx.putImageData(image, 0, 0);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('PNG encoding failed');
  return withPngDpi(new Uint8Array(await blob.arrayBuffer()), dpi);
}

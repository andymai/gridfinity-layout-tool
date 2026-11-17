/**
 * Label images: one PNG per label, sized in printer dots.
 *
 * Thermal heads print dots, not grey, so every pixel is pushed to pure black
 * or white here rather than left to the printer app's dithering, which frays
 * small type. The physical size rides along in a `pHYs` chunk, which desktop
 * label software reads to place the image at its true size.
 */

import { MM_PER_INCH } from './labelMedia';
import type { LabelPath, LabelPlan } from './planLabel';

export function labelPixelSize(plan: LabelPlan, dpi: number): { width: number; height: number } {
  return {
    width: Math.max(1, Math.round((plan.widthMm / MM_PER_INCH) * dpi)),
    height: Math.max(1, Math.round((plan.heightMm / MM_PER_INCH) * dpi)),
  };
}

const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
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

function splice(bytes: Uint8Array, start: number, end: number, insert: Uint8Array): Uint8Array {
  const out = new Uint8Array(bytes.length - (end - start) + insert.length);
  out.set(bytes.subarray(0, start));
  out.set(insert, start);
  out.set(bytes.subarray(end), start + insert.length);
  return out;
}

export function withPngDpi(png: Uint8Array, dpi: number): Uint8Array {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  let offset = PNG_SIGNATURE_LENGTH;
  let afterHeader = -1;
  while (offset + 8 <= png.length) {
    const type = String.fromCharCode(...png.subarray(offset + 4, offset + 8));
    const end = offset + 12 + view.getUint32(offset);
    if (type === 'IHDR') afterHeader = end;
    if (type === 'pHYs') return splice(png, offset, end, physChunk(dpi));
    if (type === 'IDAT') break;
    offset = end;
  }
  if (afterHeader < 0) return png;
  return splice(png, afterHeader, afterHeader, physChunk(dpi));
}

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

/** Browser only: it needs a canvas, so tests cover the plan and the bytes instead. */
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
    ctx.translate(0, path.y);
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

import { describe, expect, it } from 'vitest';
import { crc32 } from 'node:zlib';
import { labelPixelSize, thresholdToMonochrome, withPngDpi } from './labelPng';
import type { LabelPlan } from './planLabel';

function chunk(type: string, data: number[]): number[] {
  const length = [0, 0, 0, data.length];
  return [...length, ...Array.from(type, (c) => c.charCodeAt(0)), ...data, 0, 0, 0, 0];
}

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const IHDR = chunk(
  'IHDR',
  Array.from({ length: 13 }, () => 1)
);
const IDAT = chunk('IDAT', [7, 7]);
const IEND = chunk('IEND', []);

function chunkTypes(png: Uint8Array): string[] {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const types: string[] = [];
  for (let offset = 8; offset < png.length; offset += 12 + view.getUint32(offset)) {
    types.push(String.fromCharCode(...png.subarray(offset + 4, offset + 8)));
  }
  return types;
}

function physAt(png: Uint8Array): { ppm: number; unit: number; crcOk: boolean } {
  const offset = 8 + IHDR.length;
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  return {
    ppm: view.getUint32(offset + 8),
    unit: png[offset + 16],
    crcOk: view.getUint32(offset + 17) === crc32(png.subarray(offset + 4, offset + 17)),
  };
}

describe('withPngDpi', () => {
  it('adds a pHYs chunk after IHDR', () => {
    const png = withPngDpi(new Uint8Array([...SIGNATURE, ...IHDR, ...IDAT, ...IEND]), 180);

    expect(chunkTypes(png)).toEqual(['IHDR', 'pHYs', 'IDAT', 'IEND']);
    expect(physAt(png)).toEqual({ ppm: 7087, unit: 1, crcOk: true });
  });

  it('replaces a pHYs chunk the encoder wrote', () => {
    const encoded = [...SIGNATURE, ...IHDR, ...chunk('pHYs', Array(9).fill(0)), ...IDAT, ...IEND];
    const png = withPngDpi(new Uint8Array(encoded), 203);

    expect(chunkTypes(png)).toEqual(['IHDR', 'pHYs', 'IDAT', 'IEND']);
    expect(png.length).toBe(encoded.length);
    expect(physAt(png)).toEqual({ ppm: 7992, unit: 1, crcOk: true });
  });

  it('leaves bytes without a header alone', () => {
    const bytes = new Uint8Array([1, 2, 3]);
    expect(withPngDpi(bytes, 180)).toBe(bytes);
  });
});

describe('labelPixelSize', () => {
  it('maps millimetres to whole printer dots', () => {
    const plan: LabelPlan = { widthMm: 40, heightMm: (96 / 203) * 25.4, blocks: [], problem: null };
    expect(labelPixelSize(plan, 203)).toEqual({ width: 320, height: 96 });
  });
});

describe('thresholdToMonochrome', () => {
  it('pushes grey to black or white and makes every pixel opaque', () => {
    const rgba = new Uint8ClampedArray([10, 10, 10, 255, 200, 200, 200, 128, 127, 127, 127, 0]);
    thresholdToMonochrome(rgba);
    expect(Array.from(rgba)).toEqual([0, 0, 0, 255, 255, 255, 255, 255, 0, 0, 0, 255]);
  });
});

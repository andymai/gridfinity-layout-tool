import { describe, expect, it } from 'vitest';
import { Buffer } from './bufferShim';

describe('bufferShim Buffer.from', () => {
  it('wraps an ArrayBuffer', () => {
    const src = new Uint8Array([1, 2, 3]).buffer;
    const buf = Buffer.from(src);
    expect(Array.from(buf)).toEqual([1, 2, 3]);
    expect(buf.length).toBe(3);
  });

  it('copies a number array and a Uint8Array', () => {
    expect(Array.from(Buffer.from([9, 8, 7]))).toEqual([9, 8, 7]);
    expect(Array.from(Buffer.from(new Uint8Array([4, 5])))).toEqual([4, 5]);
  });
});

describe('bufferShim Buffer.concat', () => {
  it('joins parts in order', () => {
    const joined = Buffer.concat([Buffer.from([1]), Buffer.from([2, 3]), Buffer.from([4])]);
    expect(Array.from(joined)).toEqual([1, 2, 3, 4]);
  });
});

describe('bufferShim read methods', () => {
  it('readUInt8 returns the byte at the offset', () => {
    expect(Buffer.from([0x00, 0x7f, 0xff]).readUInt8(2)).toBe(255);
  });

  it('readInt16LE decodes little-endian signed 16-bit values', () => {
    // 0x0100 LE = 256
    expect(Buffer.from([0x00, 0x01]).readInt16LE(0)).toBe(256);
    // 0xffff LE = -1
    expect(Buffer.from([0xff, 0xff]).readInt16LE(0)).toBe(-1);
    // 0x00 0x80 LE = -32768 (sign bit set)
    expect(Buffer.from([0x00, 0x80]).readInt16LE(0)).toBe(-32768);
    // read at a non-zero offset
    expect(Buffer.from([0, 0, 0x2c, 0x01]).readInt16LE(2)).toBe(300);
  });
});

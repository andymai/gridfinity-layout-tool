/**
 * Minimal `buffer` replacement for spacemouse-webhid. The library only needs
 * `Buffer.from`, `Buffer.concat`, `readUInt8` and `readInt16LE` to parse HID
 * reports, so aliasing `buffer` to this (via vite.config) keeps the full
 * feross/buffer polyfill (~7 kB gzip) out of the bundle. Nothing else in the
 * app imports `buffer`.
 */
export interface HidBuffer extends Uint8Array {
  readUInt8(offset: number): number;
  readInt16LE(offset: number): number;
}

const methods = {
  readUInt8(this: Uint8Array, offset: number): number {
    return this[offset];
  },
  readInt16LE(this: Uint8Array, offset: number): number {
    const value = this[offset] | (this[offset + 1] << 8);
    return value & 0x8000 ? value - 0x10000 : value;
  },
};

function wrap(bytes: Uint8Array): HidBuffer {
  return Object.assign(bytes, methods);
}

export const Buffer = {
  from(source: ArrayBuffer | ArrayLike<number> | Uint8Array): HidBuffer {
    if (source instanceof ArrayBuffer) return wrap(new Uint8Array(source));
    if (source instanceof Uint8Array) return wrap(source);
    return wrap(Uint8Array.from(source));
  },
  concat(list: readonly Uint8Array[]): HidBuffer {
    let length = 0;
    for (const part of list) length += part.length;
    const out = new Uint8Array(length);
    let offset = 0;
    for (const part of list) {
      out.set(part, offset);
      offset += part.length;
    }
    return wrap(out);
  },
};

export default { Buffer };

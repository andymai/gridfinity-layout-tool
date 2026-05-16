import { describe, it, expect } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { packagePiecesAsZip } from './zipExport';

/**
 * Roundtrip through real fflate — the previous JSZip-mock-based suite proved
 * the wrapper called `.file()` with the right args but never exercised the
 * actual ZIP encoding, so a bad piece-buffer shape (e.g. an ArrayBuffer left
 * un-wrapped) would slip through.
 */
async function unzip(blob: Blob): Promise<Record<string, Uint8Array>> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return unzipSync(bytes);
}

function bufferOf(byte: number, length: number): ArrayBuffer {
  const buf = new ArrayBuffer(length);
  new Uint8Array(buf).fill(byte);
  return buf;
}

describe('packagePiecesAsZip', () => {
  it('creates a ZIP with one file per piece using the given extension', async () => {
    const pieces = [
      { data: bufferOf(0xa1, 16), label: 'piece-A1' },
      { data: bufferOf(0xb2, 32), label: 'piece-B2' },
    ];

    const entries = await unzip(packagePiecesAsZip(pieces, 'my-baseplate', '.stl'));
    expect(Object.keys(entries).sort()).toEqual([
      'my-baseplate_piece-A1.stl',
      'my-baseplate_piece-B2.stl',
    ]);
    expect(entries['my-baseplate_piece-A1.stl'].length).toBe(16);
    expect(entries['my-baseplate_piece-A1.stl'][0]).toBe(0xa1);
    expect(entries['my-baseplate_piece-B2.stl'].length).toBe(32);
    expect(entries['my-baseplate_piece-B2.stl'][0]).toBe(0xb2);
  });

  it('preserves piece bytes exactly through the encode → decode roundtrip', async () => {
    const original = new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0x00, 0x01, 0x02, 0xff]);
    const entries = await unzip(
      packagePiecesAsZip([{ data: original.buffer, label: 'p' }], 'test', '.bin')
    );
    expect(Array.from(entries['test_p.bin'])).toEqual(Array.from(original));
  });

  it('uses the provided extension parameter', async () => {
    const entries = await unzip(
      packagePiecesAsZip([{ data: new ArrayBuffer(8), label: 'part' }], 'base', '.step')
    );
    expect(Object.keys(entries)).toEqual(['base_part.step']);
  });

  it('includes extra text files in the ZIP when provided', async () => {
    const entries = await unzip(
      packagePiecesAsZip([{ data: new ArrayBuffer(8), label: 'corner' }], 'test', '.stl', [
        { name: 'print-guide.txt', content: 'Hello world' },
      ])
    );
    expect(Object.keys(entries).sort()).toEqual(['print-guide.txt', 'test_corner.stl']);
    expect(strFromU8(entries['print-guide.txt'])).toBe('Hello world');
  });

  it.each([
    ['undefined', undefined],
    ['empty array', []],
  ])('skips extra files when %s', async (_, extra) => {
    const entries = await unzip(
      packagePiecesAsZip([{ data: new ArrayBuffer(8), label: 'piece' }], 'test', '.stl', extra)
    );
    expect(Object.keys(entries)).toEqual(['test_piece.stl']);
  });

  it('returns an application/zip blob', async () => {
    const blob = packagePiecesAsZip([{ data: new ArrayBuffer(8), label: 'x' }], 'name', '.stl');
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('application/zip');
  });
});

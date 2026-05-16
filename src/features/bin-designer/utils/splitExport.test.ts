import { describe, it, expect } from 'vitest';
import { unzipSync } from 'fflate';
import { packageSplitPiecesAsZip } from './splitExport';

async function unzip(blob: Blob): Promise<Record<string, Uint8Array>> {
  return unzipSync(new Uint8Array(await blob.arrayBuffer()));
}

describe('packageSplitPiecesAsZip', () => {
  it('creates a ZIP with one file per piece', async () => {
    const pieces = [
      { data: new ArrayBuffer(100), label: 'piece-1x1' },
      { data: new ArrayBuffer(200), label: 'piece-2x1' },
    ];

    const entries = await unzip(packageSplitPiecesAsZip(pieces, 'my-bin'));
    expect(Object.keys(entries).sort()).toEqual(['my-bin_piece-1x1.stl', 'my-bin_piece-2x1.stl']);
    expect(entries['my-bin_piece-1x1.stl'].length).toBe(100);
    expect(entries['my-bin_piece-2x1.stl'].length).toBe(200);
  });

  it('handles single piece', async () => {
    const entries = await unzip(
      packageSplitPiecesAsZip([{ data: new ArrayBuffer(50), label: 'piece-1x1' }], 'test')
    );
    expect(Object.keys(entries)).toEqual(['test_piece-1x1.stl']);
  });
});

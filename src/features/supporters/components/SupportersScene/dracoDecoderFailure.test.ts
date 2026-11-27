import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DRACOLoader, GLTFLoader } from 'three-stdlib';

// The real loaders drei's useGLTF builds, on a real Draco GLB. Only the
// network is stubbed: a challenged client gets a 429 for the decoder files.
const plateGlb = readFileSync(join(__dirname, '../../data/meshes/plate-cell.glb'));

function parseGlb(): Promise<unknown> {
  // A copy in this realm's ArrayBuffer: GLTFLoader tests `instanceof ArrayBuffer`,
  // and jsdom's global is not the one Node's Buffer uses.
  const buffer = new ArrayBuffer(plateGlb.byteLength);
  new Uint8Array(buffer).set(plateGlb);
  const loader = new GLTFLoader().setDRACOLoader(
    new DRACOLoader().setDecoderPath('https://gridfinity.test/draco/')
  );
  return new Promise((resolve, reject) => loader.parse(buffer, '', resolve, reject));
}

describe('Draco GLB load when the decoder fetch fails', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects the load with the fetch error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 429 }))
    );
    const stillPending = new Promise((resolve) => setTimeout(() => resolve('still pending'), 1000));

    await expect(Promise.race([parseGlb(), stillPending])).rejects.toThrow(/responded with 429/);
  });
});

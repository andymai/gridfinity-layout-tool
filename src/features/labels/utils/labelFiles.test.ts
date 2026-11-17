import { describe, expect, it } from 'vitest';
import { unzipSync } from 'fflate';
import { labelFileName, zipLabelFiles } from './labelFiles';

describe('labelFileName', () => {
  it('numbers by list position, padded to the list length', () => {
    expect(labelFileName(2, 12, 'Socket Head Screw M3 × 8', 1)).toBe(
      '03-socket-head-screw-m3-8.png'
    );
    expect(labelFileName(0, 3, 'Nuts', 1)).toBe('1-nuts.png');
  });

  it('adds the copy count and folds accents', () => {
    expect(labelFileName(0, 1, 'Écrous M4', 4)).toBe('1-ecrous-m4-x4.png');
  });

  it('falls back when a name has no Latin letters or digits', () => {
    expect(labelFileName(0, 1, '螺丝', 1)).toBe('1-label.png');
  });

  it('trims a long name at the last word that fits', () => {
    expect(labelFileName(0, 1, 'Black-Oxide Alloy Steel Socket Head Screw, M3', 1)).toBe(
      '1-black-oxide-alloy-steel-socket-head.png'
    );
    expect(labelFileName(0, 1, 'x'.repeat(50), 1)).toBe(`1-${'x'.repeat(40)}.png`);
  });
});

describe('zipLabelFiles', () => {
  it('stores each file under its name', async () => {
    const blob = zipLabelFiles([
      { name: '1-a.png', data: new Uint8Array([1, 2]) },
      { name: '2-b.png', data: new Uint8Array([3]) },
    ]);
    const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));

    expect(blob.type).toBe('application/zip');
    expect(Object.keys(files)).toEqual(['1-a.png', '2-b.png']);
    expect(Array.from(files['2-b.png'])).toEqual([3]);
  });
});

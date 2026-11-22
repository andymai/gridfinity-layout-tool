import { describe, it, expect } from 'vitest';
import type { Cutout } from '@/features/bin-designer/types';
import { getStaticTranslation } from '@/i18n';
import type { TFunction } from '@/i18n';
import { exportLibraryItemJSON, parseLibraryItemJSON } from './libraryFile';

const t: TFunction = getStaticTranslation;

const cutout: Cutout = {
  id: 'a',
  shape: 'rectangle',
  x: 0,
  y: 0,
  width: 20,
  depth: 10,
  cutDepth: 5,
  rotation: 0,
  cornerRadius: 0,
  label: 'Tape',
  groupId: 'g',
  groupOp: 'union',
};

describe('library item file', () => {
  it('reads back what it writes', () => {
    const json = exportLibraryItemJSON('Tape', {
      params: { cutouts: [cutout], cutoutGroupNames: { g: 'Roll' } },
    });
    const parsed = parseLibraryItemJSON(json, t);
    expect(parsed?.name).toBe('Tape');
    expect(parsed?.content.params.cutouts[0]).toMatchObject({
      width: 20,
      depth: 10,
      label: 'Tape',
    });
    expect(parsed?.content.params.cutoutGroupNames).toEqual({ g: 'Roll' });
  });

  it('drops placement-only fields', () => {
    const json = exportLibraryItemJSON('Tape', {
      params: { cutouts: [{ ...cutout, locked: true, libraryItemId: 'clib_1' }] },
    });
    const [c] = parseLibraryItemJSON(json, t)?.content.params.cutouts ?? [];
    expect(c.locked).toBeUndefined();
    expect(c.libraryItemId).toBeUndefined();
  });

  it('refuses a file that is not a library item', () => {
    expect(parseLibraryItemJSON('not json', t)).toBeNull();
    expect(
      parseLibraryItemJSON(JSON.stringify({ type: 'gridfinity-bin-design', params: {} }), t)
    ).toBeNull();
    const empty = JSON.parse(
      exportLibraryItemJSON('Empty', { params: { cutouts: [] } })
    ) as unknown;
    expect(parseLibraryItemJSON(JSON.stringify(empty), t)).toBeNull();
  });

  it('refuses a malformed cutout without throwing', () => {
    const type = 'gridfinity-cutout-library-item';
    const nulls = { type, params: { cutouts: [null] } };
    expect(parseLibraryItemJSON(JSON.stringify(nulls), t)).toBeNull();
    const odd = { type, params: { cutouts: [{ shape: 'path', path: 5 }] } };
    expect(() => parseLibraryItemJSON(JSON.stringify(odd), t)).not.toThrow();
  });
});

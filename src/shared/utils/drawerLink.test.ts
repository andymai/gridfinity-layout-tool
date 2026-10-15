import { describe, expect, it } from 'vitest';
import { isErr } from '@/core/result';
import { mm } from '@/core/types';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/baseplateDefaults';
import {
  createTestBin,
  createTestLayout,
  createTestLibrary,
  expectErr,
  expectOk,
} from '@/test/testUtils';
import { buildDrawerLinkLayout, isFirstVisitLayout, parseDrawerLink } from './drawerLink';

function parsed(search: string) {
  const result = parseDrawerLink(search);
  if (result === null) throw new Error(`no drawer link in "${search}"`);
  return result;
}

describe('parseDrawerLink', () => {
  it('returns null when the URL carries no drawer', () => {
    expect(parseDrawerLink('')).toBeNull();
    expect(parseDrawerLink('?share=abc')).toBeNull();
  });

  it('reads width and depth', () => {
    expect(expectOk(parsed('?drawer=297x525'))).toEqual({ widthMm: 297, depthMm: 525 });
  });

  it('reads an optional height and decimals', () => {
    expect(expectOk(parsed('?drawer=414.5x318x76'))).toEqual({
      widthMm: 414.5,
      depthMm: 318,
      heightMm: 76,
    });
  });

  it('accepts a multiplication sign and an upper-case X', () => {
    expect(expectOk(parsed(`?drawer=${encodeURIComponent('297×525')}`)).widthMm).toBe(297);
    expect(expectOk(parsed('?drawer=297X525')).depthMm).toBe(525);
  });

  it('carries a cleaned name', () => {
    const spec = expectOk(parsed('?drawer=297x525&name=%20IKEA%20%20Alex%0A'));
    expect(spec.name).toBe('IKEA Alex');
  });

  it('drops a blank name and caps a long one', () => {
    expect(expectOk(parsed('?drawer=297x525&name=%20%20')).name).toBeUndefined();
    expect(expectOk(parsed(`?drawer=297x525&name=${'a'.repeat(200)}`)).name).toHaveLength(64);
  });

  it.each(['297', '297x', 'x525', '297x525x', '-297x525', '297x525x60x2', 'abc', '297,525'])(
    'rejects the malformed size %s',
    (size) => {
      expect(isErr(parsed(`?drawer=${size}`))).toBe(true);
    }
  );

  it('rejects a zero dimension', () => {
    expect(isErr(parsed('?drawer=0x525'))).toBe(true);
    expect(isErr(parsed('?drawer=297x525x0'))).toBe(true);
  });
});

describe('buildDrawerLinkLayout', () => {
  const base = createTestLayout();

  it('fits whole grid units inside the drawer and keeps the measurement', () => {
    const layout = expectOk(buildDrawerLinkLayout(base, { widthMm: 297, depthMm: 525 }, 'X'));
    expect(layout.drawer.width).toBe(7);
    expect(layout.drawer.depth).toBe(12);
    expect(layout.drawer.measuredMm).toEqual({ width: 297, depth: 525 });
  });

  it('splits the leftover evenly into baseplate padding, floored to 0.01 mm', () => {
    const layout = expectOk(buildDrawerLinkLayout(base, { widthMm: 297, depthMm: 525.5 }, 'X'));
    // 297 − 7×42 = 3 → 1.5 a side; 525.5 − 12×42 = 21.5 → 10.75 a side
    expect(layout.baseplateParams).toMatchObject({
      syncWithLayout: true,
      paddingLeft: 1.5,
      paddingRight: 1.5,
      paddingFront: 10.75,
      paddingBack: 10.75,
    });
  });

  it('keeps the rest of the baseplate settings', () => {
    const withMagnets = createTestLayout({
      baseplateParams: { ...DEFAULT_BASEPLATE_PARAMS, magnetHoles: true, syncWithLayout: false },
    });
    const layout = expectOk(
      buildDrawerLinkLayout(withMagnets, { widthMm: 300, depthMm: 300 }, 'X')
    );
    expect(layout.baseplateParams?.magnetHoles).toBe(true);
    expect(layout.baseplateParams?.syncWithLayout).toBe(true);
  });

  it('measures fit against the layout pitch, including a separate depth pitch', () => {
    const custom = createTestLayout({ gridUnitMm: mm(40), gridUnitMmY: mm(50) });
    const layout = expectOk(buildDrawerLinkLayout(custom, { widthMm: 410, depthMm: 410 }, 'X'));
    expect(layout.drawer.width).toBe(10);
    expect(layout.drawer.depth).toBe(8);
    expect(layout.baseplateParams?.paddingLeft).toBe(5);
    expect(layout.baseplateParams?.paddingFront).toBe(5);
  });

  it('sets the drawer height from a measured height and caps the first layer to it', () => {
    const layout = expectOk(
      buildDrawerLinkLayout(base, { widthMm: 297, depthMm: 525, heightMm: 18 }, 'X')
    );
    expect(layout.drawer.height).toBeCloseTo(2.57, 2);
    expect(layout.drawer.measuredMm?.height).toBe(18);
    expect(layout.layers[0]?.height).toBe(2);
  });

  it('keeps the layout height when the link has none', () => {
    const layout = expectOk(buildDrawerLinkLayout(base, { widthMm: 297, depthMm: 525 }, 'X'));
    expect(layout.drawer.height).toBe(base.drawer.height);
    expect(layout.layers[0]?.height).toBe(base.layers[0]?.height);
  });

  it('names the layout from the link, or the fallback', () => {
    expect(
      expectOk(buildDrawerLinkLayout(base, { widthMm: 297, depthMm: 525, name: 'Alex' }, 'X')).name
    ).toBe('Alex');
    expect(expectOk(buildDrawerLinkLayout(base, { widthMm: 297, depthMm: 525 }, 'X')).name).toBe(
      'X'
    );
  });

  it('accepts the exact one-unit and fifty-unit bounds', () => {
    expect(isErr(buildDrawerLinkLayout(base, { widthMm: 42, depthMm: 2100 }, 'X'))).toBe(false);
  });

  it.each([
    [41, 300],
    [300, 41.9],
    [2100.5, 300],
  ])('rejects %s × %s mm, which no whole-unit grid fits', (widthMm, depthMm) => {
    const error = expectErr(buildDrawerLinkLayout(base, { widthMm, depthMm }, 'X'));
    expect(error.code).toBe('VALIDATION_IMPORT_FAILED');
  });
});

describe('isFirstVisitLayout', () => {
  const loadedAt = 1_000;

  function library(createdAt: number, entries = 1) {
    const lib = createTestLibrary();
    const [first] = lib.entries;
    if (first === undefined) throw new Error('test library has no entry');
    return {
      ...lib,
      entries: Array.from({ length: entries }, (_, i) => ({
        ...first,
        id: i === 0 ? first.id : (`other-${i}` as typeof first.id),
        createdAt,
      })),
    };
  }

  it('is true for the lone empty layout this page load seeded', () => {
    expect(isFirstVisitLayout(library(loadedAt + 5), createTestLayout(), loadedAt)).toBe(true);
  });

  it('is false for a layout from an earlier visit', () => {
    expect(isFirstVisitLayout(library(loadedAt - 5), createTestLayout(), loadedAt)).toBe(false);
  });

  it('is false once there is a second layout', () => {
    expect(isFirstVisitLayout(library(loadedAt + 5, 2), createTestLayout(), loadedAt)).toBe(false);
  });

  it('is false once a bin is placed', () => {
    const layout = createTestLayout({ bins: [createTestBin()] });
    expect(isFirstVisitLayout(library(loadedAt + 5), layout, loadedAt)).toBe(false);
  });
});

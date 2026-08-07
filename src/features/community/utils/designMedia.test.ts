import { describe, expect, it } from 'vitest';
import type { CommunityPrint } from '@/shared/types/communityPrint';
import { buildDesignImages, findPhotoIndex } from './designMedia';

function makePrint(overrides: Partial<CommunityPrint> & { id: string }): CommunityPrint {
  return {
    designId: 'design-1',
    authorPublicId: `author-${overrides.id}`,
    authorName: 'Andy',
    photos: [],
    settings: {
      printer: 'bambu-x1c',
      material: 'pla',
      nozzleMm: 0.4,
      layerHeightMm: 0.2,
      printMinutes: 90,
    },
    fitVerdict: 'as-designed',
    note: '',
    createdAt: 0,
    updatedAt: 0,
    status: 'live',
    ...overrides,
  };
}

describe('buildDesignImages', () => {
  it('puts renders first, then every print photo in list order', () => {
    const images = buildDesignImages(
      ['render-a.webp', 'render-b.webp'],
      [
        makePrint({ id: 'p1', authorName: 'Ada', photos: ['photo-1.webp'] }),
        makePrint({ id: 'p2', authorName: 'Bea', photos: ['photo-2.webp', 'photo-3.webp'] }),
      ]
    );

    expect(images.map((image) => image.url)).toEqual([
      'render-a.webp',
      'render-b.webp',
      'photo-1.webp',
      'photo-2.webp',
      'photo-3.webp',
    ]);
    expect(images.map((image) => image.kind)).toEqual([
      'render',
      'render',
      'photo',
      'photo',
      'photo',
    ]);
  });

  it('carries the attribution a photo needs to caption itself', () => {
    const images = buildDesignImages(
      [],
      [
        makePrint({
          id: 'p1',
          authorName: 'Ada',
          photos: ['photo-1.webp'],
          fitVerdict: 'adjusted',
          note: 'Scaled 101%.',
        }),
      ]
    );

    expect(images[0]).toEqual({
      kind: 'photo',
      url: 'photo-1.webp',
      authorName: 'Ada',
      fitVerdict: 'adjusted',
      note: 'Scaled 101%.',
    });
  });

  it('numbers render angles from one', () => {
    const images = buildDesignImages(['a.webp', 'b.webp'], []);
    expect(images.map((image) => (image.kind === 'render' ? image.angle : null))).toEqual([1, 2]);
  });

  it('drops empty slots rather than emitting a broken image', () => {
    const images = buildDesignImages(
      ['a.webp', '', 'c.webp'],
      [makePrint({ id: 'p1', photos: ['', 'photo.webp'] })]
    );

    expect(images.map((image) => image.url)).toEqual(['a.webp', 'c.webp', 'photo.webp']);
  });

  it('keeps duplicate photo urls, which the server does not dedupe', () => {
    const images = buildDesignImages(
      [],
      [
        makePrint({ id: 'p1', photos: ['same.webp'] }),
        makePrint({ id: 'p2', photos: ['same.webp'] }),
      ]
    );

    expect(images).toHaveLength(2);
  });
});

describe('findPhotoIndex', () => {
  const prints = [
    makePrint({ id: 'p1', photos: ['a.webp', 'b.webp'] }),
    makePrint({ id: 'p2', photos: ['c.webp'] }),
  ];
  const images = buildDesignImages(['render.webp'], prints);

  it('offsets past the renders', () => {
    expect(findPhotoIndex(images, prints, 'p1', 0)).toBe(1);
    expect(findPhotoIndex(images, prints, 'p1', 1)).toBe(2);
  });

  it('offsets past earlier prints', () => {
    expect(findPhotoIndex(images, prints, 'p2', 0)).toBe(3);
  });

  it('resolves the second print when both carry the same url', () => {
    const dupes = [
      makePrint({ id: 'p1', photos: ['same.webp'] }),
      makePrint({ id: 'p2', photos: ['same.webp'] }),
    ];
    const dupeImages = buildDesignImages([], dupes);

    expect(findPhotoIndex(dupeImages, dupes, 'p2', 0)).toBe(1);
  });

  it('accounts for empty slots dropped from the flat list', () => {
    const sparse = [makePrint({ id: 'p1', photos: ['', 'b.webp'] })];
    const sparseImages = buildDesignImages([], sparse);

    expect(findPhotoIndex(sparseImages, sparse, 'p1', 1)).toBe(0);
  });

  it('returns -1 for an unknown print or slot', () => {
    expect(findPhotoIndex(images, prints, 'missing', 0)).toBe(-1);
    expect(findPhotoIndex(images, prints, 'p1', 9)).toBe(-1);
  });

  it('returns -1 when the design has no photos at all', () => {
    const renderOnly = buildDesignImages(['render.webp'], []);
    expect(findPhotoIndex(renderOnly, [], 'p1', 0)).toBe(-1);
  });
});

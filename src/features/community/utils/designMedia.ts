/**
 * One flat sequence of every image a design has: its generated angle renders
 * first, then the photos from everyone who printed it.
 *
 * Flat and shared on purpose. The filmstrip, the print grid and the lightbox
 * all address an image by its index in this list, so opening the viewer from
 * any of the three lands on the same picture and steps through the same set.
 * Building the list twice is how "photo 3" comes to mean two different things.
 */

import type { CommunityPrint } from '@/shared/types/communityPrint';

export type DesignImage =
  | { readonly kind: 'render'; readonly url: string; readonly angle: number }
  | {
      readonly kind: 'photo';
      readonly url: string;
      readonly authorName: string;
      readonly fitVerdict: CommunityPrint['fitVerdict'];
      readonly note: string;
    };

/**
 * Tiles the filmstrip shows before it collapses the rest behind a +N tile,
 * counting the 3D tile. A strip that scrolls forever stops being glanceable
 * and buries the renders at its left edge.
 */
export const FILMSTRIP_MAX_TILES = 8;

export function buildDesignImages(
  thumbnails: readonly string[],
  prints: readonly CommunityPrint[]
): DesignImage[] {
  const images: DesignImage[] = [];

  thumbnails.forEach((url, index) => {
    // A design published before a given angle existed carries '' in its slot;
    // an empty src renders as a broken image rather than nothing.
    if (url === '') return;
    images.push({ kind: 'render', url, angle: index + 1 });
  });

  for (const print of prints) {
    for (const url of print.photos) {
      if (url === '') continue;
      images.push({
        kind: 'photo',
        url,
        authorName: print.authorName,
        fitVerdict: print.fitVerdict,
        note: print.note,
      });
    }
  }

  return images;
}

/**
 * Index of a print's photo within the flat list, so the print grid can open
 * the lightbox on the same sequence the filmstrip uses.
 *
 * Resolved by identity rather than by URL: the server does not dedupe photos,
 * so two prints can carry the same URL and a URL lookup would jump to whichever
 * came first.
 */
export function findPhotoIndex(
  images: readonly DesignImage[],
  prints: readonly CommunityPrint[],
  printId: string,
  photoIndex: number
): number {
  let cursor = images.findIndex((image) => image.kind === 'photo');
  if (cursor === -1) return -1;

  for (const print of prints) {
    const photos = print.photos.filter((url) => url !== '');
    if (print.id === printId) {
      const url = print.photos.at(photoIndex);
      if (url === undefined || url === '') return -1;
      // Empty slots are dropped from the flat list, so the offset is the
      // position among the kept photos, not the raw array index.
      const kept = print.photos.slice(0, photoIndex).filter((entry) => entry !== '').length;
      return cursor + kept;
    }
    cursor += photos.length;
  }

  return -1;
}

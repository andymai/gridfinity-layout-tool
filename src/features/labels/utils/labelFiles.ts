import { zipSync } from 'fflate';

const SLUG_MAX_LENGTH = 40;

function slugify(text: string): string {
  const slug = text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (slug.length <= SLUG_MAX_LENGTH) return slug;
  const cut = slug.slice(0, SLUG_MAX_LENGTH + 1);
  const lastBreak = cut.lastIndexOf('-');
  return lastBreak > 0 ? cut.slice(0, lastBreak) : cut.slice(0, SLUG_MAX_LENGTH);
}

/** The copy count goes in the name because printer apps set copies per print job. */
export function labelFileName(index: number, total: number, name: string, copies: number): string {
  const position = String(index + 1).padStart(String(total).length, '0');
  const slug = slugify(name) || 'label';
  return `${position}-${slug}${copies > 1 ? `-x${copies}` : ''}.png`;
}

export interface LabelFile {
  readonly name: string;
  readonly data: Uint8Array;
}

/** PNGs are already compressed, so the archive only stores them. */
export function zipLabelFiles(files: readonly LabelFile[]): Blob {
  const entries = Object.fromEntries(files.map((file) => [file.name, file.data]));
  const zipped = zipSync(entries, { level: 0 });
  return new Blob([new Uint8Array(zipped)], { type: 'application/zip' });
}

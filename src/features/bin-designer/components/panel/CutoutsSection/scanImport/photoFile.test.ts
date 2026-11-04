import { describe, it, expect } from 'vitest';
import { dragHasPhoto, firstPhoto } from './photoFile';

const file = (name: string, type: string): File => new File(['x'], name, { type });

describe('firstPhoto', () => {
  it('picks the first photo and passes over an SVG outline', () => {
    const svg = file('outline.svg', 'image/svg+xml');
    const jpg = file('tools.jpg', 'image/jpeg');
    expect(firstPhoto([svg, jpg])).toBe(jpg);
  });

  it('finds nothing in text or an empty list', () => {
    expect(firstPhoto([file('notes.txt', 'text/plain')])).toBeNull();
    expect(firstPhoto(undefined)).toBeNull();
  });
});

describe('dragHasPhoto', () => {
  const items = (...types: string[]) =>
    types.map((type) => ({ kind: 'file', type })) as unknown as DataTransferItemList;

  it('sees a photo in a drag before the drop', () => {
    expect(dragHasPhoto(items('image/png'))).toBe(true);
    expect(dragHasPhoto(items('image/svg+xml', 'text/plain'))).toBe(false);
    expect(dragHasPhoto(null)).toBe(false);
  });
});

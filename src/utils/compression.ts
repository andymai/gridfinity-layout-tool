/**
 * Compression utilities for reducing storage size.
 * Uses lz-string for UTF-16 compression which is efficient for localStorage/IndexedDB.
 */

import LZString from 'lz-string';
import type { Layout } from '../core/types';

/**
 * Compress a string using lz-string's UTF-16 compression.
 * UTF-16 is ideal for storing in localStorage/IndexedDB as it produces valid strings.
 */
export function compressString(input: string): string {
  return LZString.compressToUTF16(input);
}

/**
 * Decompress a string that was compressed with compressString.
 */
export function decompressString(compressed: string): string {
  const result = LZString.decompressFromUTF16(compressed);
  return result ?? '';
}

/**
 * Compress a Layout object to a string for storage.
 * @returns Compressed string representation of the layout
 */
export function compressLayout(layout: Layout): string {
  const json = JSON.stringify(layout);
  return compressString(json);
}

/**
 * Decompress a stored layout string back to a Layout object.
 * @returns Layout object or null if decompression/parsing fails
 */
export function decompressLayout(compressed: string): Layout | null {
  try {
    const json = decompressString(compressed);
    if (!json) return null;
    return JSON.parse(json) as Layout;
  } catch {
    return null;
  }
}

/**
 * Calculate the compression ratio (compressed size / original size).
 * A ratio less than 1 means compression was effective.
 * @returns Ratio between 0 and 1+ (lower is better compression)
 */
export function getCompressionRatio(original: string, compressed: string): number {
  if (original.length === 0) return 1;
  return compressed.length / original.length;
}

/**
 * ZIP packaging for split bin export.
 *
 * Thin wrapper around the shared zipExport utility, hardcoded to `.stl` extension
 * for backward compatibility with the bin-designer's split export flow.
 */

import { packagePiecesAsZip } from '@/shared/generation/zipExport';

interface SplitPiece {
  readonly data: ArrayBuffer;
  readonly label: string;
}

/**
 * Package split bin pieces into a ZIP archive.
 *
 * @param pieces - Array of STL piece buffers with positional labels
 * @param baseName - Base filename for the ZIP and individual STLs
 * @returns ZIP blob ready for download
 */
export function packageSplitPiecesAsZip(pieces: readonly SplitPiece[], baseName: string): Blob {
  return packagePiecesAsZip(pieces, baseName, '.stl');
}

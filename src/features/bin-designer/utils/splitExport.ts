/**
 * ZIP packaging for split bin export.
 *
 * Dynamically imports JSZip to keep it out of the initial bundle,
 * then packages individual STL piece buffers into a single ZIP archive.
 */

interface SplitPiece {
  readonly data: ArrayBuffer;
  readonly label: string;
  readonly col: number;
  readonly row: number;
}

/**
 * Package split bin pieces into a ZIP archive.
 *
 * @param pieces - Array of STL piece buffers with positional labels
 * @param baseName - Base filename for the ZIP and individual STLs
 * @returns ZIP blob ready for download
 */
export async function packageSplitPiecesAsZip(
  pieces: readonly SplitPiece[],
  baseName: string
): Promise<Blob> {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();

  for (const piece of pieces) {
    const fileName = `${baseName}_${piece.label}.stl`;
    zip.file(fileName, piece.data);
  }

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

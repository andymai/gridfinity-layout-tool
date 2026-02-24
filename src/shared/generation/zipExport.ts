/**
 * Shared ZIP packaging for multi-piece exports (baseplates, split bins, etc.).
 *
 * Dynamically imports JSZip to keep it out of the initial bundle,
 * then packages individual piece buffers into a single ZIP archive.
 */

interface ExportPiece {
  readonly data: ArrayBuffer;
  readonly label: string;
}

/**
 * Package pieces into a ZIP archive with per-piece files.
 *
 * @param pieces - Array of export buffers with labels
 * @param baseName - Base filename for individual files inside the ZIP
 * @param extension - File extension including dot (e.g. ".stl", ".step")
 * @returns ZIP blob ready for download
 */
export async function packagePiecesAsZip(
  pieces: readonly ExportPiece[],
  baseName: string,
  extension: string
): Promise<Blob> {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();

  for (const piece of pieces) {
    const fileName = `${baseName}_${piece.label}${extension}`;
    zip.file(fileName, piece.data);
  }

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

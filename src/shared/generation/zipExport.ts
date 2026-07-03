/**
 * Shared ZIP packaging for multi-piece exports (baseplates, split bins, etc.).
 *
 * Uses `fflate` because JSZip ships a template-compiler path that requires
 * `'unsafe-eval'` in the document CSP. fflate is pure-JS with no runtime
 * code evaluation, and is already loaded by the 3MF exporter.
 */

import { zipSync, strToU8 } from 'fflate';

interface ExportPiece {
  readonly data: ArrayBuffer;
  readonly label: string;
}

/** A plain-text file to include alongside binary pieces in the ZIP. */
export interface ZipTextFile {
  readonly name: string;
  readonly content: string;
}

function appendTextFiles(
  files: Record<string, Uint8Array>,
  textFiles?: readonly ZipTextFile[]
): void {
  if (!textFiles) return;
  for (const file of textFiles) {
    files[file.name] = strToU8(file.content);
  }
}

function buildZipBlob(files: Record<string, Uint8Array>): Blob {
  // `level: 6` matches JSZip's default DEFLATE level, keeping archive sizes
  // and compatibility identical across the migration.
  const compressed = zipSync(files, { level: 6 });
  return new Blob([new Uint8Array(compressed)], { type: 'application/zip' });
}

/**
 * Package pieces into a ZIP archive with per-piece files.
 *
 * @param pieces - Array of export buffers with labels
 * @param baseName - Base filename for individual files inside the ZIP
 * @param extension - File extension including dot (e.g. ".stl", ".step")
 * @param extraFiles - Optional text files to include (e.g. print guide)
 * @returns ZIP blob ready for download
 */
export function packagePiecesAsZip(
  pieces: readonly ExportPiece[],
  baseName: string,
  extension: string,
  extraFiles?: readonly ZipTextFile[]
): Blob {
  const files: Record<string, Uint8Array> = {};

  for (const piece of pieces) {
    const fileName = `${baseName}_${piece.label}${extension}`;
    files[fileName] = new Uint8Array(piece.data);
  }

  appendTextFiles(files, extraFiles);
  return buildZipBlob(files);
}

/** A binary file placed at an explicit path inside the ZIP (e.g. `bins/foo.stl`). */
export interface ZipBinaryFile {
  readonly path: string;
  readonly data: ArrayBuffer;
}

/**
 * Package files into a ZIP using explicit, caller-controlled paths — so callers
 * can build a foldered archive (`bins/`, `baseplate/`, root `manifest.txt`).
 *
 * Unlike `packagePiecesAsZip`, this does NOT synthesize names; the caller owns
 * uniqueness. Duplicate paths would silently overwrite (fflate keys a plain
 * object), so callers must dedupe paths before calling.
 */
export function packageFilesAsZip(
  binaryFiles: readonly ZipBinaryFile[],
  textFiles?: readonly ZipTextFile[]
): Blob {
  const files: Record<string, Uint8Array> = {};

  for (const file of binaryFiles) {
    files[file.path] = new Uint8Array(file.data);
  }

  appendTextFiles(files, textFiles);
  return buildZipBlob(files);
}

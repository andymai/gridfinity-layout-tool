/**
 * Slicer protocol utilities for "Open in Slicer" deep-linking.
 *
 * Each slicer registers a custom URL protocol handler during installation.
 * Firing `<protocol>://open?file=<encoded_url>` causes the slicer to
 * download and open the file if it is installed.
 *
 * The query parameter is `file=` (not `file_url=`). All three slicers
 * (PrusaSlicer, OrcaSlicer, Bambu Studio) use this parameter name —
 * confirmed by PrusaSlicer source and Printables/MakerWorld integration examples.
 *
 * ⚠️  PrusaSlicer additionally restricts downloads to a domain whitelist
 * (printables.com, thingiverse.com, cults3d.com). Downloads from other
 * domains (including Vercel Blob) will be silently rejected by PrusaSlicer,
 * so the fallback download toast is the expected outcome for that slicer.
 *
 * Protocols are stored on each SlicerSite in settings.ts:
 * - PrusaSlicer:  protocol = 'prusaslicer'
 * - OrcaSlicer:   protocol = 'orcaslicer'
 * - Bambu Studio: protocol = 'bambustudio'
 */

/**
 * Build the protocol handler URL for a slicer to open a remote file.
 * The slicer will download and open the file at the given URL.
 */
export function buildSlicerUrl(protocol: string, fileUrl: string): string {
  return `${protocol}://open?file=${encodeURIComponent(fileUrl)}`;
}

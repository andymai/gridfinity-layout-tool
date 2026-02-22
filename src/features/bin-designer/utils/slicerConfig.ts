/**
 * Slicer protocol utilities for "Open in Slicer" deep-linking.
 *
 * Each slicer registers a custom URL protocol handler during installation.
 * Firing `<protocol>://open?file_url=<encoded_url>` causes the slicer to
 * download and open the file if it is installed.
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
  return `${protocol}://open?file_url=${encodeURIComponent(fileUrl)}`;
}

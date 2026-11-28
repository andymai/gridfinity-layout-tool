/** The 3D viewer's own chunk, so a device with no mesh never downloads it. */
export const loadSpinningBin = () => import('../SpinningBin');

/**
 * Fetches the 3D viewer ahead of its card, so the card opens on the turning
 * bin rather than on its thumbnail while the chunk downloads.
 */
export function preloadSpinningBin(): void {
  void loadSpinningBin().catch(() => undefined);
}

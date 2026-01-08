/**
 * Color utilities for isometric 3D rendering with Three.js.
 * These functions are used for vertex color calculations.
 */

/**
 * Darken a hex color by a percentage.
 * @param hex Hex color string (e.g., "#ff0000")
 * @param percent Amount to darken (0-1, where 1 = fully black)
 * @returns Darkened hex color string
 */
export function darkenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, ((num >> 16) & 0xff) * (1 - percent));
  const g = Math.max(0, ((num >> 8) & 0xff) * (1 - percent));
  const b = Math.max(0, (num & 0xff) * (1 - percent));
  return `#${Math.round(r).toString(16).padStart(2, '0')}${Math.round(g).toString(16).padStart(2, '0')}${Math.round(b).toString(16).padStart(2, '0')}`;
}

/**
 * Lighten a hex color by a percentage.
 * @param hex Hex color string (e.g., "#ff0000")
 * @param percent Amount to lighten (0-1, where 1 = fully white)
 * @returns Lightened hex color string
 */
export function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, ((num >> 16) & 0xff) + (255 - ((num >> 16) & 0xff)) * percent);
  const g = Math.min(255, ((num >> 8) & 0xff) + (255 - ((num >> 8) & 0xff)) * percent);
  const b = Math.min(255, (num & 0xff) + (255 - (num & 0xff)) * percent);
  return `#${Math.round(r).toString(16).padStart(2, '0')}${Math.round(g).toString(16).padStart(2, '0')}${Math.round(b).toString(16).padStart(2, '0')}`;
}

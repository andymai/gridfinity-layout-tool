/**
 * Color helpers for the compartment editor's 2D top-down view.
 *
 * Compartment fill/border colors are derived from the user's 3D preview
 * color (persisted under PREVIEW_COLOR_KEY in localStorage) so the 2D
 * editor stays visually consistent with the 3D preview. Subtle per-id
 * lightness offsets distinguish adjacent compartments without breaking
 * the unified palette.
 */

export const PREVIEW_COLOR_KEY = 'gridfinity-designer-preview-color';
export const DEFAULT_PREVIEW_COLOR = '#d4d8dc';

/** Get the current 3D preview color from localStorage */
export function getPreviewColor(): string {
  if (typeof window === 'undefined') return DEFAULT_PREVIEW_COLOR;
  try {
    return localStorage.getItem(PREVIEW_COLOR_KEY) ?? DEFAULT_PREVIEW_COLOR;
  } catch {
    // localStorage may throw in privacy mode or restricted contexts.
    return DEFAULT_PREVIEW_COLOR;
  }
}

/** Convert hex color to HSL components */
export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) return { h: 0, s: 0, l };

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;

  return { h: h * 360, s: s * 100, l: l * 100 };
}

/** Get fill color for a compartment, based on preview color with slight variation */
export function getCompartmentFill(id: number, previewColor: string): string {
  const { h, s, l } = hexToHsl(previewColor);
  // Slight lightness variation for different compartments (±3%)
  const offset = ((id % 3) - 1) * 3;
  const adjustedL = Math.max(10, Math.min(95, l + offset));
  return `hsl(${h}, ${s}%, ${adjustedL}%)`;
}

/** Get border color for a compartment, darker than fill */
export function getCompartmentBorder(_id: number, previewColor: string): string {
  const { h, s, l } = hexToHsl(previewColor);
  // Border is darker than fill
  const borderL = Math.max(10, l - 25);
  return `hsl(${h}, ${s}%, ${borderL}%)`;
}

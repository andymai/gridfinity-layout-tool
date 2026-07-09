/**
 * Text color options for bin labels based on background luminance.
 */
export interface BinTextColors {
  primary: string; // Main text (label or dimensions)
  secondary: string; // Muted text (secondary info)
  shadow: string; // Subtle text-shadow for depth
}

/**
 * Calculate relative luminance of a hex color.
 */
function getLuminance(hexColor: string): number {
  let hex = hexColor.replace('#', '');
  // Expand 3-char hex to 6-char (#abc → aabbcc)
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/**
 * Calculate optimal text color based on background luminance.
 * Returns a CSS variable for light or dark text.
 */
export function getContrastColor(hexColor: string): string {
  return getLuminance(hexColor) > 0.5 ? 'var(--text-on-light)' : 'var(--text-on-dark)';
}

/**
 * Pattern stroke color for the category-pattern overlay, chosen to stay visible
 * on top of the bin fill: a translucent dark ink on light fills, light ink on
 * dark fills. Alpha is kept moderate so the pattern reads as texture without
 * obscuring labels.
 */
export function getBinPatternColor(hexColor: string): string {
  return getLuminance(hexColor) > 0.5 ? 'rgba(0, 0, 0, 0.42)' : 'rgba(255, 255, 255, 0.48)';
}

/**
 * Get adaptive text colors for bin labels.
 * Returns softer colors with primary/secondary/shadow variants.
 */
export function getBinTextColors(hexColor: string): BinTextColors {
  const isLight = getLuminance(hexColor) > 0.5;

  if (isLight) {
    return {
      primary: 'var(--text-on-light)',
      secondary: 'var(--text-on-light-muted)',
      shadow: 'rgba(255, 255, 255, 0.25)',
    };
  } else {
    return {
      primary: 'var(--text-on-dark)',
      secondary: 'var(--text-on-dark-muted)',
      shadow: 'rgba(0, 0, 0, 0.35)',
    };
  }
}

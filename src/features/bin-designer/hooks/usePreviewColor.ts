/**
 * Reactive access to the 3D preview body color so 2D widgets (shape grid,
 * compartment editor, etc.) can match the 3D viewport tint.
 *
 * The color lives in localStorage and is updated from two places:
 * - Same-window: the ColorPicker dispatches a `'preview-color-change'`
 *   CustomEvent so listeners in the same document re-read immediately.
 * - Cross-tab: storage events fire on remote tabs.
 */

import { useEffect, useState } from 'react';

export const PREVIEW_COLOR_KEY = 'gridfinity-designer-preview-color';
export const DEFAULT_PREVIEW_COLOR = '#d4d8dc';

function readPreviewColor(): string {
  if (typeof window === 'undefined') return DEFAULT_PREVIEW_COLOR;
  // Wrapped because localStorage access throws in private-browsing mode
  // and sandboxed iframes; we'd rather fall through to the default than
  // crash every 2D widget that reads the preview tint.
  try {
    return localStorage.getItem(PREVIEW_COLOR_KEY) ?? DEFAULT_PREVIEW_COLOR;
  } catch (error) {
    void error;
    return DEFAULT_PREVIEW_COLOR;
  }
}

export function usePreviewColor(): string {
  const [color, setColor] = useState(readPreviewColor);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === PREVIEW_COLOR_KEY) {
        setColor(e.newValue ?? DEFAULT_PREVIEW_COLOR);
      }
    };
    const handleColorChange = (e: CustomEvent<string>) => setColor(e.detail);
    window.addEventListener('storage', handleStorage);
    window.addEventListener('preview-color-change', handleColorChange as EventListener);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('preview-color-change', handleColorChange as EventListener);
    };
  }, []);

  return color;
}

/** Convert hex color to HSL components. */
function hexToHsl(hex: string): { h: number; s: number; l: number } {
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

/** Border color = preview color darkened by 25% luminance. */
export function getPreviewBorderColor(previewColor: string): string {
  const { h, s, l } = hexToHsl(previewColor);
  const borderL = Math.max(10, l - 25);
  return `hsl(${h}, ${s}%, ${borderL}%)`;
}

/**
 * Compartment fill color: preview color with a small per-id lightness
 * offset (±3%) so adjacent compartments are visually distinguishable
 * without breaking the unified palette.
 */
export function getCompartmentFill(id: number, previewColor: string): string {
  const { h, s, l } = hexToHsl(previewColor);
  const offset = ((id % 3) - 1) * 3;
  const adjustedL = Math.max(10, Math.min(95, l + offset));
  return `hsl(${h}, ${s}%, ${adjustedL}%)`;
}

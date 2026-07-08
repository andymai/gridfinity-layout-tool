import { THREE_COLORS } from '@/shared/hooks/useThemeEffect';
import type { UserSettings } from '@/core/store/settings.types';

/**
 * App-matched palette for the standalone supporters experience: scene
 * backgrounds come from the shared `THREE_COLORS` tokens, bins and plate use
 * the app's default preview plastic (#d4d8dc, same as the designer previews),
 * and the accent mirrors the user's chosen app accent (themes.css
 * `--color-primary`, per theme). Keep the accent hexes in lockstep with
 * `src/shell/styles/themes.css`.
 */

export type SupportersAccent = UserSettings['accentColor'];

/** App default preview plastic — bins, plate, and designer previews alike. */
const PREVIEW_PLASTIC = '#d4d8dc';

const ACCENT_HEX: Record<'dark' | 'light', Record<SupportersAccent, string>> = {
  dark: {
    amber: '#f59e0b',
    rose: '#f43f5e',
    fuchsia: '#d946ef',
    emerald: '#10b981',
    sky: '#0ea5e9',
    violet: '#7c3aed',
  },
  light: {
    amber: '#b45309',
    rose: '#e11d48',
    fuchsia: '#c026d3',
    emerald: '#059669',
    sky: '#0284c7',
    violet: '#7c3aed',
  },
};

export interface SupportersPalette {
  /** Scene background + fog color (THREE_COLORS canvasBg). */
  background: string;
  fog: string;
  /** Baseplate tiles + supporter bins — the app-default preview plastic. */
  plate: string;
  bin: string;
  /** Printed label tape on the tab + its ink (physical, theme-invariant). */
  tape: string;
  tapeInk: string;
  /** The user's app accent (hero count, ghost bin, focus glow). */
  accent: string;
  ghost: string;
  /** Lights — neutral key, cool fill, clean product-shot look. */
  keyLight: string;
  fillLight: string;
  rimLight: string;
  ambient: string;
}

export function getSupportersPalette(
  theme: 'light' | 'dark',
  accent: SupportersAccent
): SupportersPalette {
  const three = THREE_COLORS[theme];
  const accentHex = ACCENT_HEX[theme][accent];
  return {
    background: three.canvasBg,
    fog: three.canvasBg,
    plate: PREVIEW_PLASTIC,
    bin: PREVIEW_PLASTIC,
    tape: '#f8f9fa',
    tapeInk: '#2b2f33',
    accent: accentHex,
    ghost: accentHex,
    keyLight: '#ffffff',
    fillLight: theme === 'dark' ? '#b9c4d8' : '#dfe6f0',
    rimLight: theme === 'dark' ? '#dfe6ee' : '#ffffff',
    ambient: theme === 'dark' ? THREE_COLORS.dark.floorPlane : THREE_COLORS.light.floorPlane,
  };
}

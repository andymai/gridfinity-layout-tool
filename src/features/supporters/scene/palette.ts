/**
 * Bespoke workshop palette for the standalone supporters experience.
 *
 * Deliberately independent of the shared preview `THREE_COLORS` — this is a
 * self-contained "experience" scene, not the product preview. Art direction:
 * dark = evening workshop (tungsten key light over a dim bench), light =
 * daylit workbench (warm paper neutrals, soft sun). Bins render in a curated
 * matte-PLA filament mix so the plate reads like a real enthusiast's drawer.
 */

export interface SupportersPalette {
  /** Scene background + fog color. */
  background: string;
  fog: string;
  /** The baseplate tiles. */
  plate: string;
  /**
   * Matte-PLA filament colors for supporter bins, assigned deterministically
   * per bin. Tuned per theme so they hold up under the theme's lighting.
   */
  filament: string[];
  /** Printed label tape on the tab + its ink (independent of filament). */
  tape: string;
  tapeInk: string;
  /** Amber Ko-fi accent (hero count, glow, ghost bin). */
  accent: string;
  /** Ghost "your spot" bin tint. */
  ghost: string;
  /** Lights. */
  keyLight: string;
  fillLight: string;
  rimLight: string;
  ambient: string;
  /** Ambient dust motes. */
  dust: string;
}

const DARK: SupportersPalette = {
  background: '#0d0a08',
  fog: '#0d0a08',
  plate: '#242220',
  filament: [
    '#c96f42', // terracotta
    '#4e8a7c', // teal
    '#c9a13b', // mustard
    '#7d8c5f', // sage
    '#5d7ba1', // dusty blue
    '#a35555', // brick
    '#d8cfc0', // bone white
    '#6d635c', // warm gray
  ],
  tape: '#efe8da',
  tapeInk: '#292420',
  accent: '#f6a93b',
  ghost: '#f6a93b',
  keyLight: '#ffd9a0',
  fillLight: '#4a5a78',
  rimLight: '#f6a93b',
  ambient: '#3a3028',
  dust: '#f6d9a8',
};

const LIGHT: SupportersPalette = {
  background: '#f4efe6',
  fog: '#f4efe6',
  plate: '#b9b2a4',
  filament: [
    '#d97e4e', // terracotta
    '#4f9687', // teal
    '#d9ae3f', // mustard
    '#8a9a68', // sage
    '#6787b1', // dusty blue
    '#b25f5f', // brick
    '#fbf6ec', // bone white
    '#7e746c', // warm gray
  ],
  tape: '#fffdf6',
  tapeInk: '#3a342e',
  accent: '#d97f14',
  ghost: '#d97f14',
  keyLight: '#fff6e6',
  fillLight: '#cdd8ea',
  rimLight: '#e08a1e',
  ambient: '#ded7c8',
  dust: '#c9a96b',
};

export function getSupportersPalette(theme: 'light' | 'dark'): SupportersPalette {
  return theme === 'light' ? LIGHT : DARK;
}

/** Deterministic filament pick so a bin keeps its color across re-renders. */
export function filamentColorFor(palette: SupportersPalette, id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return palette.filament[Math.abs(hash) % palette.filament.length];
}

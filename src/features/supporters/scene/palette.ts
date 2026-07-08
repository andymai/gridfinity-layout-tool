/**
 * Bespoke immersive palette for the standalone supporters experience.
 *
 * Deliberately independent of the shared preview `THREE_COLORS` — this is a
 * self-contained "experience" scene, not the product preview, so it carries
 * its own cinematic dark palette (with a tasteful light variant for the theme
 * toggle) and an amber Ko-fi accent.
 */

export interface SupportersPalette {
  /** Scene background + fog color. */
  background: string;
  fog: string;
  /** The baseplate slab. */
  baseplate: string;
  baseplateSocket: string;
  /** Named supporter bins (printed-filament off-white). */
  binNamed: string;
  /** Ink for the printed name on a named bin (contrasts against binNamed). */
  binInk: string;
  /** Frosted anonymous bins. */
  binAnon: string;
  /** Amber hero accent (label tabs, glow, count). */
  accent: string;
  /** Lights. */
  keyLight: string;
  fillLight: string;
  rimLight: string;
  ambient: string;
  /** Ambient dust motes. */
  dust: string;
}

const DARK: SupportersPalette = {
  background: '#080a0f',
  fog: '#080a0f',
  baseplate: '#191d28',
  baseplateSocket: '#0f121a',
  binNamed: '#ece7dd',
  binInk: '#20242c',
  binAnon: '#aab4c6',
  accent: '#f6a93b',
  keyLight: '#fff4e2',
  fillLight: '#5b6b8c',
  rimLight: '#f6a93b',
  ambient: '#2a3550',
  dust: '#f6d9a8',
};

const LIGHT: SupportersPalette = {
  background: '#f3f0ea',
  fog: '#f3f0ea',
  baseplate: '#d7d1c4',
  baseplateSocket: '#c4bdac',
  binNamed: '#ffffff',
  binInk: '#3a3632',
  binAnon: '#eceae4',
  accent: '#e08a1e',
  keyLight: '#ffffff',
  fillLight: '#c9d3e6',
  rimLight: '#e08a1e',
  ambient: '#e8e4da',
  dust: '#c9a96b',
};

export function getSupportersPalette(theme: 'light' | 'dark'): SupportersPalette {
  return theme === 'light' ? LIGHT : DARK;
}

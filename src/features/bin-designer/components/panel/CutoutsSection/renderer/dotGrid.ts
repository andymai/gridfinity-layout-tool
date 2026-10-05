import { Color, SRGBColorSpace } from 'three';
import { luminanceContrast, relativeLuminance } from '@/shared/utils/color';

const DOT_STEPS_MM = [1, 2, 5, 10, 20] as const;
const MIN_DOT_SPACING_PX = 8;
/** Every instance matrix is rebuilt in JS when the interval changes; more than this stalls a zoom. */
const MAX_DOTS = 50_000;

/**
 * Dot spacing in mm. Picks the finest step that stays at least a few screen
 * pixels apart, so dots never smear into a grey wash when zoomed out and never
 * thin out when zoomed in, where the 1mm snap grid is what the user is placing on.
 */
export function getDotInterval(binWidth: number, binDepth: number, zoom: number): number {
  for (const step of DOT_STEPS_MM) {
    if (step * zoom < MIN_DOT_SPACING_PX) continue;
    const dots = (Math.floor(binWidth / step) + 1) * (Math.floor(binDepth / step) + 1);
    if (dots <= MAX_DOTS) return step;
  }
  return DOT_STEPS_MM[DOT_STEPS_MM.length - 1];
}

export interface DotGridStyle {
  readonly color: '#000000' | '#ffffff';
  readonly opacity: number;
  readonly radiusPx: number;
}

const DEFAULT_CONTRAST = 2;
/** WCAG 1.4.11 non-text contrast. */
const HIGH_CONTRAST = 3;

type Rgb = { r: number; g: number; b: number };

function parseSrgb(color: string): Rgb {
  return new Color(color).getRGB({ r: 0, g: 0, b: 0 }, SRGBColorSpace);
}

/**
 * Smallest opacity at which `ink`, alpha-blended over `surface`, reaches
 * `target` contrast. The canvas blends in sRGB-encoded space, so the mix is
 * done on encoded channels before linearising for luminance.
 */
function opacityForContrast(surface: Rgb, ink: number, target: number): number {
  const surfaceLum = relativeLuminance(surface.r, surface.g, surface.b);
  const contrastAt = (a: number): number => {
    const mix = (c: number): number => c * (1 - a) + ink * a;
    return luminanceContrast(
      surfaceLum,
      relativeLuminance(mix(surface.r), mix(surface.g), mix(surface.b))
    );
  };
  if (contrastAt(1) <= target) return 1;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    if (contrastAt(mid) >= target) hi = mid;
    else lo = mid;
  }
  return hi;
}

export function getDotGridStyle(binColor: string, highContrast: boolean): DotGridStyle {
  const surface = parseSrgb(binColor);
  const surfaceLum = relativeLuminance(surface.r, surface.g, surface.b);
  const darkInk = luminanceContrast(surfaceLum, 0) >= luminanceContrast(surfaceLum, 1);
  const target = highContrast ? HIGH_CONTRAST : DEFAULT_CONTRAST;
  return {
    color: darkInk ? '#000000' : '#ffffff',
    opacity: opacityForContrast(surface, darkInk ? 0 : 1, target),
    radiusPx: highContrast ? 2 : 1.5,
  };
}

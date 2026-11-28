type Rgb = readonly [number, number, number];

function channel(hex: string, index: number): number {
  return parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16) / 255;
}

export function hexToRgb(hex: string): Rgb {
  return [channel(hex, 0), channel(hex, 1), channel(hex, 2)];
}

export function rgbToHex(rgb: Rgb): string {
  return `#${rgb
    .map((value) =>
      Math.round(Math.min(1, Math.max(0, value)) * 255)
        .toString(16)
        .padStart(2, '0')
    )
    .join('')
    .toUpperCase()}`;
}

/** Linear mix in sRGB, `amount` 0 keeps `a`. */
export function mix(a: string, b: string, amount: number): string {
  const [r0, g0, b0] = hexToRgb(a);
  const [r1, g1, b1] = hexToRgb(b);
  return rgbToHex([r0 + (r1 - r0) * amount, g0 + (g1 - g0) * amount, b0 + (b1 - b0) * amount]);
}

function toLinear(value: number): number {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function toGamma(value: number): number {
  return value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055;
}

function linear([r, g, b]: Rgb): Rgb {
  return [toLinear(r), toLinear(g), toLinear(b)];
}

function rgbLuminance(rgb: Rgb): number {
  const [r, g, b] = linear(rgb);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG relative luminance. */
export function luminance(hex: string): number {
  return rgbLuminance(hexToRgb(hex));
}

function rgbContrast(a: Rgb, b: Rgb): number {
  const x = rgbLuminance(a);
  const y = rgbLuminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** WCAG contrast ratio, 1 to 21. */
export function contrast(a: string, b: string): number {
  return rgbContrast(hexToRgb(a), hexToRgb(b));
}

/** A colour seen from the front of a toy bin: the face, a lit lip and a shaded foot. */
export interface BinShade {
  readonly face: string;
  readonly hi: string;
  readonly lo: string;
}

export function toyShade(face: string): BinShade {
  return {
    face,
    hi: mix(face, '#FFFFFF', 0.32),
    lo: mix(face, '#000000', luminance(face) > 0.5 ? 0.3 : 0.42),
  };
}

export interface Oklch {
  readonly l: number;
  readonly c: number;
  /** Degrees. */
  readonly h: number;
}

export function hexToOklch(hex: string): Oklch {
  const [r, g, b] = linear(hexToRgb(hex));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { l: L, c: Math.hypot(A, B), h: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360 };
}

function oklchToRgb({ l: L, c, h }: Oklch): Rgb {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    toGamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    toGamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    toGamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

function inGamut(rgb: Rgb): boolean {
  return rgb.every((value) => value >= -1e-4 && value <= 1 + 1e-4);
}

/** The colour at this lightness and hue, with chroma lowered until sRGB can show it. */
export function oklchToHex(colour: Oklch): string {
  let lo = 0;
  let hi = colour.c;
  if (inGamut(oklchToRgb(colour))) return rgbToHex(oklchToRgb(colour));
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut(oklchToRgb({ ...colour, c: mid }))) lo = mid;
    else hi = mid;
  }
  return rgbToHex(oklchToRgb({ ...colour, c: lo }));
}

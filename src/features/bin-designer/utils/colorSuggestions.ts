/**
 * Generates color suggestions that harmonize with a base hex via HSL
 * rotation. Lightweight, deterministic — no model, just color theory.
 */

function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const r = parseInt(m[1].slice(0, 2), 16) / 255;
  const g = parseInt(m[1].slice(2, 4), 16) / 255;
  const b = parseInt(m[1].slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }
  return { h, s, l };
}

function hslToHex(h: number, s: number, l: number): string {
  const hue = (((h % 360) + 360) % 360) / 360;
  const sat = Math.min(1, Math.max(0, s));
  const lit = Math.min(1, Math.max(0, l));
  const q = lit < 0.5 ? lit * (1 + sat) : lit + sat - lit * sat;
  const p = 2 * lit - q;
  const channel = (t: number) => {
    let u = t;
    if (u < 0) u += 1;
    if (u > 1) u -= 1;
    if (u < 1 / 6) return p + (q - p) * 6 * u;
    if (u < 1 / 2) return q;
    if (u < 2 / 3) return p + (q - p) * (2 / 3 - u) * 6;
    return p;
  };
  const r = Math.round(channel(hue + 1 / 3) * 255);
  const g = Math.round(channel(hue) * 255);
  const b = Math.round(channel(hue - 1 / 3) * 255);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Up to 5 hex colors that harmonize with `baseHex`: analogous (±30°),
 * complementary (180°), and triadic (±120°). Greys (s ≈ 0) get a
 * curated accent set instead — rotating hue on a desaturated color
 * produces more grey, which isn't useful.
 */
export function suggestMatchingColors(baseHex: string): readonly string[] {
  const hsl = hexToHsl(baseHex);
  if (!hsl) return [];

  if (hsl.s < 0.08) {
    return ['#ef4444', '#f97316', '#22c55e', '#3b82f6', '#a855f7'];
  }

  const sat = Math.max(0.4, hsl.s);
  const lit = Math.min(0.65, Math.max(0.35, hsl.l));

  return [
    hslToHex(hsl.h - 30, sat, lit),
    hslToHex(hsl.h + 30, sat, lit),
    hslToHex(hsl.h + 180, sat, lit),
    hslToHex(hsl.h + 120, sat, lit),
    hslToHex(hsl.h - 120, sat, lit),
  ];
}

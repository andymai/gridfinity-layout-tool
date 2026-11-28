import type { PlanView } from '@/agent/contract';

// Viewbox units per grid unit. A label character is about 0.55 of the font size.
export const CELL = 24;
export const FONT = 8;

const DARK_TEXT = '#1b1b1f';
const LIGHT_TEXT = '#ffffff';

export interface MapBin {
  readonly key: number;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly color: string;
  readonly upper: boolean;
  readonly text: string;
  readonly textColor: string;
}

export interface PlanMapView {
  readonly width: number;
  readonly height: number;
  readonly columns: readonly number[];
  readonly rows: readonly number[];
  readonly bins: readonly MapBin[];
}

function luminance(hex: string): number | null {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (match === null) return null;
  const value = Number.parseInt(match[1], 16);
  const [r, g, b] = [value >> 16, (value >> 8) & 255, value & 255].map((channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The text color with the higher WCAG contrast on a bin's fill. */
export function labelColor(fill: string): string {
  const fillL = luminance(fill);
  const darkL = luminance(DARK_TEXT);
  if (fillL === null || darkL === null) return DARK_TEXT;
  const onDark = (fillL + 0.05) / (darkL + 0.05);
  const onLight = 1.05 / (fillL + 0.05);
  return onDark >= onLight ? DARK_TEXT : LIGHT_TEXT;
}

// A label that does not fit keeps its first word ("M3" of "M3 screws") before
// it is cut short.
export function fitLabel(label: string, chars: number): string {
  if (label.length <= chars) return label;
  const first = label.split(/\s+/)[0];
  if (first.length <= chars) return first;
  return chars >= 2 ? `${label.slice(0, chars - 1).trimEnd()}…` : '';
}

// The grid's origin is the front-left corner, so the front of the drawer is at
// the bottom of the map, as in the layout editor. Lines sit on whole units from
// that corner, so a half unit shows at the back and the right.
export function planMapView(plan: PlanView): PlanMapView {
  const { width, depth } = plan.grid;
  const inside = (size: number): number[] =>
    Array.from({ length: Math.ceil(size) - 1 }, (_, i) => i + 1);
  return {
    width: width * CELL,
    height: depth * CELL,
    columns: inside(width).map((x) => x * CELL),
    rows: inside(depth).map((y) => (depth - y) * CELL),
    bins: plan.bins
      .map((bin, key) => ({ bin, key }))
      .sort((a, b) => a.bin.layer - b.bin.layer || a.key - b.key)
      .map(({ bin, key }) => {
        const w = bin.width * CELL;
        return {
          key,
          x: bin.x * CELL,
          y: (depth - bin.y - bin.depth) * CELL,
          w,
          h: bin.depth * CELL,
          color: bin.color,
          upper: bin.layer > 1,
          text: fitLabel(bin.label, Math.max(0, Math.floor((w - 4) / (FONT * 0.55)))),
          textColor: labelColor(bin.color),
        };
      }),
  };
}

function isEmptyDrawer(plan: PlanView): boolean {
  return plan.bins.length === 0 && plan.stashed.length === 0;
}

export function planCaption(plan: PlanView): string {
  const grid = `${plan.grid.width} × ${plan.grid.depth} units`;
  if (isEmptyDrawer(plan)) return `${grid} · empty drawer`;
  const parts = [grid, `${plan.bins.length} ${plan.bins.length === 1 ? 'bin' : 'bins'}`];
  if (plan.stashed.length > 0) parts.push(`${plan.stashed.length} in the stash`);
  return parts.join(' · ');
}

export function planOpenLabel(plan: PlanView): string {
  return isEmptyDrawer(plan) ? 'Open this drawer' : 'Open in the layout editor';
}

// Read by a screen reader in place of the drawing, which it reads as one image.
export function planDescription(plan: PlanView): string[] {
  const units = (width: number, depth: number): string => `${width} × ${depth} units`;
  return [
    ...plan.bins.map(
      (bin) =>
        `${bin.label}: ${units(bin.width, bin.depth)}, ${bin.x} across and ${bin.y} back from the front-left corner${bin.layer > 1 ? `, on layer ${bin.layer}` : ''}.`
    ),
    ...plan.stashed.map((bin) => `${bin.label}: in the stash, ${bin.reason}.`),
  ];
}

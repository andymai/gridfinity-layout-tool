import { contrast, hexToOklch, oklchToHex } from './color';

/** A bin seen from above: the rim, the floor and the shadow under the label shelf. */
export interface CategoryShade {
  readonly rim: string;
  readonly floor: string;
  readonly shade: string;
}

export const SHADE_STEPS = 4;
const LIGHTEST = 0.965;
const CHROMA_FIRST = 0.125;
const CHROMA_LAST = 0.03;
/** Floor and shelf shadow sit this much darker, with chroma kept up so they stay in the hue. */
const FLOOR_DROP = 0.17;
const SHADE_DROP = 0.26;
const INNER_CHROMA = 0.1;
const MIN_CONTRAST = 3;

/**
 * The lowest lightness whose rim keeps 3:1 against the card, for a grey and
 * for the most saturated step alike, so every step reads as a shape.
 */
function lowestReadable(hue: number, background: string): number {
  const readable = (l: number): boolean =>
    contrast(oklchToHex({ l, c: 0, h: hue }), background) >= MIN_CONTRAST &&
    contrast(oklchToHex({ l, c: CHROMA_FIRST, h: hue }), background) >= MIN_CONTRAST;
  if (!readable(LIGHTEST)) return LIGHTEST;
  let lo = 0;
  let hi = LIGHTEST;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (readable(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}

/**
 * Category shades from one bin colour: its OKLCH hue fixed, lightness stepped
 * evenly from the lowest value that keeps 3:1 on the card up to 0.965, while
 * chroma falls from 0.125 to 0.03. Raw category colours never reach the card.
 */
export function categoryShades(binColour: string, background: string): CategoryShade[] {
  const { h } = hexToOklch(binColour);
  const first = lowestReadable(h, background);
  return Array.from({ length: SHADE_STEPS }, (_, step) => {
    const k = step / (SHADE_STEPS - 1);
    const l = first + (LIGHTEST - first) * k;
    const c = CHROMA_FIRST + (CHROMA_LAST - CHROMA_FIRST) * k;
    const inner = Math.max(c, INNER_CHROMA);
    return {
      rim: oklchToHex({ l, c, h }),
      floor: oklchToHex({ l: l - FLOOR_DROP, c: inner, h }),
      shade: oklchToHex({ l: l - SHADE_DROP, c: inner, h }),
    };
  });
}

export interface GroupedRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly d: number;
  readonly group: string;
}

/** Above this many bins the neighbour search is skipped and groups simply cycle. */
const NEIGHBOUR_LIMIT = 4000;

function touches(a: GroupedRect, b: GroupedRect): boolean {
  const eps = 1e-6;
  const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const overlapY = Math.min(a.y + a.d, b.y + b.d) - Math.max(a.y, b.y);
  return (overlapX > eps && overlapY > -eps) || (overlapY > eps && overlapX > -eps);
}

/**
 * A shade step per group. Groups that touch get steps two apart where the
 * layout allows; with more groups than steps, the steps cycle.
 */
export function assignShadeSteps(rects: readonly GroupedRect[]): Map<string, number> {
  // By area, so the groups that cover the most of the drawer take the deepest shades.
  const counts = new Map<string, number>();
  for (const rect of rects) counts.set(rect.group, (counts.get(rect.group) ?? 0) + rect.w * rect.d);
  const neighbours = new Map<string, Set<string>>();
  for (const group of counts.keys()) neighbours.set(group, new Set());
  if (rects.length <= NEIGHBOUR_LIMIT) {
    rects.forEach((a, i) => {
      for (let j = i + 1; j < rects.length; j++) {
        const b = rects[j];
        if (a.group === b.group || !touches(a, b)) continue;
        neighbours.get(a.group)?.add(b.group);
        neighbours.get(b.group)?.add(a.group);
      }
    });
  }
  const order = [...counts.keys()].sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0));
  const steps = new Map<string, number>();
  const used = Array.from({ length: SHADE_STEPS }, () => 0);
  for (const group of order) {
    let best = 0;
    let bestScore = -1;
    for (let step = 0; step < SHADE_STEPS; step++) {
      let gap = SHADE_STEPS;
      for (const other of neighbours.get(group) ?? []) {
        const theirs = steps.get(other);
        if (theirs !== undefined) gap = Math.min(gap, Math.abs(theirs - step));
      }
      // A wider gap wins, then the step used least, so isolated groups cycle.
      const score = gap * 1000 - (used[step] ?? 0);
      if (score > bestScore) {
        best = step;
        bestScore = score;
      }
    }
    steps.set(group, best);
    used[best] = (used[best] ?? 0) + 1;
  }
  return steps;
}

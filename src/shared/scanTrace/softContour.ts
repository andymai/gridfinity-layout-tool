/**
 * Sub-pixel contour of a soft (probability) mask via marching squares.
 *
 * The ML segmenter emits a confidence field in [0,1], not a hard 0/1 mask. A
 * binary trace snaps every boundary vertex to an integer pixel (±0.5px stair-
 * stepping), throwing away the fractional edge location the model encodes. This
 * extracts the iso-`level` (default 0.5) contour with linear edge interpolation,
 * placing each vertex where the probability actually crosses 0.5 — recovering
 * the sub-pixel boundary. Returns the largest closed loop (the tapped object),
 * wound clockwise to match `traceContour`.
 */

import type { Mask, Point } from './types';

export interface SoftMask {
  readonly width: number;
  readonly height: number;
  /** Foreground probability per pixel, row-major, 0–1. */
  readonly data: Float32Array;
}

/** Threshold a soft mask to a binary mask (for consumers that need 0/1). */
export function binarize(soft: SoftMask, level = 0.5): Mask {
  const data = new Uint8Array(soft.data.length);
  for (let i = 0; i < data.length; i++) data[i] = soft.data[i] >= level ? 1 : 0;
  return { width: soft.width, height: soft.height, data };
}

/** Standard shoelace area; >0 is clockwise in screen (y-down) coordinates. */
function signedArea(pts: readonly Point[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = i + 1 === pts.length ? 0 : i + 1;
    a += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return a / 2;
}

export function traceSoftContour(soft: SoftMask, level = 0.5): Point[] {
  const { width: W, height: H, data } = soft;
  if (W < 2 || H < 2) return [];
  const val = (x: number, y: number): number => data[y * W + x];
  // Fraction along an edge from value a→b where it crosses `level`.
  const cross = (a: number, b: number): number => {
    const t = (level - a) / (b - a);
    return t < 0 ? 0 : t > 1 ? 1 : t;
  };

  const pos = new Map<string, Point>();
  const segs: Array<readonly [string, string]> = [];
  // Horizontal grid edge at (x,y) → (x+1,y); shared between vertically adjacent
  // cells so the same crossing key links their segments.
  const hKey = (x: number, y: number): string => {
    const key = `h${x},${y}`;
    if (!pos.has(key)) pos.set(key, { x: x + cross(val(x, y), val(x + 1, y)), y });
    return key;
  };
  // Vertical grid edge at (x,y) → (x,y+1).
  const vKey = (x: number, y: number): string => {
    const key = `v${x},${y}`;
    if (!pos.has(key)) pos.set(key, { x, y: y + cross(val(x, y), val(x, y + 1)) });
    return key;
  };

  for (let y = 0; y < H - 1; y++) {
    for (let x = 0; x < W - 1; x++) {
      const code =
        (val(x, y) >= level ? 1 : 0) |
        (val(x + 1, y) >= level ? 2 : 0) |
        (val(x + 1, y + 1) >= level ? 4 : 0) |
        (val(x, y + 1) >= level ? 8 : 0);
      if (code === 0 || code === 15) continue;

      const top = (): string => hKey(x, y);
      const bottom = (): string => hKey(x, y + 1);
      const left = (): string => vKey(x, y);
      const right = (): string => vKey(x + 1, y);
      const add = (a: string, b: string): void => {
        segs.push([a, b]);
      };

      switch (code) {
        case 1:
        case 14:
          add(left(), top());
          break;
        case 2:
        case 13:
          add(top(), right());
          break;
        case 3:
        case 12:
          add(left(), right());
          break;
        case 4:
        case 11:
          add(right(), bottom());
          break;
        case 6:
        case 9:
          add(top(), bottom());
          break;
        case 7:
        case 8:
          add(bottom(), left());
          break;
        case 5:
        case 10: {
          // Saddle: resolve by the cell-centre average so the two foreground
          // corners connect when the centre is also foreground.
          const center = (val(x, y) + val(x + 1, y) + val(x + 1, y + 1) + val(x, y + 1)) / 4;
          const centreFg = center >= level;
          const tlBr = code === 5;
          if (tlBr === centreFg) {
            add(top(), right());
            add(bottom(), left());
          } else {
            add(left(), top());
            add(right(), bottom());
          }
          break;
        }
      }
    }
  }
  if (segs.length === 0) return [];

  const adj = new Map<string, Array<{ readonly other: string; readonly seg: number }>>();
  const link = (k: string, other: string, seg: number): void => {
    const list = adj.get(k);
    if (list) list.push({ other, seg });
    else adj.set(k, [{ other, seg }]);
  };
  segs.forEach(([a, b], i) => {
    link(a, b, i);
    link(b, a, i);
  });

  const used = new Array<boolean>(segs.length).fill(false);
  let best: Point[] = [];
  let bestArea = 0;
  for (let i = 0; i < segs.length; i++) {
    if (used[i]) continue;
    const seg = segs[i];
    used[i] = true;
    const loop: Point[] = [];
    const startPt = pos.get(seg[0]);
    if (startPt) loop.push(startPt);
    let cur = seg[1];
    for (let guard = 0; cur !== seg[0] && guard <= segs.length; guard++) {
      const p = pos.get(cur);
      if (p) loop.push(p);
      const step = adj.get(cur)?.find((n) => !used[n.seg]);
      if (!step) break;
      used[step.seg] = true;
      cur = step.other;
    }
    if (loop.length >= 3) {
      const area = signedArea(loop);
      if (Math.abs(area) > bestArea) {
        bestArea = Math.abs(area);
        best = area >= 0 ? loop : loop.slice().reverse();
      }
    }
  }
  return best;
}

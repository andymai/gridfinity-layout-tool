/**
 * Chain loose 2D segments into closed loops.
 *
 * 2D CAD exports a profile as separate LINE and ARC entities far more often
 * than as one polyline, so without this a perfectly ordinary drawer outline
 * imports as nothing at all.
 */

import type { OutlineVertex } from '@/core/types';
import type { ImportedLoop } from './types';
import { JOIN_TOLERANCE_MM } from './types';

export interface Pt {
  readonly x: number;
  readonly y: number;
}

/** One segment: endpoints plus the bulge of the arc from `a` to `b` (0 = line). */
export interface Edge {
  readonly a: Pt;
  readonly b: Pt;
  readonly bulge: number;
}

function near(p: Pt, q: Pt, tol: number): boolean {
  return Math.abs(p.x - q.x) <= tol && Math.abs(p.y - q.y) <= tol;
}

/** Reverse travel along an edge. A bulge bows right of travel, so it flips. */
function flip(e: Edge): Edge {
  return { a: e.b, b: e.a, bulge: -e.bulge };
}

/**
 * Walk `edges` into closed loops, consuming each edge at most once.
 *
 * Greedy rather than a full planar-graph traversal: at a junction where three
 * or more segments meet, the first match wins. A drawer perimeter is a simple
 * closed curve with no junctions, so the ambiguity a smarter walk would resolve
 * does not arise; open chains are dropped rather than force-closed, because
 * silently bridging a gap invents an edge the user did not draw.
 */
export function chainEdges(edges: readonly Edge[], tol = JOIN_TOLERANCE_MM): ImportedLoop[] {
  const used = new Array<boolean>(edges.length).fill(false);
  const loops: ImportedLoop[] = [];

  for (let seed = 0; seed < edges.length; seed++) {
    if (used[seed]) continue;
    used[seed] = true;
    const chain: Edge[] = [edges[seed]];
    let head = edges[seed].b;

    for (;;) {
      if (near(head, chain[0].a, tol)) break;
      let next = -1;
      for (let i = 0; i < edges.length; i++) {
        if (used[i]) continue;
        if (near(head, edges[i].a, tol)) {
          next = i;
          chain.push(edges[i]);
          break;
        }
        if (near(head, edges[i].b, tol)) {
          next = i;
          chain.push(flip(edges[i]));
          break;
        }
      }
      if (next === -1) break;
      used[next] = true;
      head = chain[chain.length - 1].b;
    }

    // An open chain is not a perimeter. Its edges stay consumed: re-seeding
    // from them would only rebuild the same dead end.
    if (chain.length < 2 || !near(head, chain[0].a, tol)) continue;
    const vertices: OutlineVertex[] = chain.map((e) =>
      e.bulge === 0 ? { x: e.a.x, y: e.a.y } : { x: e.a.x, y: e.a.y, bulge: e.bulge }
    );
    loops.push({ vertices });
  }

  return loops;
}

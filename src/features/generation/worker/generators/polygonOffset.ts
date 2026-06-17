/**
 * Outward offset of a simple closed polygon (miter joins, miter-limit clamped).
 *
 * Used to build the flared top rim of a chamfered *path* cutout: the outline is
 * flattened to a polyline, then offset outward by the chamfer width to form the
 * wider opening the generator lofts down to the nominal profile. The result has
 * the same vertex count and 1:1 correspondence with the input, which keeps the
 * downstream ruled loft well-behaved.
 */

export interface Pt {
  readonly x: number;
  readonly y: number;
}

const MITER_LIMIT = 4;

function signedArea(p: readonly Pt[]): number {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const b = p[(i + 1) % p.length];
    a += p[i].x * b.y - b.x * p[i].y;
  }
  return a / 2;
}

function outwardNormal(a: Pt, b: Pt, sign: number): Pt {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: (sign * dy) / len, y: (sign * -dx) / len };
}

function intersectLines(p1: Pt, d1: Pt, p2: Pt, d2: Pt): Pt | null {
  const den = d1.x * d2.y - d1.y * d2.x;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((p2.x - p1.x) * d2.y - (p2.y - p1.y) * d2.x) / den;
  return { x: p1.x + t * d1.x, y: p1.y + t * d1.y };
}

function offsetWithSign(points: readonly Pt[], d: number, sign: number): Pt[] {
  const n = points.length;
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n];
    const cur = points[i];
    const next = points[(i + 1) % n];
    const n1 = outwardNormal(prev, cur, sign);
    const n2 = outwardNormal(cur, next, sign);
    const p1 = { x: prev.x + n1.x * d, y: prev.y + n1.y * d };
    const dir1 = { x: cur.x - prev.x, y: cur.y - prev.y };
    const p2 = { x: cur.x + n2.x * d, y: cur.y + n2.y * d };
    const dir2 = { x: next.x - cur.x, y: next.y - cur.y };

    const hit = intersectLines(p1, dir1, p2, dir2);
    if (!hit) {
      // Collinear / parallel edges — a plain perpendicular offset is exact.
      out.push({ x: cur.x + n2.x * d, y: cur.y + n2.y * d });
      continue;
    }
    // Clamp runaway miters at sharp corners so a spike can't blow up the loft.
    const mdx = hit.x - cur.x;
    const mdy = hit.y - cur.y;
    const mlen = Math.hypot(mdx, mdy);
    const cap = MITER_LIMIT * Math.abs(d);
    if (mlen > cap && mlen > 0) {
      const k = cap / mlen;
      out.push({ x: cur.x + mdx * k, y: cur.y + mdy * k });
    } else {
      out.push(hit);
    }
  }
  return out;
}

/**
 * Offset a closed polygon outward by `d`. Winding-agnostic: it picks the sign
 * that actually grows the area, so it can't accidentally shrink the outline
 * (which would invert the chamfer funnel).
 */
export function offsetClosedPolygon(points: readonly Pt[], d: number): Pt[] {
  const n = points.length;
  if (n < 3 || d === 0) return points.map((p) => ({ x: p.x, y: p.y }));

  const sign = signedArea(points) >= 0 ? 1 : -1;
  const a0 = Math.abs(signedArea(points));
  const out = offsetWithSign(points, d, sign);
  // Safety net against coordinate-handedness surprises: if the chosen sign
  // shrank the polygon, redo with the opposite sign so the offset is outward.
  if (Math.abs(signedArea(out)) < a0) return offsetWithSign(points, d, -sign);
  return out;
}

/**
 * Which attachment holes a bin keeps when it drills only its outer corners.
 *
 * The corners are the vertices of the convex hull of every hole the bin would
 * otherwise drill. A rectangle keeps its four outermost holes, an L-shape its
 * five convex corners, and a thin strip whose holes line up keeps the two ends.
 * A hole partway along an edge is collinear with its neighbours and drops out.
 *
 * The hull is taken over the caller's own hole list, so a builder that
 * decomposes cells its own way still keeps holes it actually drills.
 */

type Site = readonly [number, number];

const COLLINEAR_EPS = 1e-6;

const siteKey = (site: Site): string => `${site[0].toFixed(4)},${site[1].toFixed(4)}`;

function cross(o: Site, a: Site, b: Site): number {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

function halfHull(points: readonly Site[]): Site[] {
  const chain: Site[] = [];
  for (const p of points) {
    while (
      chain.length >= 2 &&
      cross(chain[chain.length - 2], chain[chain.length - 1], p) <= COLLINEAR_EPS
    ) {
      chain.pop();
    }
    chain.push(p);
  }
  chain.pop();
  return chain;
}

export function outerCornerHoleFilter(sites: readonly Site[]): (site: Site) => boolean {
  const unique = new Map<string, Site>();
  for (const site of sites) unique.set(siteKey(site), site);
  if (unique.size <= 2) return () => true;
  const sorted = [...unique.values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const corners = new Set([...halfHull(sorted), ...halfHull([...sorted].reverse())].map(siteKey));
  return (site) => corners.has(siteKey(site));
}

import polygonClipping, { type MultiPolygon, type Polygon, type Ring } from 'polygon-clipping';
import type { Cutout } from '@/shared/types/bin';
import { resolveCutoutLeanDeg } from '@/shared/types/bin';
import { clearedProfile, entryChamferWidth, MIN_LOFTED_CHAMFER } from './cutoutFit';
import { cutoutOutlineRing, rotateAbout } from './cutoutOutline';
import { pathCutoutCut, pathHoleCuts } from './pathCutoutOutline';

/** Far enough past any bin to stand in for an unbounded half-plane (mm). */
const FAR_MM = 1e5;

/** polygon-clipping fails on near-coincident edges; see `booleanGeometry`. */
const SNAP_PER_MM = 1e6;

interface Sections {
  readonly wall: Ring;
  readonly rim: Ring;
  readonly islands: readonly Ring[];
}

const snap = (ring: Ring): Ring =>
  ring.map(([x, y]): [number, number] => [
    Math.round(x * SNAP_PER_MM) / SNAP_PER_MM,
    Math.round(y * SNAP_PER_MM) / SNAP_PER_MM,
  ]);

/**
 * The cutter's cross-sections in its own frame, centred on the box centre and
 * unturned: the cleared wall, the rim it flares to at an entry edge, and a
 * path's islands. The same sections the worker lofts (see `cutRing`).
 */
function sections(cutout: Cutout, depth: number): Sections | null {
  const { clearance, w, d } = clearedProfile(cutout);
  const flare = entryChamferWidth({ ...cutout, cutDepth: depth });
  const chamfer = flare > MIN_LOFTED_CHAMFER ? flare : 0;

  if (cutout.shape === 'path') {
    const cut = pathCutoutCut(cutout, clearance, chamfer);
    if (cut) {
      const ring = (pts: readonly { x: number; y: number }[]): Ring => pts.map((p) => [p.x, p.y]);
      return {
        wall: ring(cut.base),
        rim: ring(cut.rim),
        islands: pathHoleCuts(cutout, clearance, chamfer).map((hole) => ring(hole.base)),
      };
    }
  }

  const box = (grow: number): Ring | null =>
    cutoutOutlineRing({
      ...cutout,
      shape: cutout.shape === 'path' ? 'rectangle' : cutout.shape,
      x: -w / 2 - grow,
      y: -d / 2 - grow,
      width: w + 2 * grow,
      depth: d + 2 * grow,
      cornerRadius: cutout.cornerRadius + grow,
      rotation: 0,
    });
  const wall = box(0);
  const rim = box(chamfer);
  return wall && rim ? { wall, rim, islands: [] } : null;
}

const band = (y0: number, y1: number): Polygon => [
  [
    [-FAR_MM, y0],
    [FAR_MM, y0],
    [FAR_MM, y1],
    [-FAR_MM, y1],
  ],
];

const area = (ring: Ring): number => {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[(i + 1) % ring.length];
    sum += x0 * y1 - x1 * y0;
  }
  return Math.abs(sum) / 2;
};

/**
 * The hole a cutout leaves in the surface it opens on, in the interior frame:
 * an outer ring, then any islands, or null when nothing reaches the surface.
 *
 * The worker turns the cutter about its mouth by the lean. On the side the
 * floor tips away from, the surface meets the cutter above the mouth, where the
 * rim carries on straight up. On the other side it meets the wall, until the
 * tilted floor ends it `depth / tan(lean)` from the axis. Seen from above, both
 * stretch by 1/cos across the lean. The entry edge's own slope between wall and
 * rim is left out, which misplaces the outline by less than the edge's width.
 *
 * `depth` is the depth the worker cuts, measured along the lean.
 */
export function surfaceOpening(cutout: Cutout, depth: number): Polygon | null {
  const s = sections(cutout, depth);
  if (!s) return null;

  const lean = (resolveCutoutLeanDeg(cutout) * Math.PI) / 180;
  let region: MultiPolygon;
  if (lean === 0) {
    region = [[snap(s.rim)]];
  } else {
    const reach = depth / Math.tan(Math.abs(lean));
    const hood = lean > 0 ? band(-FAR_MM, 0) : band(0, FAR_MM);
    const floor = lean > 0 ? band(0, reach) : band(-reach, 0);
    region = polygonClipping.union(
      polygonClipping.intersection([snap(s.rim)], hood),
      polygonClipping.intersection([snap(s.wall)], floor)
    );
  }
  if (s.islands.length > 0) {
    region = polygonClipping.difference(region, ...s.islands.map((ring) => [snap(ring)]));
  }
  if (region.length === 0) return null;

  // An island can split the opening; the largest piece then stands for it.
  const [piece] = [...region].sort((a, b) => area(b[0]) - area(a[0]));
  const stretch = 1 / Math.cos(lean);
  const cx = cutout.x + cutout.width / 2;
  const cy = cutout.y + cutout.depth / 2;
  return piece.map((ring) =>
    ring.map(([x, y]) => rotateAbout(cx + x, cy + y * stretch, cx, cy, cutout.rotation))
  );
}

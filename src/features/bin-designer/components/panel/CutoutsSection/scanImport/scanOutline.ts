/**
 * A scanned tool made ready to place and edit: turned so that its own box is
 * the smallest one, and fitted with curves so that it has few points.
 *
 * A trace keeps the angle the tool had in the photo, so a tool that lay at a
 * slant gets a large square box, and its outline arrives as many corners.
 * Both make the editor hard to use: the box is what the handles show, and
 * every corner is a point to drag.
 *
 * A shape traced inside another's island (a nut in a wrench's ring) turns and
 * moves with that host, so the two keep their places relative to each other.
 *
 * No React, no store, no side effects.
 */

import type { Cutout } from '@/features/bin-designer/types';
import {
  cleanOutline,
  EDIT_FIT_MM,
  NO_CLEANUP,
  type CleanupSettings,
  type Pt,
} from '@/shared/outlineCleanup';
import { pointInPolygon, polygonArea } from '@/shared/scanTrace';
import {
  drawnRegion,
  storedPatch,
} from '@/features/bin-designer/components/OutlineCleanup/cleanupFrame';
import { autoArrangeCutouts } from '../autoArrange';
import { getPathBounds } from '../pathGeometry';
import { minAreaTurn } from '../minAreaTurn';
import { translateCutoutPreview } from '../cutoutHelpers';
import { getCutoutOutline } from '../cutoutOutline';
import { cutsAsDrawn } from '../handlers/pathRings';
import { MIN_MATERIAL_MM } from '../pocketChecks';

/** Space between packed tools, at least: the editor's Arrange default. */
const PACK_GAP_MM = 2;

const SCAN_FIT: CleanupSettings = { ...NO_CLEANUP, simplify: EDIT_FIT_MM, curves: true };

interface Outline {
  readonly cutout: Cutout;
  readonly ring: readonly Pt[];
  readonly area: number;
}

function outlineOf(cutout: Cutout): Outline | null {
  const ring = getCutoutOutline(cutout)?.[0];
  return ring && ring.length >= 3 ? { cutout, ring, area: polygonArea(ring) } : null;
}

/**
 * The scan's shapes in clusters, each a host first and then the shapes traced
 * inside it. Traced outlines never cross, so one point decides nesting, and
 * the largest outline holding that point is the outermost host.
 */
function clustersOf(cutouts: readonly Cutout[]): Cutout[][] {
  const outlines = cutouts.map(outlineOf);
  const hostOf = outlines.map((own, i) => {
    if (!own) return i;
    let host = i;
    outlines.forEach((other, j) => {
      if (j === i || !other || other.area <= own.area) return;
      if (!pointInPolygon(own.ring[0], other.ring)) return;
      const best = outlines[host];
      if (host === i || (best && other.area > best.area)) host = j;
    });
    return host;
  });
  const clusters = new Map<number, Cutout[]>();
  hostOf.forEach((host, i) => {
    const members = clusters.get(host) ?? [];
    if (host === i) members.unshift(cutouts[i]);
    else members.push(cutouts[i]);
    clusters.set(host, members);
  });
  return [...clusters.values()];
}

/**
 * The cluster drawn turned by its host's best angle about its host's middle,
 * fitted, and stored unturned. The cluster comes back as it was when any
 * outline in it cannot be fitted, so no shape is left behind at another angle.
 */
function straightened(cluster: readonly Cutout[]): Cutout[] {
  const [host] = cluster;
  if (host.shape !== 'path' || !host.path) return [...cluster];
  const turn = minAreaTurn(host) ?? 0;
  const b = getPathBounds(host.path);
  const pivot = { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
  const out: Cutout[] = [];
  for (const member of cluster) {
    if (member.shape !== 'path') return [...cluster];
    const region = drawnRegion({ ...member, rotation: member.rotation + turn }, pivot);
    const cleaned = region ? cleanOutline(region, SCAN_FIT) : null;
    // A gap narrower than the fit tolerance can close in the fit, and the fit
    // drops an island it cannot fit, so the trace stays unless the fit cuts
    // the same way.
    const kept =
      cleaned !== null &&
      cleaned.holes.length === region?.holes.length &&
      cutsAsDrawn([cleaned.path, ...cleaned.holes]);
    if (!cleaned || !kept) return [...cluster];
    out.push({ ...member, ...storedPatch(cleaned, 0), rotation: 0 });
  }
  return out;
}

/**
 * How far apart packed tools sit: far enough that the pocket checks find the
 * plastic they want between the cuts once each grows by its clearance and its
 * entry edge.
 */
function packGap(cutouts: readonly Cutout[]): number {
  const reach = Math.max(0, ...cutouts.map((c) => (c.clearance ?? 0) + (c.chamferWidth ?? 0)));
  return Math.max(PACK_GAP_MM, MIN_MATERIAL_MM + 2 * reach);
}

/**
 * Clusters side by side in rows `width` wide, each moved as one block, so that
 * tools turned in place do not overlap. A temporary container per cluster is
 * what makes the packer move it whole; it is gone from the result.
 */
function packed(clusters: readonly Cutout[][], width: number): Cutout[] {
  const tagged = clusters.flatMap((members, k) =>
    members.length > 1
      ? members.map((c) => ({ ...c, parentGroups: [`scan-cluster-${k}`] }))
      : members
  );
  const placements = autoArrangeCutouts(tagged, {
    binWidth: width,
    binDepth: Number.POSITIVE_INFINITY,
    gap: packGap(tagged),
  });
  const byId = new Map(clusters.flat().map((c) => [c.id, c]));
  return tagged.map((c) => {
    const original = byId.get(c.id) ?? c;
    return c.id in placements ? translateCutoutPreview(original, placements[c.id]) : original;
  });
}

/**
 * The scanned cutouts turned to their smallest boxes and fitted with curves,
 * then passed through `finish` (the fit fields a scan starts with). With
 * `packWidth`, a scan of several tools is also laid out in rows that wide, so
 * none overlaps another after its turn.
 */
export function prepareScanCutouts(
  cutouts: readonly Cutout[],
  options: { readonly packWidth?: number; readonly finish?: (cutout: Cutout) => Cutout } = {}
): Cutout[] {
  const { packWidth, finish = (c: Cutout) => c } = options;
  const clusters = clustersOf(cutouts).map((cluster) => straightened(cluster).map(finish));
  if (packWidth === undefined || clusters.length < 2) return clusters.flat();
  return packed(clusters, packWidth);
}

// @vitest-environment node
/**
 * The bin foot and the baseplate pocket are one mating pair, and nothing else
 * in the suite can see when they stop being one.
 *
 * Both meshes stay watertight, both bounding boxes stay right, and a bin still
 * drops into a plate, at any clearance — including none. The pre-spec profiles
 * passed every one of those while sharing a face: each was the full-cell
 * contour displaced a quarter millimetre along its own 45-degree taper, so they
 * read as 0.25mm apart HORIZONTALLY and were 0mm apart against anyone else's
 * Gridfinity parts.
 *
 * So this measures the gap PERPENDICULAR to each mating face, which is the only
 * reading a printer cares about, and pins the Z breakpoints of the mesh the
 * draft path actually emits.
 */

import { describe, it, expect } from 'vitest';
import type { ResolvedBaseplateParams } from '@/shared/types/bin';
import {
  CLEARANCE,
  SIZE,
  BOX_CORNER_RADIUS,
  CORNER_RADIUS,
  FOOT_PROFILE,
  POCKET_PROFILE,
  PLATE_PROFILE_HEIGHT,
  SOCKET_HEIGHT,
  type TaperProfile,
} from './generatorConstants';
import { generateBaseplateDirect } from './baseplateDirectMesh';

/**
 * A profile's breakpoints as (height above the part's own underside,
 * half-width from the cell centre). Both parts rest on the same plane when
 * seated, so this is the frame the two can be compared in.
 */
function breakpoints(
  profile: TaperProfile,
  totalHeight: number,
  cellMm: number
): { z: number; r: number }[] {
  return profile.map(([depth, inset]) => ({ z: totalHeight - depth, r: cellMm / 2 - inset }));
}

const foot = breakpoints(FOOT_PROFILE, SOCKET_HEIGHT, SIZE - CLEARANCE);
const pocket = breakpoints(POCKET_PROFILE, PLATE_PROFILE_HEIGHT, SIZE);

/** The three faces that mate, bottom-up, as [foot index, pocket index] pairs. */
const MATING_FACES = [
  { name: 'bottom chamfer', foot: [3, 2], pocket: [3, 2] },
  { name: 'vertical band', foot: [2, 1], pocket: [2, 1] },
  { name: 'top chamfer', foot: [1, 0], pocket: [1, 0] },
] as const;

/**
 * Perpendicular distance between the foot's face and the pocket's, given both
 * are parallel (asserted separately). Vertical faces differ by their radius; a
 * 45-degree face is the line `r - z = c`, whose offset projects by 1/sqrt(2).
 */
function faceGap(pair: (typeof MATING_FACES)[number]): number {
  const [fa, fb] = pair.foot;
  const [pa] = pair.pocket;
  const vertical = foot[fa].r === foot[fb].r;
  if (vertical) return pocket[pa].r - foot[fa].r;
  const footC = foot[fa].r - foot[fa].z;
  const pocketC = pocket[pa].r - pocket[pa].z;
  return (pocketC - footC) / Math.SQRT2;
}

describe('bin foot / baseplate pocket clearance', () => {
  it('holds CLEARANCE/2 perpendicular to every mating face', () => {
    for (const pair of MATING_FACES) {
      expect(faceGap(pair), pair.name).toBeCloseTo(CLEARANCE / 2, 2);
    }
  });

  it('keeps every mating face pair parallel', () => {
    for (const pair of MATING_FACES) {
      const [fa, fb] = pair.foot;
      const [pa, pb] = pair.pocket;
      const footRun = foot[fb].r - foot[fa].r;
      const footRise = foot[fb].z - foot[fa].z;
      const pocketRun = pocket[pb].r - pocket[pa].r;
      const pocketRise = pocket[pb].z - pocket[pa].z;
      expect(footRun * pocketRise, pair.name).toBeCloseTo(pocketRun * footRise, 6);
    }
  });

  it('stops the pocket short of the foot, so the foot lands on the floor', () => {
    // A pocket as deep as the foot leaves the two bottomed out on their tapers
    // instead, with nothing but tolerance deciding how far the bin sinks.
    expect(PLATE_PROFILE_HEIGHT).toBeLessThan(SOCKET_HEIGHT);
    expect(pocket[3].r - foot[3].r).toBeGreaterThan(0);
  });

  it('carries the same clearance around the corners', () => {
    // Both arcs are concentric once the foot's cell shrinks by CLEARANCE, so
    // the radius difference is the whole corner gap.
    expect(CORNER_RADIUS - BOX_CORNER_RADIUS).toBeCloseTo(CLEARANCE / 2, 6);
  });

  it('emits the profile it declares', () => {
    const params: ResolvedBaseplateParams = {
      width: 1,
      depth: 1,
      gridUnitMm: SIZE,
      magnetHoles: false,
      magnetDiameter: 6.5,
      magnetDepth: 2.4,
      paddingLeft: 0,
      paddingRight: 0,
      paddingFront: 0,
      paddingBack: 0,
      fractionalEdgeX: 'end',
      fractionalEdgeY: 'end',
      lightweight: false,
    };
    const plate = generateBaseplateDirect(params, () => {});
    const levels = new Set<number>();
    for (let i = 2; i < plate.vertices.length; i += 3) {
      levels.add(+plate.vertices[i].toFixed(3));
    }
    for (const { z } of pocket) {
      expect([...levels], `pocket breakpoint z=${z}`).toContain(+z.toFixed(3));
    }
  });
});

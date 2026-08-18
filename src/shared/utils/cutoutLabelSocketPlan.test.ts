import { describe, it, expect } from 'vitest';
import {
  MAX_CUTOUT_LABEL_SOCKETS,
  cutoutSocketAnchorAabb,
  isCutoutEngraveMode,
  isCutoutSocketMode,
  isCutoutSocketVertical,
  planCutoutLabelSockets,
} from './cutoutLabelSocketPlan';
import type { Cutout } from '@/shared/types/bin';
import {
  LABEL_PLATE_HEIGHT_MM,
  labelSocketOuterDepthMm,
  labelSocketOuterWidthMm,
} from '@/shared/constants/labelPlates';

const CLEARANCE = 0.3;
/** Deep enough that the pocket + its floor always fit. */
const SURFACE_Z = 20;

/** 1U outer footprint: 38.3 x 13.3mm at the nominal clearance. */
const OUTER_1U = labelSocketOuterWidthMm(1, CLEARANCE);
const OUTER_ACROSS = labelSocketOuterDepthMm(CLEARANCE);

function cutout(over: Partial<Cutout> = {}): Cutout {
  return {
    id: 'c1',
    shape: 'rectangle',
    x: 40,
    y: 40,
    width: 20,
    depth: 20,
    cutDepth: 10,
    rotation: 0,
    cornerRadius: 0,
    label: 'M4',
    groupId: null,
    labelMode: 'socket',
    ...over,
  };
}

function plan(cutouts: readonly Cutout[], innerW = 120, innerD = 100) {
  return planCutoutLabelSockets({
    cutouts,
    innerW,
    innerD,
    clearanceMm: CLEARANCE,
    surfaceZ: SURFACE_Z,
  });
}

describe('mode predicates', () => {
  it('treats a missing labelMode as engraved', () => {
    expect(isCutoutSocketMode(cutout({ labelMode: undefined }))).toBe(false);
    expect(isCutoutEngraveMode(cutout({ labelMode: undefined, engraveLabel: true }))).toBe(true);
  });

  // Socket mode moves the caption onto the plate. Engraving it as well would
  // print the same words twice, and the engraving cannot be swapped out.
  it('never engraves a socket-mode cutout', () => {
    expect(isCutoutEngraveMode(cutout({ labelMode: 'socket', engraveLabel: true }))).toBe(false);
  });
});

describe('isCutoutSocketVertical', () => {
  // A plate has no head and no tail, so 180 is the same run as 0.
  it('reads a half turn as the same axis', () => {
    expect(isCutoutSocketVertical({ textAngle: 0 })).toBe(false);
    expect(isCutoutSocketVertical({ textAngle: 180 })).toBe(false);
    expect(isCutoutSocketVertical({ textAngle: 90 })).toBe(true);
    expect(isCutoutSocketVertical({ textAngle: 270 })).toBe(true);
  });

  it('treats a missing angle as horizontal', () => {
    expect(isCutoutSocketVertical({ textAngle: undefined })).toBe(false);
  });

  // The angle field is shared with the engraved label, whose control accepts
  // any whole degree, so a cutout switched to socket mode can arrive with one.
  it('buckets an arbitrary stored angle to the nearer axis', () => {
    expect(isCutoutSocketVertical({ textAngle: 20 })).toBe(false);
    expect(isCutoutSocketVertical({ textAngle: 100 })).toBe(true);
    expect(isCutoutSocketVertical({ textAngle: 160 })).toBe(false);
    expect(isCutoutSocketVertical({ textAngle: -90 })).toBe(true);
  });
});

describe('planCutoutLabelSockets', () => {
  it('fits the largest standard plate the gap allows', () => {
    const { sockets } = plan([cutout({ textAnchor: 'top' })]);

    expect(sockets).toHaveLength(1);
    expect(sockets[0].widthU).toBe(2);
    expect(sockets[0].fittingWidthsU).toEqual([1, 2]);
    expect(sockets[0].text).toBe('M4');
  });

  it('centres the socket in the gap above the cutout', () => {
    const { sockets } = plan([cutout({ textAnchor: 'top' })]);

    // Cutout spans y 40..60; the interior ends at 100, so the band centres at 80.
    expect(sockets[0].centerX).toBeCloseTo(50, 6);
    expect(sockets[0].centerY).toBeCloseTo(80, 6);
  });

  // The anchor decides where the plate goes; only its width gives way. Sliding
  // it clear would leave the offset fields describing a position it no longer
  // holds.
  it('narrows the plate rather than moving it when a neighbour intrudes', () => {
    const neighbour = cutout({
      id: 'n1',
      labelMode: undefined,
      // Sits in the upper band, 2U away from centre but inside 2U's span.
      x: 88,
      y: 72,
      width: 20,
      depth: 16,
    });
    const { sockets } = plan([cutout({ textAnchor: 'top' }), neighbour]);

    expect(sockets).toHaveLength(1);
    expect(sockets[0].widthU).toBe(1);
    expect(sockets[0].centerX).toBeCloseTo(50, 6);
  });

  // A pocket overlapping a cavity loses its floor and interrupts the rib run:
  // the plate no longer clicks in, and no mesh assertion can see it.
  it('drops the socket when no standard width clears the neighbours', () => {
    const left = cutout({ id: 'l', labelMode: undefined, x: 20, y: 70, width: 12, depth: 20 });
    const right = cutout({ id: 'r', labelMode: undefined, x: 68, y: 70, width: 12, depth: 20 });
    const result = plan([cutout({ textAnchor: 'top' }), left, right]);

    expect(result.sockets).toHaveLength(0);
    expect(result.skipped).toEqual([{ cutoutId: 'c1', reason: 'noRoom' }]);
  });

  it('refuses the center anchor, which sits over the cutout’s own cavity', () => {
    const result = plan([cutout({ textAnchor: 'center' })]);

    expect(result.sockets).toHaveLength(0);
    expect(result.skipped).toEqual([{ cutoutId: 'c1', reason: 'centerAnchor' }]);
  });

  // A side gap is rarely 38mm wide but usually 38mm tall, which is the whole
  // reason the orientation toggle exists.
  it('turns the footprint for a 90° socket', () => {
    // The gap to the left wall is 30mm: under a 1U run (38.3) and over its
    // across-axis span (13.3), so only the turned socket fits.
    const narrow = cutout({ textAnchor: 'left', x: 30, y: 40, width: 20, depth: 20 });

    expect(plan([narrow]).sockets).toHaveLength(0);
    expect(plan([{ ...narrow, textAngle: 90 }]).sockets).toHaveLength(1);
  });

  it('measures a 90° socket against the across-axis span', () => {
    const narrow = cutout({
      textAnchor: 'left',
      x: 30,
      y: 40,
      width: 20,
      depth: 20,
      textAngle: 90,
    });
    const { sockets } = plan([narrow]);

    // The turned socket's 13.3mm span clears the 30mm gap while its 38.3mm run
    // fits inside the 100mm interior depth.
    expect(OUTER_ACROSS).toBeLessThan(30);
    expect(OUTER_1U).toBeLessThan(100);
    expect(sockets[0].vertical).toBe(true);
  });

  it('honours a per-cutout width override that fits', () => {
    const { sockets } = plan([cutout({ textAnchor: 'top', labelPlateWidthU: 1 })]);

    expect(sockets[0].widthU).toBe(1);
  });

  // The picker only ever offers fitting widths, but a stored design can carry
  // one that stopped fitting when the cutout moved.
  it('ignores an override too wide for the gap', () => {
    const { sockets } = plan([cutout({ textAnchor: 'top', labelPlateWidthU: 3 })]);

    expect(sockets[0].widthU).toBe(2);
  });

  it('keeps the pocket inside the interior', () => {
    // Anchored right against a cutout that leaves under 38.3mm to the wall.
    const tight = cutout({ textAnchor: 'right', x: 40, y: 40, width: 60, depth: 20 });

    expect(plan([tight]).sockets).toHaveLength(0);
  });

  it('drops every socket when the fill surface cannot hold a pocket', () => {
    const result = planCutoutLabelSockets({
      cutouts: [cutout({ textAnchor: 'top' })],
      innerW: 120,
      innerD: 100,
      clearanceMm: CLEARANCE,
      surfaceZ: 1,
    });

    expect(result.skipped).toEqual([{ cutoutId: 'c1', reason: 'tooShallow' }]);
  });

  it('ignores hidden cutouts, which are absent from the build entirely', () => {
    const result = plan([cutout({ textAnchor: 'top', hidden: true })]);

    expect(result.sockets).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);
  });

  // A hidden neighbour cuts no cavity, so it cannot take a pocket's floor.
  it('does not let a hidden neighbour block a socket', () => {
    const ghost = cutout({
      id: 'g',
      labelMode: undefined,
      hidden: true,
      x: 20,
      y: 70,
      width: 80,
      depth: 20,
    });

    expect(plan([cutout({ textAnchor: 'top' }), ghost]).sockets).toHaveLength(1);
  });

  it('reports every socket past the per-board cap', () => {
    // One long row, pinned to 1U and pitched wider than a 1U pocket so no
    // socket is refused for want of room.
    const many = Array.from({ length: MAX_CUTOUT_LABEL_SOCKETS + 2 }, (_, i) =>
      cutout({
        id: `c${i}`,
        textAnchor: 'top',
        labelPlateWidthU: 1,
        x: 25 + i * 43,
        y: 150,
        width: 10,
        depth: 10,
      })
    );
    const result = plan(many, 43 * (MAX_CUTOUT_LABEL_SOCKETS + 2) + 20, 200);

    expect(result.sockets).toHaveLength(MAX_CUTOUT_LABEL_SOCKETS);
    expect(result.skipped).toHaveLength(2);
    expect(result.skipped.every((s) => s.reason === 'capped')).toBe(true);
  });

  // Two merged pockets are one cavity with no rib runs left, and the merged
  // solid is every bit as watertight as two good sockets.
  it('does not let two sockets share the same gap', () => {
    const a = cutout({ id: 'a', textAnchor: 'top', x: 40, y: 40, width: 10, depth: 10 });
    const b = cutout({ id: 'b', textAnchor: 'top', x: 60, y: 40, width: 10, depth: 10 });
    const result = plan([a, b]);

    expect(result.sockets).toHaveLength(1);
    expect(result.sockets[0].cutoutId).toBe('a');
    expect(result.skipped).toEqual([{ cutoutId: 'b', reason: 'noRoom' }]);
  });

  it('carries the icon through to the plate', () => {
    const { sockets } = plan([cutout({ textAnchor: 'top', labelIcon: 'hexKey' })]);

    expect(sockets[0].icon).toBe('hexKey');
  });

  it('drops an icon that is not in the catalogue', () => {
    const bad = { ...cutout({ textAnchor: 'top' }), labelIcon: 'notAnIcon' } as unknown as Cutout;

    expect(plan([bad]).sockets[0].icon).toBeUndefined();
  });
});

describe('cutoutSocketAnchorAabb', () => {
  // An engraving anchored to instance 0 of a grid lands harmlessly over a
  // sibling hole. A pocket planned there would be cut into eleven of them.
  it('spans every instance of an array, not just the master', () => {
    const master = cutout({
      x: 10,
      y: 10,
      width: 10,
      depth: 10,
      array: {
        mode: 'grid',
        cols: 3,
        rows: 2,
        pitchX: 20,
        pitchY: 20,
        count: 1,
        radius: 0,
        startAngle: 0,
        rotateToCenter: false,
      },
    });
    const box = cutoutSocketAnchorAabb(master, 0, 0);

    expect(box).toEqual({ minX: 10, maxX: 60, minY: 10, maxY: 40 });
  });

  it('anchors a plain cutout to its own box', () => {
    expect(cutoutSocketAnchorAabb(cutout(), 0, 0)).toEqual({
      minX: 40,
      maxX: 60,
      minY: 40,
      maxY: 60,
    });
  });
});

describe('socket footprint constants', () => {
  // The across-axis span is what a side gap has to clear, and it is far
  // smaller than the run, which is why 90° sockets fit where 0° ones do not.
  it('is the plate plus clearance plus a wall each side', () => {
    expect(OUTER_ACROSS).toBeCloseTo(LABEL_PLATE_HEIGHT_MM + CLEARANCE + 2, 6);
    expect(OUTER_1U).toBeCloseTo(36 + CLEARANCE + 2, 6);
  });
});

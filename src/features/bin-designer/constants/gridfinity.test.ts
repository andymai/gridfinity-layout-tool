import { describe, it, expect } from 'vitest';
import { DESIGNER_CONSTRAINTS, minHeightUnits } from './gridfinity';

describe('minHeightUnits', () => {
  it('holds an ordinary bin to the usable-cavity minimum', () => {
    expect(minHeightUnits({ spacer: false, style: 'standard' })).toBe(
      DESIGNER_CONSTRAINTS.MIN_HEIGHT
    );
  });

  // #2915: a spacer is floorless, so the cavity rationale behind MIN_HEIGHT
  // doesn't bind — 1u is what shims a stack from an odd to an even height.
  it('lets a spacer go a unit lower', () => {
    expect(minHeightUnits({ spacer: true, style: 'standard' })).toBe(
      DESIGNER_CONSTRAINTS.MIN_SPACER_HEIGHT
    );
    expect(minHeightUnits({ spacer: true, style: 'standard' })).toBeLessThan(
      minHeightUnits({ spacer: false, style: 'standard' })
    );
  });

  // A spacer keeps its WALLS, so its body has to reach above the 5mm socket it
  // subtracts. 1u only clears that at the 7mm default: at a 3mm height unit a 1u
  // spacer asks for a -2mm wall, which OCCT extrudes downward into the foot.
  describe('spacer floor tracks the height unit', () => {
    const spacerFloor = (heightUnitMm: number): number =>
      minHeightUnits({ spacer: true, style: 'standard' }, heightUnitMm);

    it('leaves the default height unit at one unit', () => {
      expect(spacerFloor(7)).toBe(DESIGNER_CONSTRAINTS.MIN_SPACER_HEIGHT);
    });

    // The whole reachable range of the Physical Units control.
    it.each([3, 4, 5, 6, 7, 10, 20])('clears the socket at a %dmm height unit', (unit) => {
      const wallMm = spacerFloor(unit) * unit - 5;
      expect(wallMm).toBeGreaterThanOrEqual(DESIGNER_CONSTRAINTS.MIN_BODY_WALL_MM);
    });

    it('raises the floor only where one unit is not enough', () => {
      expect(spacerFloor(3)).toBe(2);
      expect(spacerFloor(5)).toBe(2);
      expect(spacerFloor(6)).toBe(1);
    });

    it('falls back to the default unit rather than dividing by nonsense', () => {
      expect(spacerFloor(0)).toBe(DESIGNER_CONSTRAINTS.MIN_SPACER_HEIGHT);
      expect(spacerFloor(Number.NaN)).toBe(DESIGNER_CONSTRAINTS.MIN_SPACER_HEIGHT);
    });

    // A tray's height is PINNED to 1 by the store, not floored, so raising its
    // floor alongside the spacer's would make the validator reject every tray at
    // a height unit of 5mm or less. Its wall is 0, so it never subtracts a socket.
    it('leaves a tray on the flat relaxed floor', () => {
      expect(minHeightUnits({ spacer: false, tile: true, style: 'standard' }, 3)).toBe(
        DESIGNER_CONSTRAINTS.MIN_SPACER_HEIGHT
      );
    });
  });

  // `deriveDimensions` makes the spacer flag inert on a flat base (no socket to
  // shell through), so the relaxed floor has to track the EFFECTIVE spacer or a
  // flat+spacer payload would buy 1u while generating an ordinary bin.
  it('holds a flat base to the bin minimum even when the spacer flag is set', () => {
    expect(minHeightUnits({ spacer: true, style: 'flat' })).toBe(DESIGNER_CONSTRAINTS.MIN_HEIGHT);
  });

  // A tray's wall is pinned to 0 and its real height comes from
  // `assembledHeight`, so `height` is inert and only has to clear the
  // validators — it takes the same relaxed floor the spacer does.
  it('relaxes the floor for a wall-less tray', () => {
    expect(minHeightUnits({ spacer: false, tile: true, style: 'standard' })).toBe(
      DESIGNER_CONSTRAINTS.MIN_SPACER_HEIGHT
    );
  });

  it('holds a socketless base to the bin minimum even when the tray flag is set', () => {
    expect(minHeightUnits({ spacer: false, tile: true, style: 'flat' })).toBe(
      DESIGNER_CONSTRAINTS.MIN_HEIGHT
    );
    expect(minHeightUnits({ spacer: false, tile: true, style: 'lid' })).toBe(
      DESIGNER_CONSTRAINTS.MIN_HEIGHT
    );
  });

  it('never returns a floor above the maximum height', () => {
    expect(minHeightUnits({ spacer: false, style: 'standard' })).toBeLessThan(
      DESIGNER_CONSTRAINTS.MAX_HEIGHT
    );
  });
});

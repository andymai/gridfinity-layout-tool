import { describe, it, expect } from 'vitest';
import { computeOverhangHighlightBoxes, type HighlightBox } from './overhangHighlightGeometry';

// Wall region [5, 55] → height 50, mid 30 (socket occupies [0, 5]).
const BASE = {
  outerW: 100,
  outerD: 80,
  wallBottomZ: 5,
  wallTopZ: 55,
  overhang: { left: 0, right: 0, front: 0, back: 0 },
};

const allFinite = (boxes: HighlightBox[]): boolean =>
  boxes.every((b) => [...b.center, ...b.size].every((n) => Number.isFinite(n)));

describe('computeOverhangHighlightBoxes', () => {
  it('emits a flush face sliver at the wall plane when overhang is 0', () => {
    const boxes = computeOverhangHighlightBoxes('right', BASE);
    expect(boxes).toHaveLength(1);
    const [face] = boxes;
    // Right wall lives at +X = +outerW/2; sliver centered there, spanning full depth + wall height.
    expect(face.center[0]).toBe(50);
    expect(face.center[1]).toBe(0);
    expect(face.center[2]).toBe(30); // mid of [5, 55]
    expect(face.size[1]).toBe(80);
    expect(face.size[2]).toBe(50); // wall height, excludes the 5mm socket
    expect(face.size[0]).toBeGreaterThan(0);
  });

  it('adds an outward grown band sized to the overhang value', () => {
    const boxes = computeOverhangHighlightBoxes('right', {
      ...BASE,
      overhang: { ...BASE.overhang, right: 6 },
    });
    expect(boxes).toHaveLength(2);
    const band = boxes[1];
    // Band spans x ∈ [50, 56]: center 53, thickness 6.
    expect(band.center[0]).toBeCloseTo(53);
    expect(band.size[0]).toBe(6);
    expect(band.size[1]).toBe(80);
    expect(band.size[2]).toBe(50); // matches the wall height
  });

  it('grows the correct sign per side', () => {
    const left = computeOverhangHighlightBoxes('left', {
      ...BASE,
      overhang: { ...BASE.overhang, left: 4 },
    })[1];
    expect(left.center[0]).toBeCloseTo(-52); // outward in -X

    const front = computeOverhangHighlightBoxes('front', {
      ...BASE,
      overhang: { ...BASE.overhang, front: 4 },
    })[1];
    expect(front.center[1]).toBeCloseTo(-42); // outward in -Y (-outerD/2 - 2)

    const back = computeOverhangHighlightBoxes('back', {
      ...BASE,
      overhang: { ...BASE.overhang, back: 4 },
    })[1];
    expect(back.center[1]).toBeCloseTo(42); // outward in +Y
  });

  it('spans from the socket top to the body top including the lip', () => {
    // Wall region [5, 64.4] (e.g. lip adds height): height 59.4, mid 34.7.
    const boxes = computeOverhangHighlightBoxes('back', { ...BASE, wallTopZ: 64.4 });
    expect(boxes[0].center[2]).toBeCloseTo(34.7);
    expect(boxes[0].size[2]).toBeCloseTo(59.4);
  });

  it('starts the wall at z=0 for a flat base (no socket)', () => {
    const boxes = computeOverhangHighlightBoxes('right', {
      ...BASE,
      wallBottomZ: 0,
      wallTopZ: 50,
    });
    expect(boxes[0].center[2]).toBe(25);
    expect(boxes[0].size[2]).toBe(50);
  });

  describe('feet', () => {
    it('emits nothing when there is no overhang', () => {
      expect(computeOverhangHighlightBoxes('feet', BASE)).toHaveLength(0);
    });

    it('emits one bottom strip per overhanging side, within the socket zone', () => {
      const boxes = computeOverhangHighlightBoxes('feet', {
        ...BASE,
        overhang: { left: 0, right: 5, front: 0, back: 0 },
      });
      expect(boxes).toHaveLength(1);
      const [strip] = boxes;
      expect(strip.center[0]).toBeCloseTo(52.5); // +outerW/2 + right/2
      expect(strip.size[1]).toBe(80); // spans full nominal depth
      expect(strip.size[2]).toBe(5); // fills the socket zone [0, 5]
      expect(strip.center[2]).toBeCloseTo(2.5);
    });

    it('adds a corner fill where two adjacent sides overhang', () => {
      const boxes = computeOverhangHighlightBoxes('feet', {
        ...BASE,
        overhang: { left: 0, right: 5, front: 0, back: 3 },
      });
      // right strip + back strip + one corner.
      expect(boxes).toHaveLength(3);
      const corner = boxes.find((b) => b.center[0] > 50 && b.center[1] > 40);
      expect(corner).toBeDefined();
      expect(corner?.size[0]).toBe(5);
      expect(corner?.size[1]).toBe(3);
    });
  });

  it('produces only finite coordinates', () => {
    const all: HighlightBox[] = [
      ...computeOverhangHighlightBoxes('left', {
        ...BASE,
        overhang: { left: 2, right: 0, front: 0, back: 0 },
      }),
      ...computeOverhangHighlightBoxes('feet', {
        ...BASE,
        overhang: { left: 2, right: 2, front: 2, back: 2 },
      }),
    ];
    expect(allFinite(all)).toBe(true);
  });
});

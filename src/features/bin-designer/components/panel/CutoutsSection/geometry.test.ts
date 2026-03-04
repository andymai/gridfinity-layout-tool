import { describe, it, expect } from 'vitest';
import type { Cutout, PathPoint } from '@/features/bin-designer/types';
import {
  getEffectiveBounds,
  computeBounds,
  clampPosition,
  getEffectiveDepth,
  calculateCutoutResize,
  constrainGroupDrag,
  clampCornerRadius,
  getResizeCursor,
  MIN_CUTOUT_SIZE,
  snapToGrid,
  SNAP_GRID_SIZE,
  findAlignmentGuides,
  GUIDE_SNAP_THRESHOLD,
  distributeHorizontally,
  distributeVertically,
  centerInBin,
  rotatePoint,
  getRotatedBounds,
  clampRotationToBounds,
  flipCutoutHorizontal,
  flipCutoutVertical,
  flipSelectionHorizontal,
  flipSelectionVertical,
} from './geometry';

const createCutout = (overrides: Partial<Cutout> = {}): Cutout => ({
  id: 'test',
  shape: 'rectangle',
  x: 10,
  y: 10,
  width: 20,
  depth: 15,
  cutDepth: 5,
  rotation: 0,
  cornerRadius: 0,
  label: '',
  groupId: null,
  ...overrides,
});

describe('geometry', () => {
  describe('getEffectiveBounds', () => {
    it('returns correct bounds for rectangle', () => {
      const cutout = createCutout({ x: 5, y: 10, width: 20, depth: 15 });
      const bounds = getEffectiveBounds(cutout);
      expect(bounds).toEqual({ minX: 5, minY: 10, maxX: 25, maxY: 25 });
    });

    it('returns bounds for circle using width and depth independently', () => {
      const cutout = createCutout({ shape: 'circle', x: 5, y: 10, width: 20, depth: 15 });
      const bounds = getEffectiveBounds(cutout);
      expect(bounds).toEqual({ minX: 5, minY: 10, maxX: 25, maxY: 25 });
    });
  });

  describe('computeBounds', () => {
    it('returns zero bounds for empty array', () => {
      const bounds = computeBounds([]);
      expect(bounds).toEqual({ minX: 0, minY: 0, maxX: 0, maxY: 0 });
    });

    it('computes bounds for single cutout', () => {
      const cutout = createCutout({ x: 5, y: 10, width: 20, depth: 15 });
      const bounds = computeBounds([cutout]);
      expect(bounds).toEqual({ minX: 5, minY: 10, maxX: 25, maxY: 25 });
    });

    it('computes combined bounds for multiple cutouts', () => {
      const c1 = createCutout({ x: 0, y: 0, width: 10, depth: 10 });
      const c2 = createCutout({ x: 20, y: 20, width: 10, depth: 10 });
      const bounds = computeBounds([c1, c2]);
      expect(bounds).toEqual({ minX: 0, minY: 0, maxX: 30, maxY: 30 });
    });
  });

  describe('clampPosition', () => {
    it('clamps position to keep cutout within bounds', () => {
      const cutout = createCutout({ x: 50, y: 50, width: 20, depth: 15 });
      const result = clampPosition(cutout, 40, 40);
      expect(result.x).toBe(20);
      expect(result.y).toBe(25);
    });

    it('clamps negative positions to zero', () => {
      const cutout = createCutout({ x: -5, y: -10, width: 20, depth: 15 });
      const result = clampPosition(cutout, 100, 100);
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
    });

    it('does not clamp positions already in bounds', () => {
      const cutout = createCutout({ x: 10, y: 10, width: 20, depth: 15 });
      const result = clampPosition(cutout, 100, 100);
      expect(result.x).toBe(10);
      expect(result.y).toBe(10);
    });
  });

  describe('getEffectiveDepth', () => {
    it('returns depth for rectangle', () => {
      const cutout = createCutout({ shape: 'rectangle', depth: 15 });
      expect(getEffectiveDepth(cutout)).toBe(15);
    });

    it('returns depth for circle (independent from width)', () => {
      const cutout = createCutout({ shape: 'circle', width: 20, depth: 12 });
      expect(getEffectiveDepth(cutout)).toBe(12);
    });
  });

  describe('calculateCutoutResize', () => {
    const start = { x: 10, y: 10, width: 20, depth: 15 };

    it('resizes SE corner outward', () => {
      const result = calculateCutoutResize(start, 'se', 40, 5, 100, 100, 'rectangle');
      // E: width = 40 - 10 = 30, S: newY = 5, depth = 25 - 5 = 20
      expect(result.x).toBe(10);
      expect(result.y).toBe(5);
      expect(result.width).toBe(30);
      expect(result.depth).toBe(20);
    });

    it('resizes NW corner outward', () => {
      const result = calculateCutoutResize(start, 'nw', 5, 30, 100, 100, 'rectangle');
      // W: newX = 5, width = 30 - 5 = 25, N: depth = 30 - 10 = 20 (clamped by binDepth)
      expect(result.x).toBe(5);
      expect(result.width).toBe(25);
      expect(result.depth).toBe(20);
    });

    it('enforces minimum size when squishing', () => {
      const result = calculateCutoutResize(start, 'se', 11, 24, 100, 100, 'rectangle');
      // E: width = max(2, 11 - 10) = 2 (MIN_CUTOUT_SIZE), S: newY = min(24, 25 - 2) = 23
      expect(result.width).toBeGreaterThanOrEqual(MIN_CUTOUT_SIZE);
      expect(result.depth).toBeGreaterThanOrEqual(MIN_CUTOUT_SIZE);
    });

    it('clamps to bin bounds on east edge', () => {
      const result = calculateCutoutResize(start, 'se', 120, 0, 50, 50, 'rectangle');
      // E: width = min(120 - 10, 50 - 10) = 40
      expect(result.x + result.width).toBeLessThanOrEqual(50);
    });

    it('clamps to bin bounds on west edge', () => {
      const result = calculateCutoutResize(start, 'nw', -10, 30, 100, 100, 'rectangle');
      expect(result.x).toBeGreaterThanOrEqual(0);
    });

    it('clamps to bin bounds on north edge', () => {
      const result = calculateCutoutResize(start, 'ne', 40, 120, 100, 50, 'rectangle');
      expect(result.y + result.depth).toBeLessThanOrEqual(50);
    });

    it('clamps to bin bounds on south edge', () => {
      const result = calculateCutoutResize(start, 'sw', 5, -10, 100, 100, 'rectangle');
      expect(result.y).toBeGreaterThanOrEqual(0);
    });

    it('resizes ellipse east handle (width changes, depth stays)', () => {
      const circleStart = { x: 20, y: 20, width: 10, depth: 10 };
      // cursor at (35, 25) → east resize → width = 35 - 20 = 15
      const result = calculateCutoutResize(circleStart, 'e', 35, 25, 100, 100, 'circle');
      expect(result.width).toBe(15);
      expect(result.depth).toBe(10);
    });

    it('enforces minimum size for circles', () => {
      const circleStart = { x: 20, y: 20, width: 10, depth: 10 };
      const result = calculateCutoutResize(circleStart, 'e', 21, 25, 100, 100, 'circle');
      expect(result.width).toBeGreaterThanOrEqual(MIN_CUTOUT_SIZE);
    });

    it('clamps circle to bin bounds', () => {
      const circleStart = { x: 5, y: 5, width: 10, depth: 10 };
      const result = calculateCutoutResize(circleStart, 'e', 50, 10, 20, 20, 'circle');
      expect(result.x + result.width).toBeLessThanOrEqual(20);
    });

    describe('alt-constrain (resize from center)', () => {
      it('resizes E handle symmetrically around center', () => {
        const start = { x: 10, y: 10, width: 20, depth: 15 };
        // Center at (20, 17.5). Cursor at x=35, width each side = |35-20| = 15
        const result = calculateCutoutResize(
          start,
          'e',
          35,
          17.5,
          100,
          100,
          'rectangle',
          0,
          false,
          true
        );
        expect(result.width).toBe(30); // 15 * 2
        expect(result.x).toBe(5); // 20 - 15
        expect(result.depth).toBe(15); // unchanged
      });

      it('resizes SE corner symmetrically around center', () => {
        const start = { x: 10, y: 10, width: 20, depth: 20 };
        // Center at (20, 20). Cursor at (30, 10)
        const result = calculateCutoutResize(
          start,
          'se',
          30,
          10,
          100,
          100,
          'rectangle',
          0,
          false,
          true
        );
        expect(result.width).toBe(20); // |30-20| * 2
        expect(result.depth).toBe(20); // |10-20| * 2
        expect(result.x).toBe(10); // 20 - 10
        expect(result.y).toBe(10); // 20 - 10
      });

      it('resizes N handle symmetrically around center', () => {
        const start = { x: 10, y: 10, width: 20, depth: 15 };
        // Center at (20, 17.5). Cursor at y=27.5 → halfD = 10
        const result = calculateCutoutResize(
          start,
          'n',
          20,
          27.5,
          100,
          100,
          'rectangle',
          0,
          false,
          true
        );
        expect(result.depth).toBe(20); // 10 * 2
        expect(result.y).toBe(7.5); // 17.5 - 10
        expect(result.width).toBe(20); // unchanged
      });
    });
  });

  describe('constrainGroupDrag', () => {
    it('allows drag within bounds', () => {
      const cutouts = [createCutout({ x: 10, y: 10, width: 20, depth: 15 })];
      const result = constrainGroupDrag(cutouts, 5, 5, 100, 100);
      expect(result).toEqual({ dx: 5, dy: 5 });
    });

    it('clamps positive drag to keep within bounds', () => {
      const cutouts = [createCutout({ x: 70, y: 80, width: 20, depth: 15 })];
      // maxX=90, binWidth=100 → max dx = 10
      // maxY=95, binDepth=100 → max dy = 5
      const result = constrainGroupDrag(cutouts, 20, 20, 100, 100);
      expect(result.dx).toBe(10);
      expect(result.dy).toBe(5);
    });

    it('clamps negative drag to keep within bounds', () => {
      const cutouts = [createCutout({ x: 5, y: 3, width: 20, depth: 15 })];
      const result = constrainGroupDrag(cutouts, -10, -10, 100, 100);
      expect(result.dx).toBe(-5);
      expect(result.dy).toBe(-3);
    });

    it('constrains multi-cutout group', () => {
      const cutouts = [
        createCutout({ x: 5, y: 5, width: 10, depth: 10 }),
        createCutout({ x: 80, y: 80, width: 10, depth: 10 }),
      ];
      // minX=5 → max negative dx=-5, maxX=90 → max positive dx=10
      const result = constrainGroupDrag(cutouts, 20, 20, 100, 100);
      expect(result.dx).toBe(10);
      expect(result.dy).toBe(10);
    });
  });

  describe('clampCornerRadius', () => {
    it('returns radius when within bounds', () => {
      expect(clampCornerRadius(5, 20, 30)).toBe(5);
    });

    it('clamps to half of smaller dimension', () => {
      expect(clampCornerRadius(15, 20, 10)).toBe(5);
    });

    it('clamps to half of width when width is smaller', () => {
      expect(clampCornerRadius(15, 10, 20)).toBe(5);
    });
  });

  describe('getResizeCursor', () => {
    it('returns nwse-resize for nw and se handles', () => {
      expect(getResizeCursor('nw')).toBe('nwse-resize');
      expect(getResizeCursor('se')).toBe('nwse-resize');
    });

    it('returns nesw-resize for ne and sw handles', () => {
      expect(getResizeCursor('ne')).toBe('nesw-resize');
      expect(getResizeCursor('sw')).toBe('nesw-resize');
    });

    it('returns ns-resize for n and s handles', () => {
      expect(getResizeCursor('n')).toBe('ns-resize');
      expect(getResizeCursor('s')).toBe('ns-resize');
    });

    it('returns ew-resize for e and w handles', () => {
      expect(getResizeCursor('e')).toBe('ew-resize');
      expect(getResizeCursor('w')).toBe('ew-resize');
    });
  });

  describe('MIN_CUTOUT_SIZE', () => {
    it('is a positive number', () => {
      expect(MIN_CUTOUT_SIZE).toBeGreaterThan(0);
      expect(MIN_CUTOUT_SIZE).toBe(2);
    });
  });

  describe('snapToGrid', () => {
    it('snaps to nearest integer (1mm grid)', () => {
      expect(snapToGrid(0.4)).toBe(0);
      expect(snapToGrid(1.2)).toBe(1);
      expect(snapToGrid(2.7)).toBe(3);
      expect(snapToGrid(5.5)).toBe(6);
    });

    it('rounds up from 0.5', () => {
      expect(snapToGrid(0.5)).toBe(1);
      expect(snapToGrid(1.5)).toBe(2);
      expect(snapToGrid(10.5)).toBe(11);
    });

    it('handles negative values', () => {
      expect(snapToGrid(-0.4)).toBe(-0);
      expect(snapToGrid(-1.2)).toBe(-1);
      expect(snapToGrid(-2.7)).toBe(-3);
      expect(snapToGrid(-0.5)).toBe(-0);
    });

    it('supports custom grid size (e.g., 0.5mm)', () => {
      expect(snapToGrid(1.2, 0.5)).toBe(1);
      expect(snapToGrid(1.3, 0.5)).toBe(1.5);
      expect(snapToGrid(1.7, 0.5)).toBe(1.5);
      expect(snapToGrid(1.8, 0.5)).toBe(2);
    });

    it('returns 0 for 0', () => {
      expect(snapToGrid(0)).toBe(0);
      expect(snapToGrid(0, 0.5)).toBe(0);
    });

    it('uses SNAP_GRID_SIZE default', () => {
      expect(SNAP_GRID_SIZE).toBe(1);
    });
  });

  describe('findAlignmentGuides', () => {
    it('returns empty array when no stationary cutouts', () => {
      const movingBounds = { minX: 10, minY: 10, maxX: 30, maxY: 25 };
      const guides = findAlignmentGuides(movingBounds, []);
      expect(guides).toEqual([]);
    });

    it('finds X guide when left edges align', () => {
      const movingBounds = { minX: 10, minY: 10, maxX: 30, maxY: 25 };
      const stationary = [createCutout({ x: 10, y: 40, width: 15, depth: 10 })];
      const guides = findAlignmentGuides(movingBounds, stationary);
      const xGuides = guides.filter((g) => g.axis === 'x' && g.position === 10);
      expect(xGuides.length).toBeGreaterThan(0);
    });

    it('finds Y guide when top edges align', () => {
      const movingBounds = { minX: 10, minY: 10, maxX: 30, maxY: 25 };
      const stationary = [createCutout({ x: 40, y: 10, width: 15, depth: 10 })];
      const guides = findAlignmentGuides(movingBounds, stationary);
      const yGuides = guides.filter((g) => g.axis === 'y' && g.position === 10);
      expect(yGuides.length).toBeGreaterThan(0);
    });

    it('finds center alignment guides', () => {
      // Moving bounds: minX=10, maxX=30 → centerX=20
      const movingBounds = { minX: 10, minY: 10, maxX: 30, maxY: 25 };
      // Stationary: x=15, width=10 → minX=15, maxX=25, centerX=20
      const stationary = [createCutout({ x: 15, y: 40, width: 10, depth: 10 })];
      const guides = findAlignmentGuides(movingBounds, stationary);
      const centerGuides = guides.filter((g) => g.axis === 'x' && g.position === 20);
      expect(centerGuides.length).toBeGreaterThan(0);
    });

    it('deduplicates guides at same position', () => {
      const movingBounds = { minX: 10, minY: 10, maxX: 30, maxY: 25 };
      const stationary = [
        createCutout({ x: 10, y: 40, width: 15, depth: 10 }),
        createCutout({ x: 10, y: 60, width: 20, depth: 10 }),
      ];
      const guides = findAlignmentGuides(movingBounds, stationary);
      const xGuides = guides.filter((g) => g.axis === 'x' && g.position === 10);
      expect(xGuides.length).toBe(1);
    });

    it('respects threshold distance', () => {
      const movingBounds = { minX: 10, minY: 10, maxX: 30, maxY: 25 };
      // Stationary at x=12 (2mm away from moving minX=10)
      const stationary = [createCutout({ x: 12, y: 40, width: 15, depth: 10 })];

      // With threshold=1, should not find guide
      const guides1 = findAlignmentGuides(movingBounds, stationary, 1);
      const xGuides1 = guides1.filter((g) => g.axis === 'x' && g.position === 12);
      expect(xGuides1.length).toBe(0);

      // With threshold=3, should find guide
      const guides2 = findAlignmentGuides(movingBounds, stationary, 3);
      const xGuides2 = guides2.filter((g) => g.axis === 'x' && g.position === 12);
      expect(xGuides2.length).toBeGreaterThan(0);
    });

    it('uses GUIDE_SNAP_THRESHOLD constant', () => {
      expect(GUIDE_SNAP_THRESHOLD).toBe(1);
    });
  });

  describe('distributeHorizontally', () => {
    it('returns empty for less than 3 cutouts', () => {
      const cutouts = [
        createCutout({ id: 'a', x: 10, width: 20 }),
        createCutout({ id: 'b', x: 40, width: 20 }),
      ];
      const result = distributeHorizontally(cutouts, 100);
      expect(result).toEqual({});
    });

    it('distributes 3 cutouts evenly', () => {
      const cutouts = [
        createCutout({ id: 'a', x: 10, width: 10 }),
        createCutout({ id: 'b', x: 50, width: 10 }),
        createCutout({ id: 'c', x: 30, width: 10 }),
      ];
      const result = distributeHorizontally(cutouts, 100);

      // After sorting: a(10), c(30), b(50)
      // Total span: (50 + 10) - 10 = 50
      // Total widths: 30
      // Gap: (50 - 30) / 2 = 10
      // Positions: a=10, c=10+10+10=30, b=30+10+10=50
      expect(result.a.x).toBe(10);
      expect(result.c.x).toBe(30);
      expect(result.b.x).toBe(50);
    });

    it('preserves first and last positions', () => {
      const cutouts = [
        createCutout({ id: 'a', x: 5, width: 10 }),
        createCutout({ id: 'b', x: 85, width: 10 }),
        createCutout({ id: 'c', x: 50, width: 10 }),
      ];
      const result = distributeHorizontally(cutouts, 100);

      // First cutout should stay at x=5
      // Last cutout should stay at x=85
      expect(result.a.x).toBe(5);
      expect(result.b.x).toBe(85);
      // Middle should be distributed evenly
      expect(result.c.x).toBeGreaterThan(5);
      expect(result.c.x).toBeLessThan(85);
    });
  });

  describe('distributeVertically', () => {
    it('returns empty for less than 3 cutouts', () => {
      const cutouts = [
        createCutout({ id: 'a', y: 10, depth: 15 }),
        createCutout({ id: 'b', y: 40, depth: 15 }),
      ];
      const result = distributeVertically(cutouts, 100);
      expect(result).toEqual({});
    });

    it('distributes 3 cutouts evenly', () => {
      const cutouts = [
        createCutout({ id: 'a', y: 10, depth: 10 }),
        createCutout({ id: 'b', y: 60, depth: 10 }),
        createCutout({ id: 'c', y: 35, depth: 10 }),
      ];
      const result = distributeVertically(cutouts, 100);

      // After sorting: a(10), c(35), b(60)
      // Total span: (60 + 10) - 10 = 60
      // Total depths: 30
      // Gap: (60 - 30) / 2 = 15
      // Positions: a=10, c=10+10+15=35, b=35+10+15=60
      expect(result.a.y).toBe(10);
      expect(result.c.y).toBe(35);
      expect(result.b.y).toBe(60);
    });

    it('preserves first and last positions', () => {
      const cutouts = [
        createCutout({ id: 'a', y: 5, depth: 10 }),
        createCutout({ id: 'b', y: 80, depth: 10 }),
        createCutout({ id: 'c', y: 40, depth: 10 }),
      ];
      const result = distributeVertically(cutouts, 100);

      expect(result.a.y).toBe(5);
      expect(result.b.y).toBe(80);
      expect(result.c.y).toBeGreaterThan(5);
      expect(result.c.y).toBeLessThan(80);
    });

    it('handles circles using depth field', () => {
      const cutouts = [
        createCutout({ id: 'a', shape: 'circle', y: 10, width: 10, depth: 10 }),
        createCutout({ id: 'b', shape: 'circle', y: 60, width: 10, depth: 10 }),
        createCutout({ id: 'c', shape: 'circle', y: 35, width: 10, depth: 10 }),
      ];
      const result = distributeVertically(cutouts, 100);

      expect(result.a.y).toBe(10);
      expect(result.c.y).toBe(35);
      expect(result.b.y).toBe(60);
    });
  });

  describe('centerInBin', () => {
    it('centers single cutout', () => {
      const cutouts = [createCutout({ id: 'a', x: 0, y: 0, width: 20, depth: 15 })];
      const result = centerInBin(cutouts, 100, 100);

      // Centered position: (100 - 20) / 2 = 40, (100 - 15) / 2 = 42.5
      expect(result.a.x).toBe(40);
      expect(result.a.y).toBe(42.5);
    });

    it('centers group of cutouts', () => {
      const cutouts = [
        createCutout({ id: 'a', x: 10, y: 10, width: 20, depth: 15 }),
        createCutout({ id: 'b', x: 40, y: 30, width: 20, depth: 15 }),
      ];
      const result = centerInBin(cutouts, 100, 100);

      // Group bounds: minX=10, maxX=60, minY=10, maxY=45
      // Group size: 50 x 35
      // Center offset: dx = (100 - 50) / 2 - 10 = 15, dy = (100 - 35) / 2 - 10 = 22.5
      expect(result.a.x).toBe(25);
      expect(result.a.y).toBe(32.5);
      expect(result.b.x).toBe(55);
      expect(result.b.y).toBe(52.5);
    });

    it('handles already centered cutouts', () => {
      const cutouts = [createCutout({ id: 'a', x: 40, y: 42.5, width: 20, depth: 15 })];
      const result = centerInBin(cutouts, 100, 100);

      // Should remain at center
      expect(result.a.x).toBe(40);
      expect(result.a.y).toBe(42.5);
    });

    it('returns empty for empty cutouts array', () => {
      const result = centerInBin([], 100, 100);
      expect(result).toEqual({});
    });
  });

  describe('rotatePoint', () => {
    it('returns identity for 0°', () => {
      const result = rotatePoint(10, 5, 0, 0, 0);
      expect(result.x).toBeCloseTo(10);
      expect(result.y).toBeCloseTo(5);
    });

    it('rotates 90° counter-clockwise around origin', () => {
      const result = rotatePoint(10, 0, 0, 0, 90);
      expect(result.x).toBeCloseTo(0);
      expect(result.y).toBeCloseTo(10);
    });

    it('rotates 180° around origin', () => {
      const result = rotatePoint(10, 5, 0, 0, 180);
      expect(result.x).toBeCloseTo(-10);
      expect(result.y).toBeCloseTo(-5);
    });

    it('rotates 270° around origin', () => {
      const result = rotatePoint(10, 0, 0, 0, 270);
      expect(result.x).toBeCloseTo(0);
      expect(result.y).toBeCloseTo(-10);
    });

    it('rotates around non-origin center', () => {
      // Point (15, 10) rotated 90° around (10, 10) → (10, 15)
      const result = rotatePoint(15, 10, 10, 10, 90);
      expect(result.x).toBeCloseTo(10);
      expect(result.y).toBeCloseTo(15);
    });
  });

  describe('getRotatedBounds', () => {
    it('returns unrotated bounds for 0° rotation', () => {
      const cutout = createCutout({ x: 10, y: 10, width: 20, depth: 10, rotation: 0 });
      const bounds = getRotatedBounds(cutout);
      expect(bounds).toEqual({ minX: 10, minY: 10, maxX: 30, maxY: 20 });
    });

    it('computes AABB for 45° rotated rectangle', () => {
      // 20x10 rect centered at (20, 15), rotated 45°
      const cutout = createCutout({ x: 10, y: 10, width: 20, depth: 10, rotation: 45 });
      const bounds = getRotatedBounds(cutout);
      const cos45 = Math.cos(Math.PI / 4);
      const expectedHalfW = 10 * cos45 + 5 * cos45; // hw*cos + hd*sin
      expect(bounds.minX).toBeCloseTo(20 - expectedHalfW);
      expect(bounds.maxX).toBeCloseTo(20 + expectedHalfW);
    });

    it('computes AABB for 90° rotated rectangle', () => {
      // 20x10 rect at (10, 10), rotated 90° → becomes 10x20
      const cutout = createCutout({ x: 10, y: 10, width: 20, depth: 10, rotation: 90 });
      const bounds = getRotatedBounds(cutout);
      // Center at (20, 15), rotated 90°: halfW = 0 + 5 = 5, halfD = 10 + 0 = 10
      expect(bounds.minX).toBeCloseTo(15);
      expect(bounds.maxX).toBeCloseTo(25);
      expect(bounds.minY).toBeCloseTo(5);
      expect(bounds.maxY).toBeCloseTo(25);
    });

    it('handles circles (same as unrotated since circle AABB is symmetric)', () => {
      const cutout = createCutout({
        shape: 'circle',
        x: 10,
        y: 10,
        width: 20,
        depth: 20,
        rotation: 0,
      });
      const bounds = getRotatedBounds(cutout);
      expect(bounds).toEqual({ minX: 10, minY: 10, maxX: 30, maxY: 30 });
    });
  });

  describe('clampRotationToBounds', () => {
    it('returns proposed angle when it fits', () => {
      const cutout = createCutout({ x: 40, y: 40, width: 20, depth: 10, rotation: 0 });
      const result = clampRotationToBounds(cutout, 45, 100, 100);
      expect(result).toBe(45);
    });

    it('clamps angle when rotation would exceed bounds', () => {
      // Large rectangle near corner: rotation would push it out
      const cutout = createCutout({ x: 0, y: 0, width: 50, depth: 10, rotation: 0 });
      const result = clampRotationToBounds(cutout, 90, 50, 50);
      // At 90°, a 50x10 becomes 10x50 — fits if centered properly but x=0,y=0
      // with center at (25, 5), rotated 90° AABB: halfW=5, halfD=25 → minY=5-25=-20 → out of bounds
      expect(result).toBeLessThan(90);
      expect(result).toBeGreaterThanOrEqual(0);
    });

    it('returns current rotation when no rotation fits', () => {
      // Cutout that barely fits at 0° — any rotation would overflow
      const cutout = createCutout({ x: 0, y: 0, width: 100, depth: 50, rotation: 0 });
      const result = clampRotationToBounds(cutout, 90, 100, 50);
      expect(result).toBeCloseTo(0, 0);
    });
  });

  describe('flipCutoutHorizontal', () => {
    it('returns 0° for rectangle at 0°', () => {
      const cutout = createCutout({ rotation: 0 });
      const result = flipCutoutHorizontal(cutout);
      expect(result.rotation).toBe(0);
    });

    it('flips 45° rectangle to 315°', () => {
      const cutout = createCutout({ rotation: 45 });
      const result = flipCutoutHorizontal(cutout);
      expect(result.rotation).toBe(315);
    });

    it('flips 90° rectangle to 270°', () => {
      const cutout = createCutout({ rotation: 90 });
      const result = flipCutoutHorizontal(cutout);
      expect(result.rotation).toBe(270);
    });

    it('flips circle the same as rectangle', () => {
      const cutout = createCutout({ shape: 'circle', rotation: 30 });
      const result = flipCutoutHorizontal(cutout);
      expect(result.rotation).toBe(330);
    });

    it('mirrors path points horizontally without swapping handles', () => {
      const cutout = createCutout({
        shape: 'path',
        path: [
          { x: 10, y: 5, handleIn: null, handleOut: { dx: 2, dy: 3 }, symmetric: false },
          { x: 20, y: 5, handleIn: { dx: -1, dy: 1 }, handleOut: null, symmetric: false },
        ],
      });
      const result = flipCutoutHorizontal(cutout);
      // Center X = (10+20)/2 = 15
      // Point 0: x = 2*15 - 10 = 20, handleOut X negated: dx=-2, dy=3
      // Point 1: x = 2*15 - 20 = 10, handleIn X negated: dx=1, dy=1
      expect(result.path).toBeDefined();
      const path = result.path as PathPoint[];
      expect(path[0].x).toBe(20);
      expect(path[0].y).toBe(5);
      expect(path[0].handleIn).toBeNull();
      expect(path[0].handleOut).toEqual({ dx: -2, dy: 3 });
      expect(path[1].x).toBe(10);
      expect(path[1].y).toBe(5);
      expect(path[1].handleIn).toEqual({ dx: 1, dy: 1 });
      expect(path[1].handleOut).toBeNull();
    });

    it('returns updated bounding box fields for path shapes', () => {
      const cutout = createCutout({
        shape: 'path',
        x: 10,
        y: 5,
        width: 10,
        depth: 0,
        path: [
          { x: 10, y: 5, handleIn: null, handleOut: null, symmetric: false },
          { x: 20, y: 5, handleIn: null, handleOut: null, symmetric: false },
        ],
      });
      const result = flipCutoutHorizontal(cutout);
      expect(result.x).toBeDefined();
      expect(result.y).toBeDefined();
      expect(result.width).toBeDefined();
      expect(result.depth).toBeDefined();
    });

    it('does not set rotation for path shapes', () => {
      const cutout = createCutout({
        shape: 'path',
        path: [
          { x: 0, y: 0, handleIn: null, handleOut: null, symmetric: false },
          { x: 10, y: 10, handleIn: null, handleOut: null, symmetric: false },
        ],
      });
      const result = flipCutoutHorizontal(cutout);
      expect(result.rotation).toBeUndefined();
      expect(result.path).toBeDefined();
    });
  });

  describe('flipCutoutVertical', () => {
    it('returns 180° for rectangle at 0°', () => {
      const cutout = createCutout({ rotation: 0 });
      const result = flipCutoutVertical(cutout);
      expect(result.rotation).toBe(180);
    });

    it('flips 45° rectangle to 135°', () => {
      const cutout = createCutout({ rotation: 45 });
      const result = flipCutoutVertical(cutout);
      expect(result.rotation).toBe(135);
    });

    it('flips 90° rectangle to 90°', () => {
      const cutout = createCutout({ rotation: 90 });
      const result = flipCutoutVertical(cutout);
      expect(result.rotation).toBe(90);
    });

    it('flips 270° to 270° (symmetric case)', () => {
      const cutout = createCutout({ rotation: 270 });
      const result = flipCutoutVertical(cutout);
      expect(result.rotation).toBe(270);
    });

    it('mirrors path points vertically without swapping handles', () => {
      const cutout = createCutout({
        shape: 'path',
        path: [
          { x: 5, y: 10, handleIn: null, handleOut: { dx: 2, dy: 3 }, symmetric: false },
          { x: 5, y: 20, handleIn: { dx: -1, dy: -2 }, handleOut: null, symmetric: false },
        ],
      });
      const result = flipCutoutVertical(cutout);
      // Center Y = (10+20)/2 = 15
      // Point 0: y = 2*15 - 10 = 20, handleOut Y negated: dx=2, dy=-3
      // Point 1: y = 2*15 - 20 = 10, handleIn Y negated: dx=-1, dy=2
      expect(result.path).toBeDefined();
      const path = result.path as PathPoint[];
      expect(path[0].x).toBe(5);
      expect(path[0].y).toBe(20);
      expect(path[0].handleIn).toBeNull();
      expect(path[0].handleOut).toEqual({ dx: 2, dy: -3 });
      expect(path[1].x).toBe(5);
      expect(path[1].y).toBe(10);
      expect(path[1].handleIn).toEqual({ dx: -1, dy: 2 });
      expect(path[1].handleOut).toBeNull();
    });

    it('returns updated bounding box fields for path shapes', () => {
      const cutout = createCutout({
        shape: 'path',
        x: 5,
        y: 10,
        width: 0,
        depth: 10,
        path: [
          { x: 5, y: 10, handleIn: null, handleOut: null, symmetric: false },
          { x: 5, y: 20, handleIn: null, handleOut: null, symmetric: false },
        ],
      });
      const result = flipCutoutVertical(cutout);
      expect(result.x).toBeDefined();
      expect(result.y).toBeDefined();
      expect(result.width).toBeDefined();
      expect(result.depth).toBeDefined();
    });
  });

  describe('flipSelectionHorizontal', () => {
    it('flips single cutout rotation without repositioning', () => {
      const cutout = createCutout({ id: 'a', x: 10, y: 5, width: 20, depth: 15, rotation: 45 });
      const updates = flipSelectionHorizontal([cutout]);
      expect(updates.get('a')).toEqual({ rotation: 315 });
    });

    it('mirrors multi-selection X positions around group center', () => {
      const a = createCutout({ id: 'a', x: 0, y: 0, width: 10, depth: 10, rotation: 0 });
      const b = createCutout({ id: 'b', x: 30, y: 0, width: 10, depth: 10, rotation: 0 });
      const updates = flipSelectionHorizontal([a, b]);
      // Group bounds: minX=0, maxX=40, center=20
      // a: mirroredX = 2*20 - (0+10) = 30, rotation stays 0
      // b: mirroredX = 2*20 - (30+10) = 0, rotation stays 0
      expect(updates.get('a')).toEqual({ rotation: 0, x: 30 });
      expect(updates.get('b')).toEqual({ rotation: 0, x: 0 });
    });

    it('translates path points to match group-mirrored position', () => {
      const pathA = createCutout({
        id: 'a',
        shape: 'path',
        x: 0,
        y: 0,
        width: 10,
        depth: 10,
        path: [
          { x: 0, y: 0, handleIn: null, handleOut: null, symmetric: false },
          { x: 10, y: 10, handleIn: null, handleOut: null, symmetric: false },
        ],
      });
      const pathB = createCutout({
        id: 'b',
        shape: 'path',
        x: 30,
        y: 0,
        width: 10,
        depth: 10,
        path: [
          { x: 30, y: 0, handleIn: null, handleOut: null, symmetric: false },
          { x: 40, y: 10, handleIn: null, handleOut: null, symmetric: false },
        ],
      });
      const updates = flipSelectionHorizontal([pathA, pathB]);
      // Group bounds: minX=0, maxX=40, center=20
      // pathA: mirroredX = 2*20 - (0+10) = 30 → path points must be at ~30-40
      const patchA = updates.get('a') as Partial<Cutout>;
      expect(patchA.x).toBe(30);
      expect(patchA.path).toBeDefined();
      const pathAPoints = patchA.path as PathPoint[];
      expect(pathAPoints[0].x).toBeCloseTo(40);
      expect(pathAPoints[1].x).toBeCloseTo(30);
    });
  });

  describe('flipSelectionVertical', () => {
    it('flips single cutout rotation without repositioning', () => {
      const cutout = createCutout({ id: 'a', x: 10, y: 5, width: 20, depth: 15, rotation: 0 });
      const updates = flipSelectionVertical([cutout]);
      expect(updates.get('a')).toEqual({ rotation: 180 });
    });

    it('mirrors multi-selection Y positions around group center', () => {
      const a = createCutout({ id: 'a', x: 0, y: 0, width: 10, depth: 10, rotation: 0 });
      const b = createCutout({ id: 'b', x: 0, y: 30, width: 10, depth: 10, rotation: 0 });
      const updates = flipSelectionVertical([a, b]);
      // Group bounds: minY=0, maxY=40, center=20
      // a: mirroredY = 2*20 - (0+10) = 30, rotation → 180
      // b: mirroredY = 2*20 - (30+10) = 0, rotation → 180
      expect(updates.get('a')).toEqual({ rotation: 180, y: 30 });
      expect(updates.get('b')).toEqual({ rotation: 180, y: 0 });
    });

    it('translates path points to match group-mirrored position', () => {
      const pathA = createCutout({
        id: 'a',
        shape: 'path',
        x: 0,
        y: 0,
        width: 10,
        depth: 10,
        path: [
          { x: 0, y: 0, handleIn: null, handleOut: null, symmetric: false },
          { x: 10, y: 10, handleIn: null, handleOut: null, symmetric: false },
        ],
      });
      const pathB = createCutout({
        id: 'b',
        shape: 'path',
        x: 0,
        y: 30,
        width: 10,
        depth: 10,
        path: [
          { x: 0, y: 30, handleIn: null, handleOut: null, symmetric: false },
          { x: 10, y: 40, handleIn: null, handleOut: null, symmetric: false },
        ],
      });
      const updates = flipSelectionVertical([pathA, pathB]);
      // Group bounds: minY=0, maxY=40, center=20
      // pathA: mirroredY = 2*20 - (0+10) = 30 → path points must be at ~30-40
      const patchA = updates.get('a') as Partial<Cutout>;
      expect(patchA.y).toBe(30);
      expect(patchA.path).toBeDefined();
      const pathAPoints = patchA.path as PathPoint[];
      expect(pathAPoints[0].y).toBeCloseTo(40);
      expect(pathAPoints[1].y).toBeCloseTo(30);
    });
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';
import { capturePointer, calculateResizeRect, mapInteractionToHint } from './interaction';
import { binId, gridUnits } from '@/core/types';
import type { Coord, Interaction, Rect, ResizeHandle } from '@/core/types';
import type { PointerCaptureHandle } from './types';

const coord = (x: number, y: number): Coord => ({ x: gridUnits(x), y: gridUnits(y) });
const rect = (x: number, y: number, width: number, depth: number): Rect => ({
  x: gridUnits(x),
  y: gridUnits(y),
  width: gridUnits(width),
  depth: gridUnits(depth),
});

describe('calculateResizeRect', () => {
  const defaultDrawer = { width: 10, depth: 8 };
  const startRect: Rect = rect(2, 2, 3, 2);

  describe('east handle (expand right)', () => {
    it('expands width when cursor moves right', () => {
      const result = calculateResizeRect(startRect, 'e', coord(6, 3), defaultDrawer);
      expect(result).toEqual({ x: 2, y: 2, width: 5, depth: 2 });
    });

    it('shrinks width when cursor moves left (respects minSize)', () => {
      const result = calculateResizeRect(startRect, 'e', coord(2, 3), defaultDrawer);
      expect(result).toEqual({ x: 2, y: 2, width: 1, depth: 2 });
    });

    it('clamps to drawer bounds', () => {
      const result = calculateResizeRect(startRect, 'e', coord(15, 3), defaultDrawer);
      expect(result.x + result.width).toBeLessThanOrEqual(defaultDrawer.width);
    });
  });

  describe('west handle (expand left)', () => {
    it('expands left when cursor moves left', () => {
      const result = calculateResizeRect(startRect, 'w', coord(0, 3), defaultDrawer);
      expect(result).toEqual({ x: 0, y: 2, width: 5, depth: 2 });
    });

    it('shrinks left when cursor moves right', () => {
      const result = calculateResizeRect(startRect, 'w', coord(3, 3), defaultDrawer);
      expect(result).toEqual({ x: 3, y: 2, width: 2, depth: 2 });
    });

    it('clamps x to 0 (drawer left edge)', () => {
      const result = calculateResizeRect(startRect, 'w', coord(-5, 3), defaultDrawer);
      expect(result.x).toBeGreaterThanOrEqual(0);
    });
  });

  describe('north handle (expand top in grid Y)', () => {
    it('expands depth when cursor moves up (larger Y)', () => {
      const result = calculateResizeRect(startRect, 'n', coord(3, 5), defaultDrawer);
      expect(result).toEqual({ x: 2, y: 2, width: 3, depth: 4 });
    });

    it('shrinks depth when cursor moves down', () => {
      const result = calculateResizeRect(startRect, 'n', coord(3, 2), defaultDrawer);
      expect(result).toEqual({ x: 2, y: 2, width: 3, depth: 1 });
    });

    it('clamps to drawer depth', () => {
      const result = calculateResizeRect(startRect, 'n', coord(3, 15), defaultDrawer);
      expect(result.y + result.depth).toBeLessThanOrEqual(defaultDrawer.depth);
    });
  });

  describe('south handle (expand bottom)', () => {
    it('expands south when cursor moves down (smaller Y)', () => {
      const result = calculateResizeRect(startRect, 's', coord(3, 0), defaultDrawer);
      expect(result).toEqual({ x: 2, y: 0, width: 3, depth: 4 });
    });

    it('shrinks south when cursor moves up', () => {
      const result = calculateResizeRect(startRect, 's', coord(3, 3), defaultDrawer);
      expect(result).toEqual({ x: 2, y: 3, width: 3, depth: 1 });
    });

    it('clamps y to 0 (drawer bottom edge)', () => {
      const result = calculateResizeRect(startRect, 's', coord(3, -5), defaultDrawer);
      expect(result.y).toBeGreaterThanOrEqual(0);
    });
  });

  describe('corner handles', () => {
    it('northeast expands both width and depth', () => {
      const result = calculateResizeRect(startRect, 'ne', coord(6, 6), defaultDrawer);
      expect(result).toEqual({ x: 2, y: 2, width: 5, depth: 5 });
    });

    it('northwest expands left and depth', () => {
      const result = calculateResizeRect(startRect, 'nw', coord(0, 6), defaultDrawer);
      expect(result).toEqual({ x: 0, y: 2, width: 5, depth: 5 });
    });

    it('southeast expands width and bottom', () => {
      const result = calculateResizeRect(startRect, 'se', coord(6, 0), defaultDrawer);
      expect(result).toEqual({ x: 2, y: 0, width: 5, depth: 4 });
    });

    it('southwest expands left and bottom', () => {
      const result = calculateResizeRect(startRect, 'sw', coord(0, 0), defaultDrawer);
      expect(result).toEqual({ x: 0, y: 0, width: 5, depth: 4 });
    });
  });

  describe('minimum size enforcement', () => {
    it('enforces default minSize of 1', () => {
      const result = calculateResizeRect(startRect, 'e', coord(0, 0), defaultDrawer);
      expect(result.width).toBeGreaterThanOrEqual(1);
      expect(result.depth).toBeGreaterThanOrEqual(1);
    });

    it('enforces custom minSize (half-bin mode)', () => {
      const result = calculateResizeRect(startRect, 'e', coord(1.5, 0), defaultDrawer, 0.5);
      expect(result.width).toBeGreaterThanOrEqual(0.5);
    });

    it('allows 0.5 increments in half-bin mode', () => {
      const smallRect: Rect = rect(1, 1, 1, 1);
      const result = calculateResizeRect(smallRect, 'e', coord(1, 1), defaultDrawer, 0.5);
      expect(result.width).toBe(0.5);
    });
  });

  describe('bounds clamping', () => {
    it('clamps width to not exceed drawer', () => {
      const edgeRect: Rect = rect(8, 2, 2, 2);
      const result = calculateResizeRect(edgeRect, 'e', coord(15, 3), defaultDrawer);
      expect(result.x + result.width).toBe(defaultDrawer.width);
    });

    it('clamps depth to not exceed drawer', () => {
      const edgeRect: Rect = rect(2, 6, 2, 2);
      const result = calculateResizeRect(edgeRect, 'n', coord(3, 15), defaultDrawer);
      expect(result.y + result.depth).toBe(defaultDrawer.depth);
    });

    it('handles resize at origin corner', () => {
      const originRect: Rect = rect(0, 0, 2, 2);
      const result = calculateResizeRect(originRect, 'sw', coord(-5, -5), defaultDrawer);
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
      expect(result.width).toBeGreaterThanOrEqual(1);
      expect(result.depth).toBeGreaterThanOrEqual(1);
    });

    it('handles resize at far corner', () => {
      const farRect: Rect = rect(8, 6, 2, 2);
      const result = calculateResizeRect(farRect, 'ne', coord(20, 20), defaultDrawer);
      expect(result.x + result.width).toBe(defaultDrawer.width);
      expect(result.y + result.depth).toBe(defaultDrawer.depth);
    });
  });

  describe('edge cases', () => {
    it('handles zero cursor movement', () => {
      const result = calculateResizeRect(startRect, 'e', coord(4, 3), defaultDrawer);
      // Cursor at x=4, rect starts at x=2 with width 3, so right edge is at x=5
      // With cursor at x=4: width = max(1, 4 - 2 + 1) = 3
      expect(result).toEqual({ x: 2, y: 2, width: 3, depth: 2 });
    });

    it('handles fractional cursor positions', () => {
      const result = calculateResizeRect(startRect, 'e', coord(5.5, 3), defaultDrawer);
      expect(result.width).toBe(4.5);
    });

    it('preserves unchanged dimensions', () => {
      const result = calculateResizeRect(startRect, 'e', coord(6, 3), defaultDrawer);
      expect(result.y).toBe(startRect.y);
      expect(result.depth).toBe(startRect.depth);
    });
  });
});

describe('mapInteractionToHint', () => {
  describe('null interaction', () => {
    it('returns idle hint for null interaction', () => {
      const result = mapInteractionToHint(null);
      expect(result).toEqual({ type: 'idle' });
    });
  });

  describe('draw interaction', () => {
    it('maps draw to drawing hint', () => {
      const interaction: Interaction = {
        type: 'draw',
        start: coord(1, 2),
        current: coord(3, 4),
      };
      const result = mapInteractionToHint(interaction);
      expect(result).toEqual({
        type: 'drawing',
        start: { x: 1, y: 2 },
        current: { x: 3, y: 4 },
      });
    });
  });

  describe('paint interaction', () => {
    it('maps paint to drawing hint (appears same to remote users)', () => {
      const interaction: Interaction = {
        type: 'paint',
        paintSize: { width: 2, depth: 2 },
        start: coord(0, 0),
        current: coord(5, 5),
      };
      const result = mapInteractionToHint(interaction);
      expect(result).toEqual({
        type: 'drawing',
        start: { x: 0, y: 0 },
        current: { x: 5, y: 5 },
      });
    });
  });

  describe('drag interaction', () => {
    it('maps drag to dragging hint with binIds and delta', () => {
      const interaction: Interaction = {
        type: 'drag',
        binIds: [binId('bin1'), binId('bin2')],
        startCoord: coord(1, 1),
        currentCoord: coord(3, 2),
        valid: true,
        isOverGrid: true,
      };
      const result = mapInteractionToHint(interaction);
      expect(result).toEqual({
        type: 'dragging',
        binIds: ['bin1', 'bin2'],
        delta: { x: 3, y: 2 }, // Uses currentCoord as delta
      });
    });

    it('includes binIds for multi-bin drag', () => {
      const interaction: Interaction = {
        type: 'drag',
        binIds: [binId('a'), binId('b'), binId('c')],
        startCoord: coord(0, 0),
        currentCoord: coord(1, 1),
        valid: false,
        isOverGrid: false,
      };
      const result = mapInteractionToHint(interaction);
      expect(result.type).toBe('dragging');
      if (result.type === 'dragging') {
        expect(result.binIds).toHaveLength(3);
      }
    });
  });

  describe('resize interaction', () => {
    it('maps resize to resizing hint with binIds and handle', () => {
      const interaction: Interaction = {
        type: 'resize',
        binIds: [binId('bin1')],
        handle: 'se',
        startRects: new Map([[binId('bin1'), rect(0, 0, 2, 2)]]),
        currentRects: new Map([[binId('bin1'), rect(0, 0, 3, 3)]]),
        valid: true,
      };
      const result = mapInteractionToHint(interaction);
      expect(result).toEqual({
        type: 'resizing',
        binIds: ['bin1'],
        handle: 'se',
      });
    });

    it('preserves handle direction', () => {
      const handles: ResizeHandle[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
      for (const handle of handles) {
        const interaction: Interaction = {
          type: 'resize',
          binIds: [binId('bin1')],
          handle,
          startRects: new Map(),
          currentRects: new Map(),
          valid: true,
        };
        const result = mapInteractionToHint(interaction);
        expect(result.type).toBe('resizing');
        if (result.type === 'resizing') {
          expect(result.handle).toBe(handle);
        }
      }
    });
  });

  describe('stagingDrag interaction', () => {
    it('returns idle hint (staging drags not broadcast)', () => {
      const interaction: Interaction = {
        type: 'stagingDrag',
        binId: binId('staging-bin'),
        currentCoord: coord(5, 5),
        valid: true,
      };
      const result = mapInteractionToHint(interaction);
      expect(result).toEqual({ type: 'idle' });
    });

    it('returns idle even with null currentCoord', () => {
      const interaction: Interaction = {
        type: 'stagingDrag',
        binId: binId('staging-bin'),
        currentCoord: null,
        valid: false,
      };
      const result = mapInteractionToHint(interaction);
      expect(result).toEqual({ type: 'idle' });
    });
  });

  // Note: unknown interaction types are now a compile error due to exhaustive
  // switch. No runtime test needed.
});

describe('capturePointer', () => {
  let mockSetPointerCapture: Mock<(pointerId: number) => void>;
  let originalSetPointerCapture: typeof document.body.setPointerCapture;

  beforeEach(() => {
    mockSetPointerCapture = vi.fn<(pointerId: number) => void>();
    originalSetPointerCapture = document.body.setPointerCapture;
    document.body.setPointerCapture = mockSetPointerCapture;
  });

  afterEach(() => {
    document.body.setPointerCapture = originalSetPointerCapture;
    vi.restoreAllMocks();
  });

  it('returns false when pointerId is undefined', () => {
    const activePointerIdRef = { current: null };
    const capturedPointerRef = { current: null as PointerCaptureHandle | null };

    const result = capturePointer(undefined, activePointerIdRef, capturedPointerRef);

    expect(result).toBe(false);
    expect(activePointerIdRef.current).toBeNull();
    expect(capturedPointerRef.current).toBeNull();
    expect(mockSetPointerCapture).not.toHaveBeenCalled();
  });

  it('captures pointer and returns true on success', () => {
    const activePointerIdRef = { current: null as number | null };
    const capturedPointerRef = { current: null as PointerCaptureHandle | null };
    const pointerId = 42;

    const result = capturePointer(pointerId, activePointerIdRef, capturedPointerRef);

    expect(result).toBe(true);
    expect(activePointerIdRef.current).toBe(42);
    expect(capturedPointerRef.current).toEqual({
      element: document.body,
      pointerId: 42,
    });
    expect(mockSetPointerCapture).toHaveBeenCalledWith(42);
  });

  it('returns false when setPointerCapture throws (e.g., pointer already released)', () => {
    mockSetPointerCapture.mockImplementation(() => {
      throw new Error('InvalidPointerId: Pointer not found');
    });

    const activePointerIdRef = { current: null as number | null };
    const capturedPointerRef = { current: null as PointerCaptureHandle | null };
    const pointerId = 99;

    const result = capturePointer(pointerId, activePointerIdRef, capturedPointerRef);

    expect(result).toBe(false);
    // activePointerIdRef is set before the try block
    expect(activePointerIdRef.current).toBe(99);
    // capturedPointerRef should remain null since capture failed
    expect(capturedPointerRef.current).toBeNull();
  });

  it('handles zero as a valid pointerId', () => {
    const activePointerIdRef = { current: null as number | null };
    const capturedPointerRef = { current: null as PointerCaptureHandle | null };
    const pointerId = 0;

    const result = capturePointer(pointerId, activePointerIdRef, capturedPointerRef);

    expect(result).toBe(true);
    expect(activePointerIdRef.current).toBe(0);
    expect(mockSetPointerCapture).toHaveBeenCalledWith(0);
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { capturePointer, calculateResizeRect, mapInteractionToHint } from './interaction';
import type { Interaction, Rect, ResizeHandle } from '@/core/types';
import type { PointerCaptureHandle } from './types';

describe('calculateResizeRect', () => {
  const defaultDrawer = { width: 10, depth: 8 };
  const startRect: Rect = { x: 2, y: 2, width: 3, depth: 2 };

  describe('east handle (expand right)', () => {
    it('expands width when cursor moves right', () => {
      const result = calculateResizeRect(startRect, 'e', { x: 6, y: 3 }, defaultDrawer);
      expect(result).toEqual({ x: 2, y: 2, width: 5, depth: 2 });
    });

    it('shrinks width when cursor moves left (respects minSize)', () => {
      const result = calculateResizeRect(startRect, 'e', { x: 2, y: 3 }, defaultDrawer);
      expect(result).toEqual({ x: 2, y: 2, width: 1, depth: 2 });
    });

    it('clamps to drawer bounds', () => {
      const result = calculateResizeRect(startRect, 'e', { x: 15, y: 3 }, defaultDrawer);
      expect(result.x + result.width).toBeLessThanOrEqual(defaultDrawer.width);
    });
  });

  describe('west handle (expand left)', () => {
    it('expands left when cursor moves left', () => {
      const result = calculateResizeRect(startRect, 'w', { x: 0, y: 3 }, defaultDrawer);
      expect(result).toEqual({ x: 0, y: 2, width: 5, depth: 2 });
    });

    it('shrinks left when cursor moves right', () => {
      const result = calculateResizeRect(startRect, 'w', { x: 3, y: 3 }, defaultDrawer);
      expect(result).toEqual({ x: 3, y: 2, width: 2, depth: 2 });
    });

    it('clamps x to 0 (drawer left edge)', () => {
      const result = calculateResizeRect(startRect, 'w', { x: -5, y: 3 }, defaultDrawer);
      expect(result.x).toBeGreaterThanOrEqual(0);
    });
  });

  describe('north handle (expand top in grid Y)', () => {
    it('expands depth when cursor moves up (larger Y)', () => {
      const result = calculateResizeRect(startRect, 'n', { x: 3, y: 5 }, defaultDrawer);
      expect(result).toEqual({ x: 2, y: 2, width: 3, depth: 4 });
    });

    it('shrinks depth when cursor moves down', () => {
      const result = calculateResizeRect(startRect, 'n', { x: 3, y: 2 }, defaultDrawer);
      expect(result).toEqual({ x: 2, y: 2, width: 3, depth: 1 });
    });

    it('clamps to drawer depth', () => {
      const result = calculateResizeRect(startRect, 'n', { x: 3, y: 15 }, defaultDrawer);
      expect(result.y + result.depth).toBeLessThanOrEqual(defaultDrawer.depth);
    });
  });

  describe('south handle (expand bottom)', () => {
    it('expands south when cursor moves down (smaller Y)', () => {
      const result = calculateResizeRect(startRect, 's', { x: 3, y: 0 }, defaultDrawer);
      expect(result).toEqual({ x: 2, y: 0, width: 3, depth: 4 });
    });

    it('shrinks south when cursor moves up', () => {
      const result = calculateResizeRect(startRect, 's', { x: 3, y: 3 }, defaultDrawer);
      expect(result).toEqual({ x: 2, y: 3, width: 3, depth: 1 });
    });

    it('clamps y to 0 (drawer bottom edge)', () => {
      const result = calculateResizeRect(startRect, 's', { x: 3, y: -5 }, defaultDrawer);
      expect(result.y).toBeGreaterThanOrEqual(0);
    });
  });

  describe('corner handles', () => {
    it('northeast expands both width and depth', () => {
      const result = calculateResizeRect(startRect, 'ne', { x: 6, y: 6 }, defaultDrawer);
      expect(result).toEqual({ x: 2, y: 2, width: 5, depth: 5 });
    });

    it('northwest expands left and depth', () => {
      const result = calculateResizeRect(startRect, 'nw', { x: 0, y: 6 }, defaultDrawer);
      expect(result).toEqual({ x: 0, y: 2, width: 5, depth: 5 });
    });

    it('southeast expands width and bottom', () => {
      const result = calculateResizeRect(startRect, 'se', { x: 6, y: 0 }, defaultDrawer);
      expect(result).toEqual({ x: 2, y: 0, width: 5, depth: 4 });
    });

    it('southwest expands left and bottom', () => {
      const result = calculateResizeRect(startRect, 'sw', { x: 0, y: 0 }, defaultDrawer);
      expect(result).toEqual({ x: 0, y: 0, width: 5, depth: 4 });
    });
  });

  describe('minimum size enforcement', () => {
    it('enforces default minSize of 1', () => {
      const result = calculateResizeRect(startRect, 'e', { x: 0, y: 0 }, defaultDrawer);
      expect(result.width).toBeGreaterThanOrEqual(1);
      expect(result.depth).toBeGreaterThanOrEqual(1);
    });

    it('enforces custom minSize (half-bin mode)', () => {
      const result = calculateResizeRect(startRect, 'e', { x: 1.5, y: 0 }, defaultDrawer, 0.5);
      expect(result.width).toBeGreaterThanOrEqual(0.5);
    });

    it('allows 0.5 increments in half-bin mode', () => {
      const smallRect: Rect = { x: 1, y: 1, width: 1, depth: 1 };
      const result = calculateResizeRect(smallRect, 'e', { x: 1, y: 1 }, defaultDrawer, 0.5);
      expect(result.width).toBe(0.5);
    });
  });

  describe('bounds clamping', () => {
    it('clamps width to not exceed drawer', () => {
      const edgeRect: Rect = { x: 8, y: 2, width: 2, depth: 2 };
      const result = calculateResizeRect(edgeRect, 'e', { x: 15, y: 3 }, defaultDrawer);
      expect(result.x + result.width).toBe(defaultDrawer.width);
    });

    it('clamps depth to not exceed drawer', () => {
      const edgeRect: Rect = { x: 2, y: 6, width: 2, depth: 2 };
      const result = calculateResizeRect(edgeRect, 'n', { x: 3, y: 15 }, defaultDrawer);
      expect(result.y + result.depth).toBe(defaultDrawer.depth);
    });

    it('handles resize at origin corner', () => {
      const originRect: Rect = { x: 0, y: 0, width: 2, depth: 2 };
      const result = calculateResizeRect(originRect, 'sw', { x: -5, y: -5 }, defaultDrawer);
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
      expect(result.width).toBeGreaterThanOrEqual(1);
      expect(result.depth).toBeGreaterThanOrEqual(1);
    });

    it('handles resize at far corner', () => {
      const farRect: Rect = { x: 8, y: 6, width: 2, depth: 2 };
      const result = calculateResizeRect(farRect, 'ne', { x: 20, y: 20 }, defaultDrawer);
      expect(result.x + result.width).toBe(defaultDrawer.width);
      expect(result.y + result.depth).toBe(defaultDrawer.depth);
    });
  });

  describe('edge cases', () => {
    it('handles zero cursor movement', () => {
      const result = calculateResizeRect(startRect, 'e', { x: 4, y: 3 }, defaultDrawer);
      // Cursor at x=4, rect starts at x=2 with width 3, so right edge is at x=5
      // With cursor at x=4: width = max(1, 4 - 2 + 1) = 3
      expect(result).toEqual({ x: 2, y: 2, width: 3, depth: 2 });
    });

    it('handles fractional cursor positions', () => {
      const result = calculateResizeRect(startRect, 'e', { x: 5.5, y: 3 }, defaultDrawer);
      expect(result.width).toBe(4.5);
    });

    it('preserves unchanged dimensions', () => {
      const result = calculateResizeRect(startRect, 'e', { x: 6, y: 3 }, defaultDrawer);
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
        start: { x: 1, y: 2 },
        current: { x: 3, y: 4 },
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
        start: { x: 0, y: 0 },
        current: { x: 5, y: 5 },
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
        binIds: ['bin1', 'bin2'],
        startCoord: { x: 1, y: 1 },
        currentCoord: { x: 3, y: 2 },
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
        binIds: ['a', 'b', 'c'],
        startCoord: { x: 0, y: 0 },
        currentCoord: { x: 1, y: 1 },
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
        binIds: ['bin1'],
        handle: 'se' as ResizeHandle,
        startRects: new Map([['bin1', { x: 0, y: 0, width: 2, depth: 2 }]]),
        currentRects: new Map([['bin1', { x: 0, y: 0, width: 3, depth: 3 }]]),
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
          binIds: ['bin1'],
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
        binId: 'staging-bin',
        currentCoord: { x: 5, y: 5 },
        valid: true,
      };
      const result = mapInteractionToHint(interaction);
      expect(result).toEqual({ type: 'idle' });
    });

    it('returns idle even with null currentCoord', () => {
      const interaction: Interaction = {
        type: 'stagingDrag',
        binId: 'staging-bin',
        currentCoord: null,
        valid: false,
      };
      const result = mapInteractionToHint(interaction);
      expect(result).toEqual({ type: 'idle' });
    });
  });

  describe('unknown interaction type', () => {
    it('returns idle hint for unknown type (defensive fallback)', () => {
      // Force an unknown type to test the default case
      const interaction = {
        type: 'unknown_type',
      } as unknown as Interaction;
      const result = mapInteractionToHint(interaction);
      expect(result).toEqual({ type: 'idle' });
    });
  });
});

describe('capturePointer', () => {
  let mockSetPointerCapture: ReturnType<typeof vi.fn>;
  let originalSetPointerCapture: typeof document.body.setPointerCapture;

  beforeEach(() => {
    mockSetPointerCapture = vi.fn();
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

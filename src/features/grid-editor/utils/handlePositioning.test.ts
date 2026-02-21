import { describe, it, expect } from 'vitest';
import {
  isCornerHandle,
  shouldUseExternalHandles,
  getHandlePosition,
  getHandleVisual,
  getAllHandles,
} from './handlePositioning';
import type { ResizeHandle } from '@/core/types';

describe('handlePositioning', () => {
  describe('isCornerHandle', () => {
    it.each(['nw', 'ne', 'sw', 'se'] as ResizeHandle[])('returns true for %s', (handle) => {
      expect(isCornerHandle(handle)).toBe(true);
    });

    it.each(['n', 's', 'e', 'w'] as ResizeHandle[])('returns false for %s', (handle) => {
      expect(isCornerHandle(handle)).toBe(false);
    });
  });

  describe('shouldUseExternalHandles', () => {
    it('returns true when width <= 1', () => {
      expect(shouldUseExternalHandles(1, 3)).toBe(true);
      expect(shouldUseExternalHandles(0.5, 3)).toBe(true);
    });

    it('returns true when depth <= 1', () => {
      expect(shouldUseExternalHandles(3, 1)).toBe(true);
      expect(shouldUseExternalHandles(3, 0.5)).toBe(true);
    });

    it('returns false when both > 1', () => {
      expect(shouldUseExternalHandles(2, 2)).toBe(false);
      expect(shouldUseExternalHandles(3, 4)).toBe(false);
    });
  });

  describe('getHandlePosition', () => {
    it('returns correct cursor for each handle', () => {
      expect(getHandlePosition('e', 'internal').cursor).toBe('ew-resize');
      expect(getHandlePosition('w', 'internal').cursor).toBe('ew-resize');
      expect(getHandlePosition('n', 'internal').cursor).toBe('ns-resize');
      expect(getHandlePosition('s', 'internal').cursor).toBe('ns-resize');
      expect(getHandlePosition('nw', 'internal').cursor).toBe('nwse-resize');
      expect(getHandlePosition('se', 'internal').cursor).toBe('nwse-resize');
      expect(getHandlePosition('ne', 'internal').cursor).toBe('nesw-resize');
      expect(getHandlePosition('sw', 'internal').cursor).toBe('nesw-resize');
    });

    it('uses 44px touch targets', () => {
      const pos = getHandlePosition('n', 'internal');
      expect(pos.width).toBe(44);
      expect(pos.height).toBe(44);
    });

    it('internal placement centers on edge (-22px offset)', () => {
      const pos = getHandlePosition('n', 'internal');
      expect(pos.top).toBe(-22);
    });

    it('external placement places fully outside (-44px offset)', () => {
      const pos = getHandlePosition('n', 'external');
      expect(pos.top).toBe(-44);
    });

    it('edge handles center along the perpendicular axis', () => {
      const north = getHandlePosition('n', 'internal');
      expect(north.left).toBe('50%');
      expect(north.transform).toBe('translateX(-50%)');

      const east = getHandlePosition('e', 'internal');
      expect(east.top).toBe('50%');
      expect(east.transform).toBe('translateY(-50%)');
    });

    it('corner handles have no transform', () => {
      const nw = getHandlePosition('nw', 'internal');
      expect(nw.transform).toBeUndefined();
    });
  });

  describe('getHandleVisual', () => {
    it('returns fixed size for corner handles', () => {
      const visual = getHandleVisual('nw');
      expect(visual.width).toBe(14);
      expect(visual.height).toBe(14);
    });

    it('returns percentage width for horizontal edges (n/s)', () => {
      const visual = getHandleVisual('n');
      expect(visual.width).toBe('45%');
      expect(visual.height).toBe(12);
      expect(visual.minWidth).toBe(24);
    });

    it('returns percentage height for vertical edges (e/w)', () => {
      const visual = getHandleVisual('e');
      expect(visual.width).toBe(12);
      expect(visual.height).toBe('45%');
      expect(visual.minHeight).toBe(24);
    });
  });

  describe('getAllHandles', () => {
    it('returns all 8 handles', () => {
      const handles = getAllHandles();
      expect(handles).toHaveLength(8);
      expect(handles).toContain('n');
      expect(handles).toContain('s');
      expect(handles).toContain('e');
      expect(handles).toContain('w');
      expect(handles).toContain('nw');
      expect(handles).toContain('ne');
      expect(handles).toContain('sw');
      expect(handles).toContain('se');
    });
  });
});

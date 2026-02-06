import { describe, it, expect } from 'vitest';
import {
  RENDER_ORDER,
  MIN_ZOOM,
  MAX_ZOOM,
  ZOOM_STEP,
  FIT_PADDING,
  HANDLE_COLOR,
  HANDLE_STROKE_COLOR,
  CORNER_HANDLE_SIZE,
  EDGE_HANDLE_WIDTH,
  EDGE_HANDLE_HEIGHT,
  ROTATION_HANDLE_OFFSET_PX,
  ROTATION_HANDLE_RADIUS_PX,
  LARGE_BIN_THRESHOLD,
} from './constants';

describe('constants', () => {
  describe('RENDER_ORDER', () => {
    it('defines render order layers', () => {
      expect(RENDER_ORDER.BACKGROUND).toBe(0);
      expect(RENDER_ORDER.SHAPES).toBe(10);
      expect(RENDER_ORDER.GROUP_FILL).toBe(11);
      expect(RENDER_ORDER.GROUP_STROKE).toBe(12);
      expect(RENDER_ORDER.SMART_GUIDES).toBe(20);
      expect(RENDER_ORDER.DRAWING_PREVIEW).toBe(25);
      expect(RENDER_ORDER.GROUP_BOUNDS).toBe(30);
      expect(RENDER_ORDER.HANDLES).toBe(40);
      expect(RENDER_ORDER.ROTATION_HANDLE).toBe(41);
      expect(RENDER_ORDER.MARQUEE).toBe(50);
    });
  });

  describe('zoom constants', () => {
    it('defines MIN_ZOOM', () => {
      expect(MIN_ZOOM).toBe(0.5);
    });

    it('defines MAX_ZOOM', () => {
      expect(MAX_ZOOM).toBe(50);
    });

    it('defines ZOOM_STEP', () => {
      expect(ZOOM_STEP).toBe(1.25);
    });

    it('defines FIT_PADDING', () => {
      expect(FIT_PADDING).toBe(0.08);
    });
  });

  describe('color constants', () => {
    it('defines HANDLE_COLOR as amber', () => {
      expect(HANDLE_COLOR).toBe('#fbbf24');
    });

    it('defines HANDLE_STROKE_COLOR as white', () => {
      expect(HANDLE_STROKE_COLOR).toBe('#ffffff');
    });
  });

  describe('handle size constants', () => {
    it('defines CORNER_HANDLE_SIZE', () => {
      expect(CORNER_HANDLE_SIZE).toBe(10);
    });

    it('defines EDGE_HANDLE_WIDTH', () => {
      expect(EDGE_HANDLE_WIDTH).toBe(8);
    });

    it('defines EDGE_HANDLE_HEIGHT', () => {
      expect(EDGE_HANDLE_HEIGHT).toBe(4);
    });

    it('defines ROTATION_HANDLE_OFFSET_PX', () => {
      expect(ROTATION_HANDLE_OFFSET_PX).toBe(15);
    });

    it('defines ROTATION_HANDLE_RADIUS_PX', () => {
      expect(ROTATION_HANDLE_RADIUS_PX).toBe(4);
    });
  });

  describe('grid constants', () => {
    it('defines LARGE_BIN_THRESHOLD', () => {
      expect(LARGE_BIN_THRESHOLD).toBe(10000);
    });
  });
});

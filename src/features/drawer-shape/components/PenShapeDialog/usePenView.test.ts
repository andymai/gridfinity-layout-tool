import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { usePenView } from './usePenView';

const RECT = { left: 0, top: 0, width: 500, height: 500 } as DOMRect;

describe('usePenView', () => {
  // The frame is the union of the drawer rect and the sketch bbox, so a point
  // dragged past the grid stays inside the viewBox instead of being clipped.
  it('sizes the frame to the content, not the drawer', () => {
    const { result } = renderHook(() => usePenView(500, 336, 420, 336, 'session'));
    // Content 500 x 336, padded by VIEW_PAD_MM (14) on each side.
    expect(result.current.viewBox).toBe('0 0 528 364');
  });

  // The frame grows on every out-of-bounds drag; re-framing on that would snap
  // the view back mid-drag, so the reset is keyed to the drawer, not the frame.
  it('keeps the zoom when the content grows but the drawer does not', () => {
    const { result, rerender } = renderHook(
      ({ cw }: { cw: number }) => usePenView(cw, 336, 420, 336, 'session'),
      { initialProps: { cw: 420 } }
    );
    act(() => result.current.zoomAt(-100, 250, 250, RECT));
    expect(result.current.zoom).toBeGreaterThan(1);

    // A point dragged past the grid grows the content; the drawer is unchanged.
    rerender({ cw: 520 });
    expect(result.current.zoom).toBeGreaterThan(1);
  });

  it('re-frames to the default view when the drawer is resized', () => {
    const { result, rerender } = renderHook(
      ({ dw }: { dw: number }) => usePenView(dw, 336, dw, 336, 'session'),
      { initialProps: { dw: 420 } }
    );
    act(() => result.current.zoomAt(-100, 250, 250, RECT));
    expect(result.current.zoom).toBeGreaterThan(1);

    rerender({ dw: 504 });
    expect(result.current.zoom).toBe(1);
  });
});

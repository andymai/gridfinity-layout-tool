import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { useSlideTraySection } from './useSlideTraySection';

function setParams(over: Partial<typeof DEFAULT_BIN_PARAMS>): void {
  useDesignerStore.setState({
    params: { ...DEFAULT_BIN_PARAMS, width: 3, depth: 2, height: 6, ...over },
  });
}

beforeEach(() => setParams({}));

describe('useSlideTraySection', () => {
  it('offers the feature on an ordinary bin', () => {
    const { result } = renderHook(() => useSlideTraySection());
    expect(result.current.blockedReason).toBeUndefined();
  });

  it('explains a solid bin rather than letting the user enable nothing', () => {
    setParams({ base: { ...DEFAULT_BIN_PARAMS.base, solid: true } });
    const { result } = renderHook(() => useSlideTraySection());
    expect(result.current.blockedReason).toBeTruthy();
  });

  it('explains a slotted bin', () => {
    setParams({ style: 'slotted' });
    const { result } = renderHook(() => useSlideTraySection());
    expect(result.current.blockedReason).toBeTruthy();
  });

  it('explains a bin too short for the rail drop', () => {
    // The shipped default sinks the tray 21mm, which a 3u bin cannot give.
    // This is the case that used to produce nothing with no explanation.
    setParams({ height: 3 });
    const { result } = renderHook(() => useSlideTraySection());
    expect(result.current.blockedReason).toBeTruthy();
  });

  it('reports how far the tray stands proud of the rim', () => {
    // A tray sticking out of the top reads as a bug rather than a setting, so
    // the panel says so instead of leaving it to the 3D view.
    setParams({ slide: { ...DEFAULT_BIN_PARAMS.slide, enabled: true, railDropMm: 0 } });
    const { result } = renderHook(() => useSlideTraySection());
    expect(result.current.protrusionMm).not.toBeNull();
    expect(result.current.protrusionMm ?? 0).toBeGreaterThan(0);
  });

  it('reports no protrusion once the rail is dropped far enough', () => {
    setParams({ slide: { ...DEFAULT_BIN_PARAMS.slide, enabled: true } });
    const { result } = renderHook(() => useSlideTraySection());
    expect(result.current.protrusionMm).toBeNull();
  });

  it('toggles the feature and writes settings through', () => {
    const { result } = renderHook(() => useSlideTraySection());
    act(() => result.current.handlers.toggle());
    expect(useDesignerStore.getState().params.slide.enabled).toBe(true);
    act(() => result.current.handlers.setMount('rim'));
    expect(useDesignerStore.getState().params.slide.railMount).toBe('rim');
    act(() => result.current.handlers.setClearanceMm(0.35));
    expect(useDesignerStore.getState().params.slide.clearanceMm).toBe(0.35);
  });

  it('summarises only while enabled', () => {
    const { result, rerender } = renderHook(() => useSlideTraySection());
    expect(result.current.meta.summary).toBeUndefined();
    act(() => result.current.handlers.toggle());
    rerender();
    expect(result.current.meta.summary).toBeTruthy();
  });
});

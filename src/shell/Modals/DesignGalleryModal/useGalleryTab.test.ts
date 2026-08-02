// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGalleryTab } from './useGalleryTab';

const TAB_KEY = 'gridfinity-design-gallery-tab-v1';
const OPENED_KEY = 'gridfinity-design-gallery-community-opened-v1';

describe('useGalleryTab', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to the examples tab with the new dot shown', () => {
    const { result } = renderHook(() => useGalleryTab());
    expect(result.current.activeTab).toBe('examples');
    expect(result.current.showNewDot).toBe(true);
  });

  it('persists the last-used tab and restores it on the next mount', () => {
    const first = renderHook(() => useGalleryTab());
    act(() => first.result.current.setActiveTab('community'));
    expect(first.result.current.activeTab).toBe('community');
    expect(localStorage.getItem(TAB_KEY)).toBe('community');
    first.unmount();

    const second = renderHook(() => useGalleryTab());
    expect(second.result.current.activeTab).toBe('community');
  });

  it('hides the new dot forever once community has been opened', () => {
    const first = renderHook(() => useGalleryTab());
    act(() => first.result.current.setActiveTab('community'));
    expect(first.result.current.showNewDot).toBe(false);
    act(() => first.result.current.setActiveTab('examples'));
    expect(first.result.current.showNewDot).toBe(false);
    expect(localStorage.getItem(OPENED_KEY)).toBe('true');
    first.unmount();

    const second = renderHook(() => useGalleryTab());
    expect(second.result.current.activeTab).toBe('examples');
    expect(second.result.current.showNewDot).toBe(false);
  });

  it('ignores invalid stored values and falls back to examples', () => {
    localStorage.setItem(TAB_KEY, 'bogus');
    const { result } = renderHook(() => useGalleryTab());
    expect(result.current.activeTab).toBe('examples');
  });
});

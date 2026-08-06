// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  INITIAL_BIN_EXAMPLE_GALLERY_STATE,
  useBinExampleGalleryStore,
} from '@/core/store/binExampleGallery';
import { useGalleryTab } from './useGalleryTab';

const TAB_KEY = 'gridfinity-design-gallery-tab-v1';
const OPENED_KEY = 'gridfinity-design-gallery-community-opened-v1';

describe('useGalleryTab', () => {
  beforeEach(() => {
    localStorage.clear();
    useBinExampleGalleryStore.setState({ ...INITIAL_BIN_EXAMPLE_GALLERY_STATE });
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

  describe('a requested tab', () => {
    it('wins over the remembered one', () => {
      localStorage.setItem(TAB_KEY, 'examples');
      useBinExampleGalleryStore.getState().open('community');

      const { result } = renderHook(() => useGalleryTab());

      // An entry point that names Community has to land on Community, or it
      // reads as a broken link for anyone whose last tab was Examples.
      expect(result.current.activeTab).toBe('community');
    });

    it('counts as having opened community, so the new dot clears', () => {
      useBinExampleGalleryStore.getState().open('community');
      const { result } = renderHook(() => useGalleryTab());
      expect(result.current.showNewDot).toBe(false);
    });

    it('leaves the remembered tab alone when the opener names none', () => {
      localStorage.setItem(TAB_KEY, 'community');
      useBinExampleGalleryStore.getState().open();

      const { result } = renderHook(() => useGalleryTab());

      expect(result.current.activeTab).toBe('community');
    });

    it('is cleared on close, so the next open falls back to the remembered tab', () => {
      const store = useBinExampleGalleryStore.getState();
      store.open('community');
      store.close();
      localStorage.setItem(TAB_KEY, 'examples');

      const { result } = renderHook(() => useGalleryTab());

      expect(result.current.activeTab).toBe('examples');
    });
  });
});

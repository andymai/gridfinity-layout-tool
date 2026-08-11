import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createQuickstartFlag } from './quickstartFlag';

describe('createQuickstartFlag', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts unseen when nothing is stored', () => {
    const useFlag = createQuickstartFlag('flag-a');
    const { result } = renderHook(() => useFlag());

    expect(result.current.seen).toBe(false);
  });

  it('starts seen when the key was already set', () => {
    localStorage.setItem('flag-b', 'true');
    const useFlag = createQuickstartFlag('flag-b');
    const { result } = renderHook(() => useFlag());

    expect(result.current.seen).toBe(true);
  });

  it('persists and reflects being marked seen', () => {
    const useFlag = createQuickstartFlag('flag-c');
    const { result } = renderHook(() => useFlag());

    act(() => result.current.markSeen());

    expect(result.current.seen).toBe(true);
    expect(localStorage.getItem('flag-c')).toBe('true');
  });

  it('shares state across every instance of the same flag', () => {
    const useFlag = createQuickstartFlag('flag-d');
    const first = renderHook(() => useFlag());
    const second = renderHook(() => useFlag());

    act(() => first.result.current.markSeen());

    // Two overlays mounted at once must not disagree about whether the card
    // has been dismissed.
    expect(second.result.current.seen).toBe(true);
  });

  it('keeps separate flags independent', () => {
    const useCutout = createQuickstartFlag('flag-cutout');
    const useBento = createQuickstartFlag('flag-bento');
    const cutout = renderHook(() => useCutout());
    const bento = renderHook(() => useBento());

    act(() => cutout.result.current.markSeen());

    // Dismissing one workspace's card must not consume the other's only
    // chance to explain a different editor.
    expect(bento.result.current.seen).toBe(false);
  });
});

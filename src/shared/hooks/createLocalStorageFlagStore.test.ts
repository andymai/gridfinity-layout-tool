// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createLocalStorageFlagStore } from './createLocalStorageFlagStore';

describe('createLocalStorageFlagStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts unset when nothing is stored', () => {
    const store = createLocalStorageFlagStore({ seen: 'flag-a' });
    const { result } = renderHook(() => store.useFlags());

    expect(result.current.seen).toBe(false);
  });

  it('starts set when the key was already stored', () => {
    localStorage.setItem('flag-b', 'true');
    const store = createLocalStorageFlagStore({ seen: 'flag-b' });
    const { result } = renderHook(() => store.useFlags());

    expect(result.current.seen).toBe(true);
  });

  it('persists and reflects setFlag', () => {
    const store = createLocalStorageFlagStore({ seen: 'flag-c' });
    const { result } = renderHook(() => store.useFlags());

    act(() => store.setFlag('seen'));

    expect(result.current.seen).toBe(true);
    expect(localStorage.getItem('flag-c')).toBe('true');
  });

  it('shares state across every instance of the same store', () => {
    const store = createLocalStorageFlagStore({ seen: 'flag-d' });
    const first = renderHook(() => store.useFlags());
    const second = renderHook(() => store.useFlags());

    act(() => store.setFlag('seen'));

    // Two overlays mounted at once must not disagree about whether the card
    // has been dismissed.
    expect(first.result.current.seen).toBe(true);
    expect(second.result.current.seen).toBe(true);
  });

  it('keeps separate stores independent', () => {
    const cutout = createLocalStorageFlagStore({ seen: 'flag-cutout' });
    const bento = createLocalStorageFlagStore({ seen: 'flag-bento' });
    const cutoutHook = renderHook(() => cutout.useFlags());
    const bentoHook = renderHook(() => bento.useFlags());

    act(() => cutout.setFlag('seen'));

    // Dismissing one workspace's card must not consume the other's only
    // chance to explain a different editor.
    expect(cutoutHook.result.current.seen).toBe(true);
    expect(bentoHook.result.current.seen).toBe(false);
  });

  it('tracks multiple flags in one store independently', () => {
    const store = createLocalStorageFlagStore({ a: 'flag-multi-a', b: 'flag-multi-b' });
    const { result } = renderHook(() => store.useFlags());

    act(() => store.setFlag('a'));

    expect(result.current.a).toBe(true);
    expect(result.current.b).toBe(false);
  });

  it('reset clears every flag and its storage key', () => {
    const store = createLocalStorageFlagStore({ a: 'flag-reset-a', b: 'flag-reset-b' });
    const { result } = renderHook(() => store.useFlags());
    act(() => {
      store.setFlag('a');
      store.setFlag('b');
    });

    act(() => store.reset());

    expect(result.current.a).toBe(false);
    expect(result.current.b).toBe(false);
    expect(localStorage.getItem('flag-reset-a')).toBeNull();
  });

  it('sync picks up direct writes to localStorage', () => {
    const store = createLocalStorageFlagStore({ seen: 'flag-sync' });
    const { result } = renderHook(() => store.useFlags());

    localStorage.setItem('flag-sync', 'true');
    expect(result.current.seen).toBe(false);
    act(() => store.sync());

    expect(result.current.seen).toBe(true);
  });

  it('get() reads current flags outside React', () => {
    const store = createLocalStorageFlagStore({ seen: 'flag-get' });
    expect(store.get().seen).toBe(false);
    store.setFlag('seen');
    expect(store.get().seen).toBe(true);
  });
});

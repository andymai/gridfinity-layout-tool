// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useLayoutStore } from '@/core/store';
import { layoutId } from '@/core/types';
import type { LayoutId } from '@/core/types';
import { resetAllStores } from '@/test/testUtils';

const focusBin = vi.fn<(layout: LayoutId, bin: string) => Promise<void>>(() => Promise.resolve());
vi.mock('./useFocusBin', () => ({ useFocusBin: () => focusBin }));

let placesOn = true;
vi.mock('@/shared/hooks/useFeatureFlag', () => ({ useFeatureFlag: () => placesOn }));

import { useBinDeepLink } from './useBinDeepLink';

const LAYOUT = 'abcdefghijkl';

function openUrl(url: string): void {
  window.history.replaceState(null, '', url);
}

function activate(id: string): void {
  act(() => {
    useLayoutStore.setState({ activeLayoutId: layoutId(id) });
  });
}

beforeEach(() => {
  resetAllStores();
  focusBin.mockClear();
  placesOn = true;
});

afterEach(() => {
  openUrl('/');
});

describe('useBinDeepLink', () => {
  it('focuses the bin once routing makes its layout active, then drops the parameter', () => {
    openUrl(`/l/${LAYOUT}/kitchen?bin=b1`);
    renderHook(() => useBinDeepLink(true));
    expect(focusBin).not.toHaveBeenCalled();

    activate(LAYOUT);

    expect(focusBin).toHaveBeenCalledWith(LAYOUT, 'b1');
    expect(window.location.search).toBe('');
    expect(window.location.pathname).toBe(`/l/${LAYOUT}/kitchen`);
  });

  it('keeps the link from the first render after the slug redirect rewrites the URL', () => {
    openUrl(`/l/${LAYOUT}/old-name?bin=b1`);
    renderHook(() => useBinDeepLink(true));
    openUrl(`/l/${LAYOUT}/kitchen`);

    activate(LAYOUT);

    expect(focusBin).toHaveBeenCalledWith(LAYOUT, 'b1');
  });

  it('focuses only once, however often the active layout changes after', () => {
    openUrl(`/l/${LAYOUT}/kitchen?bin=b1`);
    renderHook(() => useBinDeepLink(true));
    activate(LAYOUT);
    activate('mnopqrstuvwx');
    activate(LAYOUT);

    expect(focusBin).toHaveBeenCalledOnce();
  });

  it('does nothing for another layout, without the places flag, or off the planner', () => {
    openUrl(`/l/${LAYOUT}/kitchen?bin=b1`);
    const other = renderHook(() => useBinDeepLink(true));
    activate('mnopqrstuvwx');
    other.unmount();

    placesOn = false;
    const flagOff = renderHook(() => useBinDeepLink(true));
    activate(LAYOUT);
    flagOff.unmount();

    placesOn = true;
    renderHook(() => useBinDeepLink(false));
    activate(LAYOUT);

    expect(focusBin).not.toHaveBeenCalled();
    expect(window.location.search).toBe('?bin=b1');
  });
});

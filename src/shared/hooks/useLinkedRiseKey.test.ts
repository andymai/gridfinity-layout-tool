import { describe, it, expect, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useLayoutStore } from '@/core/store/layout';
import { mm } from '@/core/types';
import { resetAllStores } from '@/test/testUtils';
import { notifyLinkedExcessChanged, registerLinkedExcessResolver } from '@/shared/utils/collision';
import { useLinkedRiseKey } from './useLinkedRiseKey';

describe('useLinkedRiseKey', () => {
  afterEach(() => {
    registerLinkedExcessResolver(null);
    resetAllStores();
  });

  it('changes when the registrant reports a design re-save', () => {
    let tick = 0;
    registerLinkedExcessResolver(
      () => 0,
      () => tick
    );
    const { result } = renderHook(() => useLinkedRiseKey());
    const first = result.current;
    act(() => {
      tick += 1;
      notifyLinkedExcessChanged();
    });
    expect(result.current).not.toBe(first);
  });

  it('changes when a layout field the rise depends on changes', () => {
    registerLinkedExcessResolver(
      () => 0,
      () => useLayoutStore.getState().layout.heightUnitMm
    );
    const { result } = renderHook(() => useLinkedRiseKey());
    const first = result.current;
    act(() => {
      const { layout } = useLayoutStore.getState();
      useLayoutStore.setState({ layout: { ...layout, heightUnitMm: mm(8) } });
    });
    expect(result.current).not.toBe(first);
  });
});

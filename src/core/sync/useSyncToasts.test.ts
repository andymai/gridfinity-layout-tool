// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { EngineEvent } from './engine';
import { useToastStore } from '@/core/store';
import { useSyncStatusStore } from './status';
import { useSyncToasts } from './useSyncToasts';

const onEngineEventListeners = new Set<(e: EngineEvent) => void>();
const offMock = vi.fn();

vi.mock('./engine', () => ({
  onEngineEvent: (cb: (e: EngineEvent) => void) => {
    onEngineEventListeners.add(cb);
    return () => {
      onEngineEventListeners.delete(cb);
      offMock();
    };
  },
}));

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

function emitEngineEvent(event: EngineEvent): void {
  for (const cb of onEngineEventListeners) cb(event);
}

beforeEach(() => {
  onEngineEventListeners.clear();
  useToastStore.setState({ toasts: [] });
  useSyncStatusStore.getState().reset();
  offMock.mockReset();
});

describe('useSyncToasts: engine events', () => {
  it('shows the conflict toast on remote-replaced-local', () => {
    renderHook(() => useSyncToasts());
    act(() => emitEngineEvent({ type: 'remote-replaced-local', kind: 'layouts', id: 'lay-1' }));
    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0].message).toBe('sync.conflictPulled');
    expect(toasts[0].type).toBe('info');
  });

  it('shows the deleted-elsewhere toast on sync-error reason=deleted-elsewhere', () => {
    renderHook(() => useSyncToasts());
    act(() =>
      emitEngineEvent({
        type: 'sync-error',
        reason: 'deleted-elsewhere',
        kind: 'layouts',
        id: 'lay-1',
      })
    );
    expect(useToastStore.getState().toasts[0].message).toBe('sync.deletedElsewhere');
  });

  it('shows the quota toast on sync-error reason=quota', () => {
    renderHook(() => useSyncToasts());
    act(() =>
      emitEngineEvent({ type: 'sync-error', reason: 'quota', kind: 'layouts', id: 'lay-1' })
    );
    expect(useToastStore.getState().toasts[0].message).toBe('sync.quotaExceeded');
    expect(useToastStore.getState().toasts[0].type).toBe('error');
  });

  it('shows the push-failed toast on sync-error reason=gave-up', () => {
    renderHook(() => useSyncToasts());
    act(() =>
      emitEngineEvent({ type: 'sync-error', reason: 'gave-up', kind: 'layouts', id: 'lay-1' })
    );
    expect(useToastStore.getState().toasts[0].message).toBe('sync.pushFailed');
  });
});

describe('useSyncToasts: offline transition', () => {
  it('shows offline toast when status flips from idle → offline', () => {
    renderHook(() => useSyncToasts());
    act(() => useSyncStatusStore.getState().reportOffline());
    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0].message).toBe('sync.workingOffline');
  });

  it('does not fire while staying in offline state', () => {
    renderHook(() => useSyncToasts());
    act(() => useSyncStatusStore.getState().reportOffline());
    act(() => useSyncStatusStore.getState().reportOffline());
    expect(useToastStore.getState().toasts).toHaveLength(1);
  });

  it('debounces consecutive offline transitions within 4s', () => {
    renderHook(() => useSyncToasts());
    act(() => useSyncStatusStore.getState().reportOffline());
    act(() => useSyncStatusStore.getState().succeed());
    act(() => useSyncStatusStore.getState().reportOffline());
    expect(useToastStore.getState().toasts).toHaveLength(1);
  });
});

describe('useSyncToasts: cleanup', () => {
  it('unsubscribes from engine events on unmount', () => {
    const { unmount } = renderHook(() => useSyncToasts());
    unmount();
    expect(offMock).toHaveBeenCalled();
  });
});

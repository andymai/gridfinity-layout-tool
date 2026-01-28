import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useUnsavedWarning } from '../../hooks/useUnsavedWarning';
import { useDesignerStore } from '../../store/designer';
import { DEFAULT_BIN_PARAMS } from '../../constants/defaults';

describe('useUnsavedWarning', () => {
  let addSpy: ReturnType<typeof vi.spyOn>;
  let removeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    addSpy = vi.spyOn(window, 'addEventListener');
    removeSpy = vi.spyOn(window, 'removeEventListener');

    // Reset to clean state
    useDesignerStore.setState({
      currentDesignId: null,
      params: { ...DEFAULT_BIN_PARAMS },
      history: { past: [], future: [] },
    });
  });

  it('should not register listener when no unsaved changes', () => {
    renderHook(() => useUnsavedWarning());

    const beforeunloadCalls = addSpy.mock.calls.filter(
      ([event]) => event === 'beforeunload'
    );
    expect(beforeunloadCalls).toHaveLength(0);
  });

  it('should not register listener when design is saved (has ID)', () => {
    useDesignerStore.setState({
      currentDesignId: 'saved-id',
      history: { past: [{ params: DEFAULT_BIN_PARAMS }], future: [] },
    });

    renderHook(() => useUnsavedWarning());

    const beforeunloadCalls = addSpy.mock.calls.filter(
      ([event]) => event === 'beforeunload'
    );
    expect(beforeunloadCalls).toHaveLength(0);
  });

  it('should register listener when untitled design has history', () => {
    useDesignerStore.setState({
      currentDesignId: null,
      history: { past: [{ params: DEFAULT_BIN_PARAMS }], future: [] },
    });

    renderHook(() => useUnsavedWarning());

    const beforeunloadCalls = addSpy.mock.calls.filter(
      ([event]) => event === 'beforeunload'
    );
    expect(beforeunloadCalls).toHaveLength(1);
  });

  it('should remove listener on unmount', () => {
    useDesignerStore.setState({
      currentDesignId: null,
      history: { past: [{ params: DEFAULT_BIN_PARAMS }], future: [] },
    });

    const { unmount } = renderHook(() => useUnsavedWarning());
    unmount();

    const removeCalls = removeSpy.mock.calls.filter(
      ([event]) => event === 'beforeunload'
    );
    expect(removeCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('should call preventDefault on beforeunload event', () => {
    useDesignerStore.setState({
      currentDesignId: null,
      history: { past: [{ params: DEFAULT_BIN_PARAMS }], future: [] },
    });

    renderHook(() => useUnsavedWarning());

    const handler = addSpy.mock.calls.find(
      ([event]) => event === 'beforeunload'
    )?.[1] as EventListener;

    const event = new Event('beforeunload') as BeforeUnloadEvent;
    const preventSpy = vi.spyOn(event, 'preventDefault');

    handler(event);

    expect(preventSpy).toHaveBeenCalled();
  });
});

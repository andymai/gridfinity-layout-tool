import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDesignerRouting } from '../../hooks/useDesignerRouting';

describe('useDesignerRouting', () => {
  let originalPathname: string;

  beforeEach(() => {
    originalPathname = window.location.pathname;
    // Reset to root
    window.history.replaceState(null, '', '/');
  });

  afterEach(() => {
    window.history.replaceState(null, '', originalPathname);
  });

  it('detects root path as not designer route', () => {
    const { result } = renderHook(() => useDesignerRouting());
    expect(result.current.isDesignerRoute).toBe(false);
  });

  it('detects /designer as designer route', () => {
    window.history.replaceState(null, '', '/designer');
    const { result } = renderHook(() => useDesignerRouting());
    expect(result.current.isDesignerRoute).toBe(true);
  });

  it('detects /designer/ (trailing slash) as designer route', () => {
    window.history.replaceState(null, '', '/designer/');
    const { result } = renderHook(() => useDesignerRouting());
    expect(result.current.isDesignerRoute).toBe(true);
  });

  it('navigateToDesigner updates route to /designer', () => {
    const { result } = renderHook(() => useDesignerRouting());
    expect(result.current.isDesignerRoute).toBe(false);

    act(() => {
      result.current.navigateToDesigner();
    });

    expect(result.current.isDesignerRoute).toBe(true);
    expect(window.location.pathname).toBe('/designer');
  });

  it('navigateToPlanner updates route to /', () => {
    window.history.replaceState(null, '', '/designer');
    const { result } = renderHook(() => useDesignerRouting());
    expect(result.current.isDesignerRoute).toBe(true);

    act(() => {
      result.current.navigateToPlanner();
    });

    expect(result.current.isDesignerRoute).toBe(false);
    expect(window.location.pathname).toBe('/');
  });

  it('dispatches popstate event so other hook instances react', () => {
    const popstateListener = vi.fn();
    window.addEventListener('popstate', popstateListener);

    const { result } = renderHook(() => useDesignerRouting());

    act(() => {
      result.current.navigateToDesigner();
    });

    expect(popstateListener).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.navigateToPlanner();
    });

    expect(popstateListener).toHaveBeenCalledTimes(2);

    window.removeEventListener('popstate', popstateListener);
  });

  it('multiple hook instances stay in sync', () => {
    // Simulate App.tsx and Sidebar both using the hook
    const { result: appResult } = renderHook(() => useDesignerRouting());
    const { result: sidebarResult } = renderHook(() => useDesignerRouting());

    expect(appResult.current.isDesignerRoute).toBe(false);
    expect(sidebarResult.current.isDesignerRoute).toBe(false);

    // Sidebar navigates to designer
    act(() => {
      sidebarResult.current.navigateToDesigner();
    });

    // Both instances should be in sync
    expect(sidebarResult.current.isDesignerRoute).toBe(true);
    expect(appResult.current.isDesignerRoute).toBe(true);

    // App navigates back to planner
    act(() => {
      appResult.current.navigateToPlanner();
    });

    expect(appResult.current.isDesignerRoute).toBe(false);
    expect(sidebarResult.current.isDesignerRoute).toBe(false);
  });

  it('responds to browser back/forward (popstate events)', () => {
    const { result } = renderHook(() => useDesignerRouting());

    // Navigate forward
    act(() => {
      result.current.navigateToDesigner();
    });
    expect(result.current.isDesignerRoute).toBe(true);

    // Simulate browser back button
    act(() => {
      window.history.replaceState(null, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(result.current.isDesignerRoute).toBe(false);
  });
});

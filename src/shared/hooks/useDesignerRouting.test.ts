import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDesignerRouting } from '@/shared/hooks/useDesignerRouting';

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

  describe('design ID URL params', () => {
    it('parses designIdFromUrl on mount when ?id= is present', () => {
      window.history.replaceState(null, '', '/designer?id=abc123');
      const { result } = renderHook(() => useDesignerRouting());
      expect(result.current.isDesignerRoute).toBe(true);
      expect(result.current.designIdFromUrl).toBe('abc123');
    });

    it('returns null designIdFromUrl when no ?id= param', () => {
      window.history.replaceState(null, '', '/designer');
      const { result } = renderHook(() => useDesignerRouting());
      expect(result.current.isDesignerRoute).toBe(true);
      expect(result.current.designIdFromUrl).toBeNull();
    });

    it('returns null designIdFromUrl when not on designer route', () => {
      window.history.replaceState(null, '', '/?id=abc123');
      const { result } = renderHook(() => useDesignerRouting());
      expect(result.current.isDesignerRoute).toBe(false);
      expect(result.current.designIdFromUrl).toBeNull();
    });

    it('navigateToDesign pushes history with ?id= param', () => {
      window.history.replaceState(null, '', '/designer');
      const { result } = renderHook(() => useDesignerRouting());

      act(() => {
        result.current.navigateToDesign('design-001');
      });

      expect(result.current.isDesignerRoute).toBe(true);
      expect(result.current.designIdFromUrl).toBe('design-001');
      expect(window.location.pathname).toBe('/designer');
      expect(window.location.search).toBe('?id=design-001');
    });

    it('navigateToDesign encodes special characters in ID', () => {
      window.history.replaceState(null, '', '/designer');
      const { result } = renderHook(() => useDesignerRouting());

      act(() => {
        result.current.navigateToDesign('design with spaces & symbols');
      });

      expect(result.current.designIdFromUrl).toBe('design with spaces & symbols');
      // URL should be encoded
      expect(window.location.search).toContain('id=design%20with%20spaces');
    });

    it('navigateToDesign dispatches popstate for multi-instance sync', () => {
      window.history.replaceState(null, '', '/designer');
      const popstateListener = vi.fn();
      window.addEventListener('popstate', popstateListener);

      const { result } = renderHook(() => useDesignerRouting());

      act(() => {
        result.current.navigateToDesign('test-id');
      });

      expect(popstateListener).toHaveBeenCalledTimes(1);
      window.removeEventListener('popstate', popstateListener);
    });

    it('syncUrlToDesign updates URL without creating history entry', () => {
      window.history.replaceState(null, '', '/designer');
      const { result } = renderHook(() => useDesignerRouting());
      const historyLength = window.history.length;

      act(() => {
        result.current.syncUrlToDesign('auto-saved-id');
      });

      expect(result.current.designIdFromUrl).toBe('auto-saved-id');
      expect(window.location.search).toBe('?id=auto-saved-id');
      // replaceState doesn't add to history
      expect(window.history.length).toBe(historyLength);
    });

    it('syncUrlToDesign with null clears the ?id= param', () => {
      window.history.replaceState(null, '', '/designer?id=old-id');
      const { result } = renderHook(() => useDesignerRouting());
      expect(result.current.designIdFromUrl).toBe('old-id');

      act(() => {
        result.current.syncUrlToDesign(null);
      });

      expect(result.current.designIdFromUrl).toBeNull();
      expect(window.location.search).toBe('');
      expect(window.location.pathname).toBe('/designer');
    });

    it('syncUrlToDesign does nothing when not on designer route', () => {
      window.history.replaceState(null, '', '/');
      const { result } = renderHook(() => useDesignerRouting());

      act(() => {
        result.current.syncUrlToDesign('should-not-apply');
      });

      expect(result.current.designIdFromUrl).toBeNull();
      expect(window.location.search).toBe('');
    });

    it('navigateToDesigner clears designIdFromUrl', () => {
      window.history.replaceState(null, '', '/designer?id=old-design');
      const { result } = renderHook(() => useDesignerRouting());
      expect(result.current.designIdFromUrl).toBe('old-design');

      act(() => {
        result.current.navigateToDesigner();
      });

      expect(result.current.designIdFromUrl).toBeNull();
      expect(window.location.search).toBe('');
    });

    it('navigateToPlanner clears designIdFromUrl', () => {
      window.history.replaceState(null, '', '/designer?id=my-design');
      const { result } = renderHook(() => useDesignerRouting());

      act(() => {
        result.current.navigateToPlanner();
      });

      expect(result.current.designIdFromUrl).toBeNull();
    });

    it('popstate updates designIdFromUrl when URL changes', () => {
      window.history.replaceState(null, '', '/designer');
      const { result } = renderHook(() => useDesignerRouting());
      expect(result.current.designIdFromUrl).toBeNull();

      // Simulate browser navigation to a design URL
      act(() => {
        window.history.replaceState(null, '', '/designer?id=back-nav-id');
        window.dispatchEvent(new PopStateEvent('popstate'));
      });

      expect(result.current.designIdFromUrl).toBe('back-nav-id');
    });

    it('multiple instances sync designIdFromUrl on navigateToDesign', () => {
      window.history.replaceState(null, '', '/designer');
      const { result: hook1 } = renderHook(() => useDesignerRouting());
      const { result: hook2 } = renderHook(() => useDesignerRouting());

      act(() => {
        hook1.current.navigateToDesign('shared-design');
      });

      expect(hook1.current.designIdFromUrl).toBe('shared-design');
      expect(hook2.current.designIdFromUrl).toBe('shared-design');
    });
  });
});

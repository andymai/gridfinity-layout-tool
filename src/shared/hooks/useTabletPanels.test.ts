import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTabletPanels } from '@/shared/hooks/useTabletPanels';
import type { TabletPanelsState } from '@/shared/hooks/useTabletPanels';

// Mock state that persists across hook calls
let mockLeftPanelCollapsed = false;
let mockRightPanelCollapsed = false;

// Mock the view store with proper Zustand-like behavior
vi.mock('@/core/store/view', () => {
  return {
    useViewStore: vi.fn((selector) => {
      const state = {
        leftPanelCollapsed: mockLeftPanelCollapsed,
        rightPanelCollapsed: mockRightPanelCollapsed,
        toggleLeftPanel: () => {
          mockLeftPanelCollapsed = !mockLeftPanelCollapsed;
        },
        toggleRightPanel: () => {
          mockRightPanelCollapsed = !mockRightPanelCollapsed;
        },
      };

      return selector(state);
    }),
    INITIAL_VIEW_STATE: {},
  };
});

describe('useTabletPanels', () => {
  beforeEach(() => {
    // Reset mock state before each test
    mockLeftPanelCollapsed = false;
    mockRightPanelCollapsed = false;
  });

  describe('panel state when not tablet', () => {
    it('returns leftPanelOpen as false even when panel is not collapsed', () => {
      // Panel is open (not collapsed)
      mockLeftPanelCollapsed = false;
      mockRightPanelCollapsed = false;

      const { result } = renderHook(() => useTabletPanels(false));

      expect(result.current.leftPanelOpen).toBe(false);
    });

    it('returns rightPanelOpen as false even when panel is not collapsed', () => {
      // Panel is open (not collapsed)
      mockLeftPanelCollapsed = false;
      mockRightPanelCollapsed = false;

      const { result } = renderHook(() => useTabletPanels(false));

      expect(result.current.rightPanelOpen).toBe(false);
    });

    it('returns both panels as false when not tablet', () => {
      const { result } = renderHook(() => useTabletPanels(false));

      expect(result.current.leftPanelOpen).toBe(false);
      expect(result.current.rightPanelOpen).toBe(false);
    });
  });

  describe('panel state when tablet', () => {
    it('returns leftPanelOpen as true when tablet and not collapsed', () => {
      // Panel is open (not collapsed)
      mockLeftPanelCollapsed = false;
      mockRightPanelCollapsed = false;

      const { result } = renderHook(() => useTabletPanels(true));

      expect(result.current.leftPanelOpen).toBe(true);
    });

    it('returns leftPanelOpen as false when tablet and collapsed', () => {
      // Panel is closed (collapsed)
      mockLeftPanelCollapsed = true;
      mockRightPanelCollapsed = false;

      const { result } = renderHook(() => useTabletPanels(true));

      expect(result.current.leftPanelOpen).toBe(false);
    });

    it('returns rightPanelOpen as true when tablet and not collapsed', () => {
      // Panel is open (not collapsed)
      mockLeftPanelCollapsed = false;
      mockRightPanelCollapsed = false;

      const { result } = renderHook(() => useTabletPanels(true));

      expect(result.current.rightPanelOpen).toBe(true);
    });

    it('returns rightPanelOpen as false when tablet and collapsed', () => {
      // Panel is closed (collapsed)
      mockLeftPanelCollapsed = false;
      mockRightPanelCollapsed = true;

      const { result } = renderHook(() => useTabletPanels(true));

      expect(result.current.rightPanelOpen).toBe(false);
    });

    it('reflects inverted collapsed state for both panels', () => {
      // Left collapsed, right open
      mockLeftPanelCollapsed = true;
      mockRightPanelCollapsed = false;

      const { result } = renderHook(() => useTabletPanels(true));

      expect(result.current.leftPanelOpen).toBe(false);
      expect(result.current.rightPanelOpen).toBe(true);
    });
  });

  describe('openLeftPanel', () => {
    it('toggles left panel when collapsed', () => {
      // Start with left panel collapsed
      mockLeftPanelCollapsed = true;
      mockRightPanelCollapsed = false;

      const { result, rerender } = renderHook(() => useTabletPanels(true));

      expect(result.current.leftPanelOpen).toBe(false);

      act(() => {
        result.current.openLeftPanel();
      });

      // Need to rerender to see state changes
      rerender();

      expect(result.current.leftPanelOpen).toBe(true);
    });

    it('does not toggle when already open', () => {
      // Boot collapsed (the mount effect's steady state), then user opens
      mockLeftPanelCollapsed = true;
      mockRightPanelCollapsed = true;

      const { result, rerender } = renderHook(() => useTabletPanels(true));

      act(() => {
        result.current.openLeftPanel();
      });
      rerender();
      expect(result.current.leftPanelOpen).toBe(true);

      act(() => {
        result.current.openLeftPanel();
      });
      rerender();

      expect(result.current.leftPanelOpen).toBe(true);
    });
  });

  describe('closeLeftPanel', () => {
    it('toggles left panel when not collapsed', () => {
      mockLeftPanelCollapsed = true;
      mockRightPanelCollapsed = true;

      const { result, rerender } = renderHook(() => useTabletPanels(true));

      act(() => {
        result.current.openLeftPanel();
      });
      rerender();
      expect(result.current.leftPanelOpen).toBe(true);

      act(() => {
        result.current.closeLeftPanel();
      });
      rerender();

      expect(result.current.leftPanelOpen).toBe(false);
    });

    it('does not toggle when already closed', () => {
      // Start with left panel closed (collapsed)
      mockLeftPanelCollapsed = true;
      mockRightPanelCollapsed = false;

      const { result, rerender } = renderHook(() => useTabletPanels(true));

      expect(result.current.leftPanelOpen).toBe(false);

      act(() => {
        result.current.closeLeftPanel();
      });

      rerender();

      expect(result.current.leftPanelOpen).toBe(false);
    });
  });

  describe('openRightPanel', () => {
    it('toggles right panel when collapsed', () => {
      // Start with right panel collapsed
      mockLeftPanelCollapsed = false;
      mockRightPanelCollapsed = true;

      const { result, rerender } = renderHook(() => useTabletPanels(true));

      expect(result.current.rightPanelOpen).toBe(false);

      act(() => {
        result.current.openRightPanel();
      });

      rerender();

      expect(result.current.rightPanelOpen).toBe(true);
    });

    it('does not toggle when already open', () => {
      // Boot collapsed (the mount effect's steady state), then user opens
      mockLeftPanelCollapsed = true;
      mockRightPanelCollapsed = true;

      const { result, rerender } = renderHook(() => useTabletPanels(true));

      act(() => {
        result.current.openRightPanel();
      });
      rerender();
      expect(result.current.rightPanelOpen).toBe(true);

      act(() => {
        result.current.openRightPanel();
      });
      rerender();

      expect(result.current.rightPanelOpen).toBe(true);
    });
  });

  describe('closeRightPanel', () => {
    it('toggles right panel when not collapsed', () => {
      mockLeftPanelCollapsed = true;
      mockRightPanelCollapsed = true;

      const { result, rerender } = renderHook(() => useTabletPanels(true));

      act(() => {
        result.current.openRightPanel();
      });
      rerender();
      expect(result.current.rightPanelOpen).toBe(true);

      act(() => {
        result.current.closeRightPanel();
      });
      rerender();

      expect(result.current.rightPanelOpen).toBe(false);
    });

    it('does not toggle when already closed', () => {
      // Start with right panel closed (collapsed)
      mockLeftPanelCollapsed = false;
      mockRightPanelCollapsed = true;

      const { result, rerender } = renderHook(() => useTabletPanels(true));

      expect(result.current.rightPanelOpen).toBe(false);

      act(() => {
        result.current.closeRightPanel();
      });

      rerender();

      expect(result.current.rightPanelOpen).toBe(false);
    });
  });

  describe('auto-collapse on tablet entry', () => {
    it('collapses both panels when entering tablet mode from desktop', () => {
      // Start with both panels open on desktop
      mockLeftPanelCollapsed = false;
      mockRightPanelCollapsed = false;

      const { result, rerender } = renderHook(
        (props: { isTablet: boolean }) => useTabletPanels(props.isTablet),
        {
          initialProps: { isTablet: false },
        }
      );

      // On desktop, panels are false regardless of collapsed state
      expect(result.current.leftPanelOpen).toBe(false);
      expect(result.current.rightPanelOpen).toBe(false);

      // Transition to tablet
      act(() => {
        rerender({ isTablet: true });
      });

      // The toggles were called, so check the mock state
      expect(mockLeftPanelCollapsed).toBe(true);
      expect(mockRightPanelCollapsed).toBe(true);

      // After rerendering again, panels should show as collapsed
      rerender({ isTablet: true });

      // Both panels should now be collapsed (leftPanelOpen and rightPanelOpen are false)
      expect(result.current.leftPanelOpen).toBe(false);
      expect(result.current.rightPanelOpen).toBe(false);
    });

    it('collapses only left panel if it was open when entering tablet', () => {
      // Start with left panel open, right panel closed
      mockLeftPanelCollapsed = false;
      mockRightPanelCollapsed = true;

      const { result, rerender } = renderHook(
        (props: { isTablet: boolean }) => useTabletPanels(props.isTablet),
        {
          initialProps: { isTablet: false },
        }
      );

      // Transition to tablet
      act(() => {
        rerender({ isTablet: true });
      });

      // The left toggle was called, check the mock state
      expect(mockLeftPanelCollapsed).toBe(true);
      expect(mockRightPanelCollapsed).toBe(true); // stays collapsed

      // Rerender again to see updated state
      rerender({ isTablet: true });

      // Left panel should be collapsed, right panel remains collapsed
      expect(result.current.leftPanelOpen).toBe(false);
      expect(result.current.rightPanelOpen).toBe(false);
    });

    it('collapses only right panel if it was open when entering tablet', () => {
      // Start with left panel closed, right panel open
      mockLeftPanelCollapsed = true;
      mockRightPanelCollapsed = false;

      const { result, rerender } = renderHook(
        (props: { isTablet: boolean }) => useTabletPanels(props.isTablet),
        {
          initialProps: { isTablet: false },
        }
      );

      // Transition to tablet
      act(() => {
        rerender({ isTablet: true });
      });

      // The right toggle was called, check the mock state
      expect(mockLeftPanelCollapsed).toBe(true); // stays collapsed
      expect(mockRightPanelCollapsed).toBe(true);

      // Rerender again to see updated state
      rerender({ isTablet: true });

      // Both should be collapsed
      expect(result.current.leftPanelOpen).toBe(false);
      expect(result.current.rightPanelOpen).toBe(false);
    });

    it('does not toggle panels if they were already collapsed', () => {
      // Start with both panels already collapsed
      mockLeftPanelCollapsed = true;
      mockRightPanelCollapsed = true;

      const { result, rerender } = renderHook(
        (props: { isTablet: boolean }) => useTabletPanels(props.isTablet),
        {
          initialProps: { isTablet: false },
        }
      );

      // Transition to tablet
      rerender({ isTablet: true });

      // Panels should remain collapsed
      expect(result.current.leftPanelOpen).toBe(false);
      expect(result.current.rightPanelOpen).toBe(false);
    });
  });

  describe('auto-collapse when mounting at tablet width', () => {
    it('collapses both panels when the page boots directly at tablet width', () => {
      // Panels open (desktop default persisted in the store)
      mockLeftPanelCollapsed = false;
      mockRightPanelCollapsed = false;

      const { result, rerender } = renderHook(() => useTabletPanels(true));

      // Mount effect collapses; re-render to observe the mocked store
      rerender();

      expect(result.current.leftPanelOpen).toBe(false);
      expect(result.current.rightPanelOpen).toBe(false);
    });

    it('does not re-collapse after the user reopens a panel while staying tablet', () => {
      mockLeftPanelCollapsed = false;
      mockRightPanelCollapsed = false;

      const { result, rerender } = renderHook(() => useTabletPanels(true));
      rerender();

      act(() => {
        result.current.openLeftPanel();
      });
      rerender();
      rerender();

      expect(result.current.leftPanelOpen).toBe(true);
      expect(result.current.rightPanelOpen).toBe(false);
    });
  });

  describe('return value structure', () => {
    it('returns all expected properties', () => {
      const { result } = renderHook(() => useTabletPanels(false));

      const expectedKeys: Array<keyof TabletPanelsState> = [
        'leftPanelOpen',
        'rightPanelOpen',
        'openLeftPanel',
        'closeLeftPanel',
        'openRightPanel',
        'closeRightPanel',
      ];

      expectedKeys.forEach((key) => {
        expect(result.current).toHaveProperty(key);
      });
    });

    it('provides function references for panel controls', () => {
      const { result } = renderHook(() => useTabletPanels(false));

      expect(typeof result.current.openLeftPanel).toBe('function');
      expect(typeof result.current.closeLeftPanel).toBe('function');
      expect(typeof result.current.openRightPanel).toBe('function');
      expect(typeof result.current.closeRightPanel).toBe('function');
    });
  });

  describe('edge cases', () => {
    it('handles rapid tablet mode transitions', () => {
      mockLeftPanelCollapsed = false;
      mockRightPanelCollapsed = false;

      const { result, rerender } = renderHook(
        (props: { isTablet: boolean }) => useTabletPanels(props.isTablet),
        {
          initialProps: { isTablet: false },
        }
      );

      // Rapid transitions
      rerender({ isTablet: true });
      rerender({ isTablet: false });
      rerender({ isTablet: true });

      // Should handle transitions gracefully
      expect(result.current.leftPanelOpen).toBe(false);
      expect(result.current.rightPanelOpen).toBe(false);
    });
  });
});

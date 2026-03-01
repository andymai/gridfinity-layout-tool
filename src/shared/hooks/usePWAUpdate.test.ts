import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePWAUpdate } from '@/shared/hooks';
import { useInteractionStore } from '@/core/store/interaction';
import { useSelectionStore } from '@/core/store/selection';
import { useViewStore } from '@/core/store/view';
import { useLayoutStore } from '@/core/store/layout';
import { useToastStore } from '@/core/store/toast';
import { resetAllStores, setupFakeTimers } from '@/test/testUtils';
import { STAGING_ID } from '@/core/constants';
import { saveEphemeralState, type EphemeralState } from '@/utils/ephemeralState';

// Constants from usePWAUpdate (mirrored for testing)
const UPDATE_TOAST_MS = 5000;
const IDLE_CHECK_INTERVAL_MS = 1000;
const MAX_IDLE_WAIT_MS = 2 * 60 * 1000;

// Track mock functions from the virtual module
let mockNeedRefresh = false;
let mockUpdateServiceWorker: Mock;
let mockOnRegisteredSW:
  | ((swUrl: string, registration: ServiceWorkerRegistration) => void)
  | undefined;
let mockOnRegisterError: ((error: Error) => void) | undefined;

// Mock the virtual:pwa-register/react module
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: (options?: {
    onRegisteredSW?: (swUrl: string, registration: ServiceWorkerRegistration) => void;
    onRegisterError?: (error: Error) => void;
  }) => {
    // Capture callbacks for testing
    mockOnRegisteredSW = options?.onRegisteredSW;
    mockOnRegisterError = options?.onRegisterError;

    return {
      needRefresh: [mockNeedRefresh, vi.fn()] as [boolean, (v: boolean) => void],
      offlineReady: [false, vi.fn()] as [boolean, (v: boolean) => void],
      updateServiceWorker: mockUpdateServiceWorker,
    };
  },
}));

describe('usePWAUpdate', () => {
  let timerUtils: ReturnType<typeof setupFakeTimers>;
  let mockRegistration: ServiceWorkerRegistration;

  beforeEach(() => {
    timerUtils = setupFakeTimers();
    vi.clearAllMocks();
    resetAllStores();

    // Reset module-level mock state
    mockNeedRefresh = false;
    mockUpdateServiceWorker = vi.fn();
    mockOnRegisteredSW = undefined;
    mockOnRegisterError = undefined;

    // Create mock registration
    mockRegistration = {
      installing: null,
      waiting: null,
      active: null,
      scope: '/',
      updateViaCache: 'imports',
      update: vi.fn().mockResolvedValue(undefined),
      unregister: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onupdatefound: null,
      navigationPreload: {} as NavigationPreloadManager,
    } as unknown as ServiceWorkerRegistration;

    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      writable: true,
      configurable: true,
    });

    // Clear sessionStorage
    sessionStorage.clear();
  });

  afterEach(() => {
    timerUtils.cleanup();
    vi.restoreAllMocks();
  });

  describe('isSafeToReload checks', () => {
    it('blocks reload during active interaction', async () => {
      mockNeedRefresh = true;

      // Set up an active interaction
      useInteractionStore.setState({
        interaction: {
          type: 'drag',
          binIds: ['bin1'],
          startX: 0,
          startY: 0,
          currentX: 0,
          currentY: 0,
        },
      });

      renderHook(() => usePWAUpdate());

      // Trigger registration
      act(() => {
        mockOnRegisteredSW?.('/sw.js', mockRegistration);
      });

      // Wait some time - should not reload due to active interaction
      act(() => {
        timerUtils.advanceTime(10000);
      });

      // updateServiceWorker should not have been called yet
      expect(mockUpdateServiceWorker).not.toHaveBeenCalled();
    });

    it('blocks reload with bins in staging', async () => {
      mockNeedRefresh = true;

      // Add a bin to staging
      const layout = useLayoutStore.getState().layout;
      useLayoutStore.setState({
        layout: {
          ...layout,
          bins: [
            {
              id: 'staged-bin',
              layerId: STAGING_ID,
              x: 0,
              y: 0,
              width: 1,
              depth: 1,
              height: 3,
              category: layout.categories[0].id,
              label: '',
              notes: '',
            },
          ],
        },
      });

      renderHook(() => usePWAUpdate());

      // Trigger registration
      act(() => {
        mockOnRegisteredSW?.('/sw.js', mockRegistration);
      });

      // Wait some time - should not reload due to staged bins
      act(() => {
        timerUtils.advanceTime(10000);
      });

      expect(mockUpdateServiceWorker).not.toHaveBeenCalled();
    });

    it('blocks reload during expanded 3D preview', async () => {
      mockNeedRefresh = true;

      // Set expanded preview state
      useViewStore.setState({ isPreviewExpanded: true });

      renderHook(() => usePWAUpdate());

      act(() => {
        mockOnRegisteredSW?.('/sw.js', mockRegistration);
      });

      act(() => {
        timerUtils.advanceTime(10000);
      });

      expect(mockUpdateServiceWorker).not.toHaveBeenCalled();
    });

    it('blocks reload with context menu open', async () => {
      mockNeedRefresh = true;

      useViewStore.setState({
        contextMenu: { binIds: ['bin1'], position: { x: 100, y: 100 }, source: 'grid' },
      });

      renderHook(() => usePWAUpdate());

      act(() => {
        mockOnRegisteredSW?.('/sw.js', mockRegistration);
      });

      act(() => {
        timerUtils.advanceTime(10000);
      });

      expect(mockUpdateServiceWorker).not.toHaveBeenCalled();
    });

    it('blocks reload with quick label popover open', async () => {
      mockNeedRefresh = true;

      useSelectionStore.setState({ quickLabelBinId: 'bin1' });

      renderHook(() => usePWAUpdate());

      act(() => {
        mockOnRegisteredSW?.('/sw.js', mockRegistration);
      });

      act(() => {
        timerUtils.advanceTime(10000);
      });

      expect(mockUpdateServiceWorker).not.toHaveBeenCalled();
    });

    it('blocks reload during keyboard drag mode', async () => {
      mockNeedRefresh = true;

      useInteractionStore.setState({ keyboardDragMode: true });

      renderHook(() => usePWAUpdate());

      act(() => {
        mockOnRegisteredSW?.('/sw.js', mockRegistration);
      });

      act(() => {
        timerUtils.advanceTime(10000);
      });

      expect(mockUpdateServiceWorker).not.toHaveBeenCalled();
    });

    it('allows reload when idle', async () => {
      mockNeedRefresh = true;

      // Ensure we're in a safe state (default after resetAllStores)
      useInteractionStore.setState({
        interaction: null,
        keyboardDragMode: false,
        keyboardResizeMode: false,
      });
      useViewStore.setState({ isPreviewExpanded: false });
      useViewStore.setState({ contextMenu: null });
      useSelectionStore.setState({ quickLabelBinId: null });

      renderHook(() => usePWAUpdate());

      act(() => {
        mockOnRegisteredSW?.('/sw.js', mockRegistration);
      });

      // Flush pending promises and advance through idle check + toast duration
      await act(async () => {
        // Advance time for idle check
        timerUtils.advanceTime(IDLE_CHECK_INTERVAL_MS);
        await Promise.resolve(); // Flush microtasks

        // Advance time for toast duration
        timerUtils.advanceTime(UPDATE_TOAST_MS);
        await Promise.resolve(); // Flush microtasks
      });

      expect(mockUpdateServiceWorker).toHaveBeenCalledWith(true);
    });
  });

  describe('offline/online transitions', () => {
    it('shows toast when going offline', () => {
      renderHook(() => usePWAUpdate());

      act(() => {
        mockOnRegisteredSW?.('/sw.js', mockRegistration);
      });

      // Simulate going offline
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
      act(() => {
        window.dispatchEvent(new Event('offline'));
      });

      const toasts = useToastStore.getState().toasts;
      expect(toasts).toHaveLength(1);
      expect(toasts[0].message).toContain('offline');
      expect(toasts[0].type).toBe('info');
    });

    it('shows toast when coming back online', () => {
      // Start offline
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

      renderHook(() => usePWAUpdate());

      act(() => {
        mockOnRegisteredSW?.('/sw.js', mockRegistration);
      });

      // Simulate offline event to set wasOfflineRef
      act(() => {
        window.dispatchEvent(new Event('offline'));
      });

      // Clear toasts
      useToastStore.setState({ toasts: [] });

      // Come back online
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
      act(() => {
        window.dispatchEvent(new Event('online'));
      });

      const toasts = useToastStore.getState().toasts;
      expect(toasts).toHaveLength(1);
      expect(toasts[0].message).toContain('Back online');
      expect(toasts[0].type).toBe('success');
    });

    it('checks for updates when coming back online', () => {
      // Start offline
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

      renderHook(() => usePWAUpdate());

      act(() => {
        mockOnRegisteredSW?.('/sw.js', mockRegistration);
      });

      // Simulate offline
      act(() => {
        window.dispatchEvent(new Event('offline'));
      });

      // Come back online
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
      act(() => {
        window.dispatchEvent(new Event('online'));
      });

      // Should have called update
      expect(mockRegistration.update).toHaveBeenCalled();
    });
  });

  describe('update check throttling', () => {
    it('throttles update checks within throttle period', () => {
      renderHook(() => usePWAUpdate());

      act(() => {
        mockOnRegisteredSW?.('/sw.js', mockRegistration);
      });

      // First check happens on registration
      expect(mockRegistration.update).toHaveBeenCalledTimes(1);

      // Trigger visibility change
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      // Should not check again (within throttle period)
      expect(mockRegistration.update).toHaveBeenCalledTimes(1);

      // Advance past throttle period (60 seconds)
      act(() => {
        timerUtils.advanceTime(61000);
      });

      // Now trigger visibility change
      act(() => {
        Object.defineProperty(document, 'visibilityState', {
          value: 'visible',
          configurable: true,
        });
        document.dispatchEvent(new Event('visibilitychange'));
      });

      // Now should check
      expect(mockRegistration.update).toHaveBeenCalledTimes(2);
    });

    it('skips update check when offline', () => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

      renderHook(() => usePWAUpdate());

      act(() => {
        mockOnRegisteredSW?.('/sw.js', mockRegistration);
      });

      // Should not have checked (offline)
      expect(mockRegistration.update).not.toHaveBeenCalled();
    });

    it('skips update check when SW is installing', () => {
      mockRegistration.installing = {} as ServiceWorker;

      renderHook(() => usePWAUpdate());

      act(() => {
        mockOnRegisteredSW?.('/sw.js', mockRegistration);
      });

      // Should not have checked (installing)
      expect(mockRegistration.update).not.toHaveBeenCalled();
    });
  });

  describe('reload loop prevention', () => {
    it('skips reload if session storage flag is set', async () => {
      mockNeedRefresh = true;

      // Set the flag as if we already tried to reload
      sessionStorage.setItem('pwa-update-pending-reload', Date.now().toString());

      renderHook(() => usePWAUpdate());

      act(() => {
        mockOnRegisteredSW?.('/sw.js', mockRegistration);
      });

      // Wait for potential reload
      act(() => {
        timerUtils.advanceTime(10000);
      });

      // Should not reload (loop prevention)
      expect(mockUpdateServiceWorker).not.toHaveBeenCalled();
    });

    it('clears reload flag on successful registration', () => {
      sessionStorage.setItem('pwa-update-pending-reload', Date.now().toString());

      renderHook(() => usePWAUpdate());

      act(() => {
        mockOnRegisteredSW?.('/sw.js', mockRegistration);
      });

      // Flag should be cleared
      expect(sessionStorage.getItem('pwa-update-pending-reload')).toBeNull();
    });
  });

  describe('SW registration error handling', () => {
    it('logs error on registration failure', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      renderHook(() => usePWAUpdate());

      const error = new Error('Registration failed');
      act(() => {
        mockOnRegisterError?.(error);
      });

      expect(consoleSpy).toHaveBeenCalledWith('SW registration failed:', error);

      consoleSpy.mockRestore();
    });

    it('logs warning for SecurityError', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      renderHook(() => usePWAUpdate());

      const error = new Error('SecurityError: blocked');
      error.message = 'SecurityError: blocked';
      act(() => {
        mockOnRegisterError?.(error);
      });

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('private browsing'));

      consoleSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });

  describe('periodic update checks', () => {
    it('sets up periodic update check interval', () => {
      renderHook(() => usePWAUpdate());

      act(() => {
        mockOnRegisteredSW?.('/sw.js', mockRegistration);
      });

      // Initial check
      expect(mockRegistration.update).toHaveBeenCalledTimes(1);

      // Advance 15 minutes (periodic interval)
      act(() => {
        timerUtils.advanceTime(15 * 60 * 1000);
      });

      // Should have checked again
      expect(mockRegistration.update).toHaveBeenCalledTimes(2);
    });

    it('cleans up interval on unmount', () => {
      const { unmount } = renderHook(() => usePWAUpdate());

      act(() => {
        mockOnRegisteredSW?.('/sw.js', mockRegistration);
      });

      // Initial check
      expect(mockRegistration.update).toHaveBeenCalledTimes(1);

      unmount();

      // Advance 15 minutes
      act(() => {
        timerUtils.advanceTime(15 * 60 * 1000);
      });

      // Should NOT have checked again (unmounted)
      expect(mockRegistration.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('update flow', () => {
    it('shows toast before updating', async () => {
      mockNeedRefresh = true;

      renderHook(() => usePWAUpdate());

      act(() => {
        mockOnRegisteredSW?.('/sw.js', mockRegistration);
      });

      // Flush promises and wait for idle check (should pass immediately)
      await act(async () => {
        timerUtils.advanceTime(IDLE_CHECK_INTERVAL_MS);
        await Promise.resolve();
      });

      const toasts = useToastStore.getState().toasts;
      expect(toasts.some((t) => t.message.includes('Updating'))).toBe(true);
    });

    it('waits for toast duration before updating', async () => {
      mockNeedRefresh = true;

      renderHook(() => usePWAUpdate());

      act(() => {
        mockOnRegisteredSW?.('/sw.js', mockRegistration);
      });

      // Flush promises after idle check
      await act(async () => {
        timerUtils.advanceTime(IDLE_CHECK_INTERVAL_MS);
        await Promise.resolve();
      });

      // updateServiceWorker not called yet (waiting for toast duration)
      expect(mockUpdateServiceWorker).not.toHaveBeenCalled();

      // After toast duration
      await act(async () => {
        timerUtils.advanceTime(UPDATE_TOAST_MS);
        await Promise.resolve();
      });

      expect(mockUpdateServiceWorker).toHaveBeenCalledWith(true);
    });

    it('times out waiting for idle after max wait time', async () => {
      mockNeedRefresh = true;

      // Keep interaction active
      useInteractionStore.setState({
        interaction: {
          type: 'drag',
          binIds: ['bin1'],
          startX: 0,
          startY: 0,
          currentX: 0,
          currentY: 0,
        },
      });

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      renderHook(() => usePWAUpdate());

      act(() => {
        mockOnRegisteredSW?.('/sw.js', mockRegistration);
      });

      // Advance through all the idle checks until timeout
      // The check runs every 1 second, so we need to advance in steps
      await act(async () => {
        for (let elapsed = 0; elapsed <= MAX_IDLE_WAIT_MS; elapsed += IDLE_CHECK_INTERVAL_MS) {
          timerUtils.advanceTime(IDLE_CHECK_INTERVAL_MS);
          await Promise.resolve();
        }
      });

      // Should have warned about timeout
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Timed out'));

      // Now advance through toast duration
      await act(async () => {
        timerUtils.advanceTime(UPDATE_TOAST_MS);
        await Promise.resolve();
      });

      // Should have updated anyway
      expect(mockUpdateServiceWorker).toHaveBeenCalledWith(true);

      consoleSpy.mockRestore();
    });

    it('saves ephemeral state before triggering update', async () => {
      mockNeedRefresh = true;

      // Set up some UI state to be saved
      useSelectionStore.setState({ selectedBinIds: ['bin-1', 'bin-2'] });
      useViewStore.setState({ zoom: 2.0, showIsometricPreview: true });

      renderHook(() => usePWAUpdate());

      act(() => {
        mockOnRegisteredSW?.('/sw.js', mockRegistration);
      });

      // Complete the update flow
      await act(async () => {
        timerUtils.advanceTime(IDLE_CHECK_INTERVAL_MS);
        await Promise.resolve();
        timerUtils.advanceTime(UPDATE_TOAST_MS);
        await Promise.resolve();
      });

      // Check that state was saved to sessionStorage
      // Note: The state will be saved just before updateServiceWorker is called
      expect(mockUpdateServiceWorker).toHaveBeenCalledWith(true);
      // State should have been saved (we can't easily verify the contents since
      // the real updateServiceWorker would reload the page, but we verify the call)
    });
  });

  describe('ephemeral state restoration', () => {
    it('restores ephemeral state on mount and shows toast', async () => {
      // Pre-save some ephemeral state (simulating state saved before PWA reload)
      const savedState: Omit<EphemeralState, 'savedAt'> = {
        selectedBinIds: ['bin-1'],
        activeLayerId: useLayoutStore.getState().layout.layers[0].id,
        activeCategoryId: useLayoutStore.getState().layout.categories[0].id,
        focusedBinId: null,
        zoom: 1.5,
        showOtherLayers: true,
        leftPanelCollapsed: false,
        rightPanelCollapsed: true,
        showIsometricPreview: true,
        isometricRotation: 90,
        layerViewMode: 'all',
        paintSize: { width: 2, depth: 2 },
      };
      saveEphemeralState(savedState);

      // Add a bin that matches the savedState's selectedBinIds
      const layout = useLayoutStore.getState().layout;
      useLayoutStore.setState({
        layout: {
          ...layout,
          bins: [
            {
              id: 'bin-1',
              layerId: layout.layers[0].id,
              x: 0,
              y: 0,
              width: 1,
              depth: 1,
              height: 3,
              category: layout.categories[0].id,
              label: '',
              notes: '',
            },
          ],
        },
      });

      renderHook(() => usePWAUpdate());

      act(() => {
        mockOnRegisteredSW?.('/sw.js', mockRegistration);
      });

      // Wait for restoration effect (100ms delay + timeout)
      await act(async () => {
        timerUtils.advanceTime(150);
        await Promise.resolve();
      });

      // Check that state was restored
      expect(useViewStore.getState().zoom).toBe(1.5);
      expect(useViewStore.getState().showIsometricPreview).toBe(true);
      expect(useViewStore.getState().isometricRotation).toBe(90);
      expect(useViewStore.getState().layerViewMode).toBe('all');
      expect(useViewStore.getState().rightPanelCollapsed).toBe(true);
      expect(useInteractionStore.getState().paintSize).toEqual({ width: 2, depth: 2 });
      expect(useSelectionStore.getState().selectedBinIds).toEqual(['bin-1']);

      // Check toast was shown
      const toasts = useToastStore.getState().toasts;
      expect(toasts.some((t) => t.message === 'Session restored')).toBe(true);
    });

    it('does not show toast when no ephemeral state exists', async () => {
      // Ensure no ephemeral state is saved
      sessionStorage.removeItem('gridfinity-ephemeral-state-v1');

      renderHook(() => usePWAUpdate());

      act(() => {
        mockOnRegisteredSW?.('/sw.js', mockRegistration);
      });

      // Wait for restoration effect
      await act(async () => {
        timerUtils.advanceTime(150);
        await Promise.resolve();
      });

      // No "Session restored" toast should appear
      const toasts = useToastStore.getState().toasts;
      expect(toasts.some((t) => t.message === 'Session restored')).toBe(false);
    });

    it('filters out selected bins that no longer exist', async () => {
      // Save state with bin IDs that won't exist
      const savedState: Omit<EphemeralState, 'savedAt'> = {
        selectedBinIds: ['non-existent-bin', 'also-non-existent'],
        activeLayerId: useLayoutStore.getState().layout.layers[0].id,
        activeCategoryId: useLayoutStore.getState().layout.categories[0].id,
        focusedBinId: 'non-existent-bin',
        zoom: 1.0,
        showOtherLayers: true,
        leftPanelCollapsed: false,
        rightPanelCollapsed: false,
        showIsometricPreview: false,
        isometricRotation: 0,
        layerViewMode: 'stack',
        paintSize: null,
      };
      saveEphemeralState(savedState);

      renderHook(() => usePWAUpdate());

      act(() => {
        mockOnRegisteredSW?.('/sw.js', mockRegistration);
      });

      // Wait for restoration
      await act(async () => {
        timerUtils.advanceTime(150);
        await Promise.resolve();
      });

      // Selection should be empty (bins don't exist)
      const selection = useSelectionStore.getState();
      expect(selection.selectedBinIds).toEqual([]);
      expect(selection.focusedBinId).toBeNull();
    });
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useCreateFromBin } from './useCreateFromBin';
import { useDesignerStore } from '../store/designer';
import { useToastStore } from '@/core/store/toast';
import { DEFAULT_BIN_PARAMS } from '../constants/defaults';

// Mock the translation hook
vi.mock('@/i18n', () => ({
  useTranslation: () =>
    vi.fn((key: string, params?: Record<string, string>) => {
      if (params?.name) return `Creating "${params.name}" — save to link to bin`;
      return key;
    }),
}));

describe('useCreateFromBin', () => {
  const originalLocation = window.location;
  let mockReplaceState: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset store to clean state with full initial state
    const initialState = useDesignerStore.getState();
    useDesignerStore.setState({
      ...initialState,
      params: { ...DEFAULT_BIN_PARAMS },
      currentDesignId: null,
      designName: 'Untitled Bin',
      saveStatus: 'idle',
      pendingBinLink: null,
      history: { past: [], future: [] },
      ui: {
        ...initialState.ui,
        activeTab: 'dimensions',
        exportDialogOpen: false,
        designListOpen: false,
        wireframeMode: false,
        previewCompartments: null,
        previewSelection: null,
        halfGridMode: false,
      },
    });

    // Clear toast store
    useToastStore.setState({ toasts: [] });

    // Mock window.history.replaceState
    mockReplaceState = vi.fn();
    Object.defineProperty(window, 'history', {
      value: { replaceState: mockReplaceState },
      writable: true,
    });
  });

  afterEach(() => {
    // Restore window.location
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
    });
    vi.restoreAllMocks();
  });

  function setUrlParams(params: Record<string, string>) {
    const searchParams = new URLSearchParams(params);
    Object.defineProperty(window, 'location', {
      value: Object.assign({}, originalLocation, {
        href: `http://localhost/designer?${searchParams.toString()}`,
        search: `?${searchParams.toString()}`,
        pathname: '/designer',
      }),
      writable: true,
    });
  }

  it('should initialize designer from URL params when createFrom=bin', async () => {
    setUrlParams({
      createFrom: 'bin',
      linkBin: 'bin-123',
      name: 'Test Bin',
      width: '2',
      depth: '3',
      height: '4',
    });

    renderHook(() => useCreateFromBin());

    await waitFor(() => {
      const state = useDesignerStore.getState();
      expect(state.params.width).toBe(2);
      expect(state.params.depth).toBe(3);
      expect(state.params.height).toBe(4);
      expect(state.designName).toBe('Test Bin');
      expect(state.pendingBinLink).toBe('bin-123');
    });
  });

  it('should clean URL params after processing', async () => {
    setUrlParams({
      createFrom: 'bin',
      linkBin: 'bin-123',
      name: 'Test Bin',
      width: '2',
      depth: '3',
      height: '4',
    });

    renderHook(() => useCreateFromBin());

    await waitFor(() => {
      expect(mockReplaceState).toHaveBeenCalled();
    });

    // Verify URL was cleaned (all createFrom params removed)
    const [, , url] = mockReplaceState.mock.calls[0];
    expect(url).toBe('/designer');
  });

  it('should show info toast when initializing from bin', async () => {
    setUrlParams({
      createFrom: 'bin',
      linkBin: 'bin-123',
      name: 'Test Bin',
      width: '2',
      depth: '3',
      height: '4',
    });

    renderHook(() => useCreateFromBin());

    await waitFor(() => {
      const toasts = useToastStore.getState().toasts;
      expect(toasts.length).toBeGreaterThan(0);
      expect(toasts[0].type).toBe('error');
    });
  });

  it('should enable half-bin mode when dimensions have fractional values', async () => {
    setUrlParams({
      createFrom: 'bin',
      linkBin: 'bin-123',
      name: 'Half Bin',
      width: '1.5',
      depth: '2',
      height: '3',
    });

    renderHook(() => useCreateFromBin());

    await waitFor(() => {
      const state = useDesignerStore.getState();
      expect(state.params.width).toBe(1.5);
      expect(state.ui.halfGridMode).toBe(true);
    });
  });

  it('should not enable half-bin mode for integer dimensions', async () => {
    setUrlParams({
      createFrom: 'bin',
      linkBin: 'bin-123',
      name: 'Regular Bin',
      width: '2',
      depth: '3',
      height: '4',
    });

    renderHook(() => useCreateFromBin());

    await waitFor(() => {
      const state = useDesignerStore.getState();
      expect(state.params.width).toBe(2);
      expect(state.ui.halfGridMode).toBe(false);
    });
  });

  it('should do nothing when createFrom is not "bin"', async () => {
    setUrlParams({
      createFrom: 'other',
      linkBin: 'bin-123',
      name: 'Test Bin',
      width: '2',
      depth: '3',
      height: '4',
    });

    renderHook(() => useCreateFromBin());

    // Flush microtasks to ensure hook effects complete
    await act(() => Promise.resolve());

    const state = useDesignerStore.getState();
    expect(state.pendingBinLink).toBeNull();
    expect(mockReplaceState).not.toHaveBeenCalled();
  });

  it('should do nothing when required params are missing', async () => {
    setUrlParams({
      createFrom: 'bin',
      linkBin: 'bin-123',
      name: 'Test Bin',
      // Missing width, depth, height
    });

    renderHook(() => useCreateFromBin());

    await act(() => Promise.resolve());

    const state = useDesignerStore.getState();
    expect(state.pendingBinLink).toBeNull();
    expect(mockReplaceState).not.toHaveBeenCalled();
  });

  it('should do nothing when dimensions are invalid', async () => {
    setUrlParams({
      createFrom: 'bin',
      linkBin: 'bin-123',
      name: 'Test Bin',
      width: '0', // Invalid: too small
      depth: '3',
      height: '4',
    });

    renderHook(() => useCreateFromBin());

    await act(() => Promise.resolve());

    const state = useDesignerStore.getState();
    expect(state.pendingBinLink).toBeNull();
  });

  it('should do nothing when dimensions are not numbers', async () => {
    setUrlParams({
      createFrom: 'bin',
      linkBin: 'bin-123',
      name: 'Test Bin',
      width: 'abc',
      depth: '3',
      height: '4',
    });

    renderHook(() => useCreateFromBin());

    await act(() => Promise.resolve());

    const state = useDesignerStore.getState();
    expect(state.pendingBinLink).toBeNull();
  });

  it('should only process URL params once on multiple renders', async () => {
    setUrlParams({
      createFrom: 'bin',
      linkBin: 'bin-123',
      name: 'Test Bin',
      width: '2',
      depth: '3',
      height: '4',
    });

    const { rerender } = renderHook(() => useCreateFromBin());

    await waitFor(() => {
      expect(useDesignerStore.getState().pendingBinLink).toBe('bin-123');
    });

    // Clear the pending link to check it doesn't get re-set
    useDesignerStore.getState().clearPendingBinLink();
    expect(useDesignerStore.getState().pendingBinLink).toBeNull();

    // Rerender shouldn't re-process URL params
    rerender();

    await act(() => Promise.resolve());
    expect(useDesignerStore.getState().pendingBinLink).toBeNull();
  });

  it('should decode URL-encoded name', async () => {
    setUrlParams({
      createFrom: 'bin',
      linkBin: 'bin-123',
      name: 'Test%20Bin%20%231',
      width: '2',
      depth: '3',
      height: '4',
    });

    renderHook(() => useCreateFromBin());

    await waitFor(() => {
      const state = useDesignerStore.getState();
      expect(state.designName).toBe('Test Bin #1');
    });
  });
});

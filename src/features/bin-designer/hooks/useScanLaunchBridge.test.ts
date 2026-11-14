import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { useScanLaunchStore } from '@/core/store/scanLaunch';
import { SCAN_LAUNCH_STALE_MS, useScanLaunchBridge } from './useScanLaunchBridge';

const gate = vi.hoisted(() => ({ saved: true }));
vi.mock('./designSaveGate', () => ({
  settleDesignSaves: vi.fn(async () => gate.saved),
}));
const viewport = vi.hoisted(() => ({ isDesktop: true }));
const variant = vi.hoisted(() => ({ isVariant: false, isLoading: false }));
vi.mock('./useVariantContext', () => ({
  useVariantContext: () => ({ ...variant, reload: () => {} }),
}));
vi.mock('@/shared/hooks/useResponsive', () => ({
  useResponsive: () => ({ isDesktop: viewport.isDesktop }),
}));

function openDesign(id: string): void {
  act(() => useDesignerStore.getState().setCurrentDesignId(id));
}

describe('useScanLaunchBridge', () => {
  beforeEach(() => {
    useDesignerStore.setState(useDesignerStore.getInitialState());
    useScanLaunchStore.setState({ request: null });
    gate.saved = true;
    viewport.isDesktop = true;
    variant.isVariant = false;
    variant.isLoading = false;
  });

  it('scans into the open bin when asked from inside the designer', () => {
    openDesign('open');
    renderHook(() => useScanLaunchBridge());

    act(() => useScanLaunchStore.getState().requestScan('palette', false));

    const s = useDesignerStore.getState();
    expect(s.currentDesignId).toBe('open');
    expect(s.ui.scanDialogSource).toBe('palette');
    expect(s.ui.growBinForScan).toBe(false);
    expect(s.params.style).toBe('solid');
  });

  it('opens the phone flow off desktop', () => {
    viewport.isDesktop = false;
    openDesign('open');
    renderHook(() => useScanLaunchBridge());

    act(() => useScanLaunchStore.getState().requestScan('whats_new', false));
    const s = useDesignerStore.getState();
    expect(s.ui.phoneScanSource).toBe('whats_new');
    expect(s.ui.scanDialogSource).toBeNull();
  });

  it('starts a new bin rather than scanning into a variant', async () => {
    variant.isVariant = true;
    openDesign('variant');
    renderHook(() => useScanLaunchBridge());

    act(() => useScanLaunchStore.getState().requestScan('whats_new', false));
    await waitFor(() => expect(useDesignerStore.getState().currentDesignId).toBeNull());
    expect(useDesignerStore.getState().ui.scanDialogSource).toBeNull();
  });

  it('waits for a design to load, then starts a new bin that grows to fit', async () => {
    act(() => useScanLaunchStore.getState().requestScan('whats_new', true));
    renderHook(() => useScanLaunchBridge());
    expect(useScanLaunchStore.getState().request).not.toBeNull();

    openDesign('last-session');
    await waitFor(() => expect(useDesignerStore.getState().currentDesignId).toBeNull());
    expect(useDesignerStore.getState().ui.scanDialogSource).toBeNull();

    // useDesignerInit assigns the fresh design's id.
    openDesign('fresh');
    const s = useDesignerStore.getState();
    expect(s.ui.scanDialogSource).toBe('whats_new');
    expect(s.ui.growBinForScan).toBe(true);
    expect(s.params.style).toBe('solid');
  });

  it('keeps the open bin when its saves fail', async () => {
    gate.saved = false;
    openDesign('open');
    renderHook(() => useScanLaunchBridge());

    act(() => useScanLaunchStore.getState().requestScan('palette', true));
    await act(async () => {});

    expect(useDesignerStore.getState().currentDesignId).toBe('open');
    expect(useDesignerStore.getState().ui.scanDialogSource).toBeNull();
  });

  it('starts a scan bin from the factory base when saved defaults would block it', async () => {
    openDesign('open');
    renderHook(() => useScanLaunchBridge());
    act(() => useScanLaunchStore.getState().requestScan('palette', true));
    await waitFor(() => expect(useDesignerStore.getState().currentDesignId).toBeNull());

    // As if the user's saved default were a spacer body.
    act(() => {
      const s = useDesignerStore.getState();
      useDesignerStore.setState({
        params: { ...s.params, base: { ...s.params.base, spacer: true } },
      });
    });
    openDesign('fresh');

    const s = useDesignerStore.getState();
    expect(s.params.base.spacer).toBe(false);
    expect(s.params.style).toBe('solid');
    expect(s.ui.scanDialogSource).toBe('palette');
  });

  it('drops a second request while a new bin is on its way', async () => {
    openDesign('open');
    renderHook(() => useScanLaunchBridge());
    act(() => useScanLaunchStore.getState().requestScan('palette', true));
    await waitFor(() => expect(useDesignerStore.getState().currentDesignId).toBeNull());

    act(() => useScanLaunchStore.getState().requestScan('whats_new', false));
    openDesign('fresh');

    expect(useDesignerStore.getState().ui.scanDialogSource).toBe('palette');
    expect(useScanLaunchStore.getState().request).toBeNull();
  });

  it('leaves the designer alone when it closes while saves settle', async () => {
    let settle: ((saved: boolean) => void) | null = null;
    const { settleDesignSaves } = await import('./designSaveGate');
    vi.mocked(settleDesignSaves).mockImplementationOnce(
      () => new Promise<boolean>((resolve) => (settle = resolve))
    );
    openDesign('open');
    const { unmount } = renderHook(() => useScanLaunchBridge());
    act(() => useScanLaunchStore.getState().requestScan('palette', true));
    expect(settle).not.toBeNull();

    unmount();
    await act(async () => settle?.(true));

    expect(useDesignerStore.getState().currentDesignId).toBe('open');
  });

  it('drops a request from a navigation that never arrived', () => {
    openDesign('open');
    act(() => {
      useScanLaunchStore.setState({
        request: {
          source: 'palette',
          newBin: false,
          requestedAt: Date.now() - SCAN_LAUNCH_STALE_MS - 1,
        },
      });
    });
    renderHook(() => useScanLaunchBridge());

    expect(useScanLaunchStore.getState().request).toBeNull();
    expect(useDesignerStore.getState().ui.scanDialogSource).toBeNull();
  });
});

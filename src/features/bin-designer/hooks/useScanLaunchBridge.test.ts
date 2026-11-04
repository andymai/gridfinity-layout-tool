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

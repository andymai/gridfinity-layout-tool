import { create } from 'zustand';

/** Where a "Scan a tool" request came from outside the bin designer's own panel. */
export type ScanLaunchSource = 'palette' | 'whats_new';

export interface ScanLaunchRequest {
  readonly source: ScanLaunchSource;
  /** Start a fresh bin for the scan rather than scanning into the open one. */
  readonly newBin: boolean;
  readonly requestedAt: number;
}

interface ScanLaunchState {
  /**
   * Held here, not dispatched as an event, because the designer is loaded
   * lazily: a request made from the planner has to wait for it to mount.
   */
  readonly request: ScanLaunchRequest | null;
  readonly requestScan: (source: ScanLaunchSource, newBin: boolean) => void;
  readonly takeRequest: () => ScanLaunchRequest | null;
}

export const useScanLaunchStore = create<ScanLaunchState>((set, get) => ({
  request: null,
  requestScan: (source, newBin) => {
    set({ request: { source, newBin, requestedAt: Date.now() } });
  },
  takeRequest: () => {
    const { request } = get();
    if (request) set({ request: null });
    return request;
  },
}));

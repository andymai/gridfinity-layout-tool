import { describe, it, expect, beforeEach } from 'vitest';
import { useScanLaunchStore } from './scanLaunch';

describe('scanLaunch', () => {
  beforeEach(() => {
    useScanLaunchStore.setState({ request: null });
  });

  it('holds one request until it is taken', () => {
    useScanLaunchStore.getState().requestScan('palette', true);
    const taken = useScanLaunchStore.getState().takeRequest();
    expect(taken).toMatchObject({ source: 'palette', newBin: true });
    expect(useScanLaunchStore.getState().takeRequest()).toBeNull();
  });

  it('keeps only the latest request', () => {
    useScanLaunchStore.getState().requestScan('palette', true);
    useScanLaunchStore.getState().requestScan('whats_new', false);
    expect(useScanLaunchStore.getState().takeRequest()).toMatchObject({
      source: 'whats_new',
      newBin: false,
    });
  });
});

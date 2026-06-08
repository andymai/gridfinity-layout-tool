import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useConnectorSampleExport } from './useConnectorSampleExport';

vi.mock('@/i18n', () => ({
  useTranslation:
    () =>
    (key: string): string =>
      key,
}));

let activeBridge: unknown = null;
vi.mock('@/shared/generation/bridge', () => ({
  getActiveBridge: () => activeBridge,
}));

describe('useConnectorSampleExport', () => {
  beforeEach(() => {
    activeBridge = null;
  });

  it('reports canExport from the active bridge presence', () => {
    const { result, rerender } = renderHook(() => useConnectorSampleExport());
    expect(result.current.canExport).toBe(false);

    activeBridge = {};
    rerender();
    expect(result.current.canExport).toBe(true);
  });

  it('refuses to export and surfaces an error when no bridge is ready', async () => {
    const { result } = renderHook(() => useConnectorSampleExport());
    let ok = true;
    await act(async () => {
      ok = await result.current.downloadSample('stl');
    });
    expect(ok).toBe(false);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { Cutout } from '@/features/bin-designer/types';
import { useSvgExport } from './useSvgExport';

const mockAddToast = vi.fn();
const mockTriggerDownload = vi.fn();
const mockTrackEvent = vi.fn();

vi.mock('@/features/bin-designer/store', () => {
  const useDesignerStore = () => undefined;
  useDesignerStore.getState = () => ({ designName: 'Wrench Rail' });
  return { useDesignerStore };
});

vi.mock('@/core/store/toast', () => ({
  useToastStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ addToast: mockAddToast }),
}));

vi.mock('@/shared/generation/exportUtils', () => ({
  triggerDownload: (blob: Blob, name: string) => mockTriggerDownload(blob, name),
}));

vi.mock('@/shared/analytics/posthog', () => ({
  trackEvent: (name: string, props: unknown) => mockTrackEvent(name, props),
}));

const cutout = (overrides: Partial<Cutout> = {}): Cutout => ({
  id: 'c1',
  shape: 'rectangle',
  x: 0,
  y: 0,
  width: 10,
  depth: 10,
  cutDepth: 5,
  rotation: 0,
  cornerRadius: 0,
  label: '',
  groupId: null,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useSvgExport', () => {
  it('downloads the selection under the design name', async () => {
    const { result } = renderHook(() => useSvgExport());

    expect(result.current.exportCutoutsAsSvg([cutout()])).toBe(true);
    expect(mockAddToast).not.toHaveBeenCalled();

    const [blob, name] = mockTriggerDownload.mock.calls[0];
    expect(name).toBe('Wrench Rail-cutouts.svg');
    expect(blob.type).toBe('image/svg+xml');
    await expect(blob.text()).resolves.toContain('<svg');
  });

  it('toasts and writes nothing when the selection has no outline', () => {
    const { result } = renderHook(() => useSvgExport());

    expect(result.current.exportCutoutsAsSvg([cutout({ shape: 'text' })])).toBe(false);
    expect(mockTriggerDownload).not.toHaveBeenCalled();
    expect(mockTrackEvent).not.toHaveBeenCalled();
    expect(mockAddToast).toHaveBeenCalledWith(expect.any(String), 'error');
  });

  it('reports the selection size to analytics', () => {
    const { result } = renderHook(() => useSvgExport());

    result.current.exportCutoutsAsSvg([cutout(), cutout({ id: 'c2', x: 20 })]);
    expect(mockTrackEvent).toHaveBeenCalledWith('cutout_svg_export', { shape_count: 2 });
  });
});

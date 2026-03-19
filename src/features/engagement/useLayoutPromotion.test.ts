import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useLayoutPromotion } from './useLayoutPromotion';

// Mock dependencies
vi.mock('@/core/store/library', () => ({
  useLibraryStore: vi.fn(),
}));

vi.mock('@/core/store/layout', () => ({
  useLayoutStore: vi.fn(),
}));

vi.mock('@/core/store/view', () => ({
  useViewStore: {
    getState: vi.fn(() => ({
      setShowLayoutManager: vi.fn(),
    })),
  },
}));

vi.mock('@/core/store/toast', () => ({
  useToastStore: {
    getState: vi.fn(() => ({
      addToast: vi.fn(),
    })),
  },
}));

vi.mock('./engagementTracker', () => ({
  shouldShowNudge: vi.fn(),
  recordNudgeDismissal: vi.fn(),
}));

vi.mock('@/shared/analytics/posthog', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

vi.mock('@/shared/utils', () => ({
  getGridBins: vi.fn((bins: unknown[]) =>
    bins.filter((b: Record<string, unknown>) => b.layerId !== '__staging__')
  ),
}));

import { useLibraryStore } from '@/core/store/library';
import { useLayoutStore } from '@/core/store/layout';
import { useToastStore } from '@/core/store/toast';
import { useViewStore } from '@/core/store/view';
import { shouldShowNudge, recordNudgeDismissal } from './engagementTracker';
import { trackEvent } from '@/shared/analytics/posthog';

const mockAddToast = vi.fn();
const mockSetShowLayoutManager = vi.fn();

function setupStores(layoutCount: number, binCount: number): void {
  const entries = Array.from({ length: layoutCount }, (_, i) => ({ id: `layout-${i}` }));
  const bins = Array.from({ length: binCount }, (_, i) => ({ id: `bin-${i}`, layerId: 'layer-1' }));

  (useLibraryStore as unknown as Mock).mockImplementation((selector: (s: unknown) => unknown) =>
    selector({ library: { entries } })
  );
  (useLayoutStore as unknown as Mock).mockImplementation((selector: (s: unknown) => unknown) =>
    selector({ layout: { bins } })
  );
}

describe('useLayoutPromotion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (shouldShowNudge as Mock).mockReturnValue(true);
    (useToastStore.getState as Mock).mockReturnValue({ addToast: mockAddToast });
    (useViewStore.getState as Mock).mockReturnValue({
      setShowLayoutManager: mockSetShowLayoutManager,
    });
  });

  it('does not show toast when binCount < 15', () => {
    setupStores(1, 10);

    renderHook(() => useLayoutPromotion());

    expect(mockAddToast).not.toHaveBeenCalled();
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('does not show toast when layoutCount >= 2', () => {
    setupStores(2, 20);

    renderHook(() => useLayoutPromotion());

    expect(mockAddToast).not.toHaveBeenCalled();
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('shows toast when binCount >= 15 AND layoutCount === 1 AND engagement gate passes', () => {
    setupStores(1, 20);

    renderHook(() => useLayoutPromotion());

    expect(trackEvent).toHaveBeenCalledWith('nudge_shown', { nudge_type: 'layout_promotion' });
    expect(mockAddToast).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'engagement.layoutPromotion.message',
        type: 'info',
        duration: 8000,
        action: expect.objectContaining({
          label: 'engagement.layoutPromotion.action',
        }),
      })
    );
  });

  it('does not show toast when shouldShowNudge returns false (cooldown)', () => {
    setupStores(1, 20);
    (shouldShowNudge as Mock).mockReturnValue(false);

    renderHook(() => useLayoutPromotion());

    expect(mockAddToast).not.toHaveBeenCalled();
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('opens layout manager when action is clicked', () => {
    setupStores(1, 20);

    renderHook(() => useLayoutPromotion());

    const toastArg = mockAddToast.mock.calls[0][0] as {
      action: { onClick: () => void };
    };
    toastArg.action.onClick();

    expect(trackEvent).toHaveBeenCalledWith('nudge_clicked', { nudge_type: 'layout_promotion' });
    expect(recordNudgeDismissal).toHaveBeenCalledWith('layout_promotion');
    expect(mockSetShowLayoutManager).toHaveBeenCalledWith(true);
  });

  it('only shows toast once per mount (shownRef guard)', () => {
    setupStores(1, 20);

    const { rerender } = renderHook(() => useLayoutPromotion());
    rerender();
    rerender();

    expect(mockAddToast).toHaveBeenCalledTimes(1);
  });
});

// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useEngagementNudges } from './useEngagementNudges';

vi.mock('@/core/store/toast', () => ({
  useToastStore: {
    getState: vi.fn(() => ({ addToast: vi.fn() })),
  },
}));

vi.mock('./engagementTracker', () => ({
  shouldShowNudge: vi.fn(),
  recordNudgeDismissal: vi.fn(),
  recordSessionStart: vi.fn(),
}));

vi.mock('@/shared/analytics/posthog', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('@/shared/analytics/posthog/conversionEvents', () => ({
  hasConvertedThisSession: vi.fn(),
}));

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

import { useToastStore } from '@/core/store/toast';
import { hasConvertedThisSession } from '@/shared/analytics/posthog/conversionEvents';
import { shouldShowNudge } from './engagementTracker';

const mockAddToast = vi.fn();

describe('useEngagementNudges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    (useToastStore.getState as Mock).mockReturnValue({ addToast: mockAddToast });
    (shouldShowNudge as Mock).mockReturnValue(false);
    // Default to "the user has received a file" so the existing gate cases stay
    // about the engagement gate rather than about conversion.
    (hasConvertedThisSession as Mock).mockReturnValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('only considers the feedback nudge on the timer — never Ko-fi', () => {
    renderHook(() => useEngagementNudges());

    vi.advanceTimersByTime(60_000);

    const askedNudgeTypes = (shouldShowNudge as Mock).mock.calls.map((c) => c[0]);
    expect(askedNudgeTypes).toContain('feedback_rating');
    expect(askedNudgeTypes).not.toContain('kofi_support');
  });

  it('shows the feedback nudge once when its gate passes', () => {
    (shouldShowNudge as Mock).mockReturnValue(true);
    renderHook(() => useEngagementNudges());

    vi.advanceTimersByTime(60_000);
    vi.advanceTimersByTime(60_000);

    expect(mockAddToast).toHaveBeenCalledTimes(1);
    expect(mockAddToast).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'engagement.feedbackNudge' })
    );
  });

  // On the plain timer the ask arrived mid-task and was almost never acted on.
  // The prompt is unchanged; only the moment is — after the user has actually
  // got a file out.
  it('withholds the nudge until a printable file has been produced', () => {
    (shouldShowNudge as Mock).mockReturnValue(true);
    (hasConvertedThisSession as Mock).mockReturnValue(false);
    renderHook(() => useEngagementNudges());

    vi.advanceTimersByTime(60_000);
    vi.advanceTimersByTime(60_000);

    expect(mockAddToast).not.toHaveBeenCalled();
  });

  it('does not consult the engagement gate before a conversion', () => {
    (hasConvertedThisSession as Mock).mockReturnValue(false);
    renderHook(() => useEngagementNudges());

    vi.advanceTimersByTime(60_000);

    expect(shouldShowNudge as Mock).not.toHaveBeenCalled();
  });
});

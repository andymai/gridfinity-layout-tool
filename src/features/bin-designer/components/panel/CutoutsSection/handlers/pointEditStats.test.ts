import { describe, it, expect, vi, beforeEach } from 'vitest';
import { countPointEdit, reportPointEdits } from './pointEditStats';
import { trackEvent } from '@/shared/analytics/posthog/trackEvent';

vi.mock('@/shared/analytics/posthog/trackEvent', () => ({ trackEvent: vi.fn() }));

describe('pointEditStats', () => {
  beforeEach(() => {
    reportPointEdits();
    vi.mocked(trackEvent).mockClear();
  });

  it('sends one event with a count for each tool used', () => {
    countPointEdit('move');
    countPointEdit('move');
    countPointEdit('pull');
    reportPointEdits();
    expect(trackEvent).toHaveBeenCalledOnce();
    expect(trackEvent).toHaveBeenCalledWith('cutout_points_edited', { edits: 3, move: 2, pull: 1 });
  });

  it('sends nothing for a session with no edits', () => {
    reportPointEdits();
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('starts the next session from zero', () => {
    countPointEdit('delete');
    reportPointEdits();
    countPointEdit('nudge');
    reportPointEdits();
    expect(trackEvent).toHaveBeenLastCalledWith('cutout_points_edited', { edits: 1, nudge: 1 });
  });
});

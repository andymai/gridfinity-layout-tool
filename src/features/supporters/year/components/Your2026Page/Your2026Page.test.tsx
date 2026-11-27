import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { trackEvent } from '@/shared/analytics/posthog';
import type { YearReviewData } from '../../hooks/useYearReviewData';
import type { YearStats } from '../../types';
import { Your2026Page } from './Your2026Page';

vi.mock('@/shared/analytics/posthog', () => ({ trackEvent: vi.fn() }));

const review: { data: YearReviewData } = { data: { status: 'loading' } };
vi.mock('../../hooks/useYearReviewData', () => ({
  useYearReviewData: () => review.data,
}));

vi.mock('../../../hooks/useSupportersData', () => ({
  useSupportersData: () => ({
    data: { supporters: Array.from({ length: 312 }, (_, i) => ({ name: `S${i}` })) },
    settled: true,
  }),
}));

const active: YearStats = {
  year: 2026,
  drawers: 2,
  binsPlaced: 12,
  drawerAreaMm2: 300_000,
  biggestDrawer: null,
  favouriteSize: null,
  designs: 0,
  busiestMonth: null,
  monthCounts: Array.from({ length: 12 }, () => 0),
  filament: null,
  longestPrint: null,
  complexityShortlist: [],
  exports: 0,
  type: { id: 'standardIssue', values: {} },
};
const empty: YearStats = { ...active, drawers: 0, binsPlaced: 0, drawerAreaMm2: 0 };

function visit(path: string) {
  window.history.replaceState(null, '', path);
  return render(<Your2026Page />);
}

beforeEach(() => {
  vi.mocked(trackEvent).mockClear();
  review.data = { status: 'ready', stats: active };
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 11, 5, 12));
});

afterEach(() => {
  vi.useRealTimers();
  window.history.replaceState(null, '', '/');
});

describe('Your2026Page', () => {
  it('sends a visit before the window home', () => {
    vi.setSystemTime(new Date(2026, 10, 27, 12));
    const { container } = visit('/your-2026');
    expect(container).toBeEmptyDOMElement();
    expect(window.location.pathname).toBe('/');
  });

  it('plays early with ?preview', () => {
    vi.setSystemTime(new Date(2026, 10, 27, 12));
    visit('/your-2026?preview');
    expect(screen.getByRole('heading', { name: 'Your year, in 42 mm steps.' })).toBeInTheDocument();
  });

  it('counts while the year loads', () => {
    review.data = { status: 'loading' };
    visit('/your-2026');
    expect(screen.getByRole('status')).toHaveTextContent('Counting your year');
  });

  it('shows an empty state to a device with no 2026 work', () => {
    review.data = { status: 'ready', stats: empty };
    visit('/your-2026');
    expect(
      screen.getByRole('heading', { name: 'Nothing from 2026 on this device yet.' })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Plan a drawer' }));
    expect(window.location.pathname).toBe('/');
  });

  it('reports the opening and where it came from', () => {
    visit('/your-2026?from=dock');
    expect(trackEvent).toHaveBeenCalledWith('your_2026_opened', { source: 'dock', demo: false });
  });

  it('opens on the thank-you card on the way back from the credits, without a second opening', () => {
    visit('/your-2026?card=thanks');
    expect(
      screen.getByRole('heading', { name: 'Free all year, thanks to 312 people.' })
    ).toBeInTheDocument();
    expect(trackEvent).not.toHaveBeenCalledWith('your_2026_opened', expect.anything());
    expect(trackEvent).toHaveBeenCalledWith('your_2026_finished');
  });

  it('rolls the credits and marks this card for the way back', () => {
    const states: string[] = [];
    const replace = window.history.replaceState.bind(window.history);
    vi.spyOn(window.history, 'replaceState').mockImplementation((data, unused, url) => {
      states.push(String(url));
      replace(data, unused, url);
    });
    visit('/your-2026?card=thanks');
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Roll the credits' }));
    });
    expect(states).toContain('/your-2026?card=thanks');
    expect(window.location.pathname + window.location.search).toBe('/supporters?from=your-2026');
  });

  it('opens Ko-fi from the thank-you card', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    visit('/your-2026?card=thanks');
    fireEvent.click(screen.getByRole('button', { name: 'Support on Ko-fi' }));
    expect(trackEvent).toHaveBeenCalledWith('kofi_clicked', { source: 'your_2026' });
    expect(open).toHaveBeenCalled();
  });
});

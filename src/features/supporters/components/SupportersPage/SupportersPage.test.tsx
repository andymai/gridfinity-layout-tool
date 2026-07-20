import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SupportersPage } from './SupportersPage';
import { trackEvent } from '@/shared/analytics/posthog';
import { KOFI_URL } from '@/shared/constants/links';
import supportersData from '../../data/supporters.json';
import { FALLBACK_SUPPORTERS, type SupportersData } from '../../utils/supportersData';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

vi.mock('@/shared/analytics/posthog', () => ({
  trackEvent: vi.fn(),
}));

// The WebGL layers can't render in jsdom; stub them so we can test the DOM overlays.
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: ReactNode }) => <div data-testid="canvas">{children}</div>,
}));
vi.mock('../SupportersScene', () => ({ SupportersScene: () => null }));

// Fetching is covered by useSupportersData's own tests; here we pin the data so
// these assertions stay about the DOM overlays.
const supportersState = { data: FALLBACK_SUPPORTERS, settled: true };
vi.mock('../../hooks/useSupportersData', () => ({
  useSupportersData: () => supportersState,
}));

describe('SupportersPage', () => {
  let openSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    supportersState.settled = true;
    supportersState.data = FALLBACK_SUPPORTERS;
    openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the accessible heading and count label', () => {
    render(<SupportersPage />);
    expect(screen.getByRole('heading', { name: 'supporters.heading' })).toBeInTheDocument();
    expect(screen.getByText('supporters.countLabel')).toBeInTheDocument();
  });

  it('lists every supporter for screen readers (named + anonymous)', () => {
    const firstNamed = supportersData.supporters.find((s) => s.name)?.name ?? '';
    const anonCount = supportersData.supporters.filter((s) => !s.name).length;
    render(<SupportersPage />);
    expect(screen.getByText(firstNamed)).toBeInTheDocument();
    // queryAllByText (not getAllByText) so the assertion holds even at 0 anonymous.
    expect(screen.queryAllByText('supporters.anonymous')).toHaveLength(anonCount);
  });

  it('never renders an email address', () => {
    const { container } = render(<SupportersPage />);
    expect(container.textContent ?? '').not.toContain('@');
  });

  it('fires kofi_clicked with the supporters_page source and opens Ko-fi', () => {
    render(<SupportersPage />);
    fireEvent.click(screen.getByText('supporters.cta.button'));
    expect(trackEvent).toHaveBeenCalledWith('kofi_clicked', { source: 'supporters_page' });
    expect(openSpy).toHaveBeenCalledWith(KOFI_URL, '_blank', 'noopener,noreferrer');
  });

  // Rendering the hero before the count is known would count up to the bundled
  // total and then restart at the real one.
  it('holds the hero until the supporter list settles', () => {
    supportersState.settled = false;
    render(<SupportersPage />);
    expect(screen.queryByText('supporters.countLabel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('canvas')).not.toBeInTheDocument();
  });

  describe('recency and messages (live data)', () => {
    const RICH: SupportersData = {
      supporters: [
        { name: 'Ada', joinedAt: '2026-07-10T00:00:00Z', message: 'a wonderful tool' },
        { name: 'Grace', joinedAt: '2026-06-01T00:00:00Z' },
        { name: 'Linus', joinedAt: '2026-05-01T00:00:00Z', message: 'saved me hours' },
        { name: 'Margaret', joinedAt: '2026-04-01T00:00:00Z' },
        { name: null, joinedAt: '2026-03-01T00:00:00Z' },
        { name: null, joinedAt: '2026-07-05T00:00:00Z' },
      ],
    };

    beforeEach(() => {
      // Fix only Date so joinedThisMonth / the sparkline window are deterministic;
      // rAF and setInterval stay real so the count-up and message rotation don't stall.
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-07-15T00:00:00Z'));
      supportersState.data = RICH;
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('shows how many joined this month', () => {
      render(<SupportersPage />);
      // Ada (07-10) + one anonymous (07-05) fall in July.
      expect(screen.getByText('supporters.thisMonth')).toBeInTheDocument();
    });

    it('shows the purpose line near the CTA', () => {
      render(<SupportersPage />);
      expect(screen.getByText('supporters.purpose')).toBeInTheDocument();
    });

    it('surfaces a public message near the CTA', () => {
      const { container } = render(<SupportersPage />);
      expect(container.textContent ?? '').toMatch(/a wonderful tool|saved me hours/);
    });

    it('reveals the sparkline once support spans enough months', () => {
      render(<SupportersPage />);
      expect(screen.getByLabelText('supporters.sparklineLabel')).toBeInTheDocument();
    });

    it('finds a bin by name and shows its thank-you card', () => {
      render(<SupportersPage />);
      fireEvent.change(screen.getByPlaceholderText('supporters.find.placeholder'), {
        target: { value: 'Ada' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'supporters.find.submit' }));
      expect(screen.getByText('supporters.thanksNamed')).toBeInTheDocument();
    });

    it('reports when no supporter matches the search', () => {
      render(<SupportersPage />);
      fireEvent.change(screen.getByPlaceholderText('supporters.find.placeholder'), {
        target: { value: 'Nobody' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'supporters.find.submit' }));
      expect(screen.getByText('supporters.find.notFound')).toBeInTheDocument();
    });
  });
});

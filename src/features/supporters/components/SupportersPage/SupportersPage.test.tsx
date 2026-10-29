import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SupportersPage } from './SupportersPage';
import { trackEvent } from '@/shared/analytics/posthog';
import { KOFI_URL } from '@/shared/constants/links';
import { FALLBACK_SUPPORTERS, type SupportersData } from '../../utils/supportersData';
import { hasSeenCredits, markCreditsSeen } from '../../utils/creditsSeen';
import type { SupporterStatus } from '../../api/supporterClient';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));
vi.mock('@/shared/analytics/posthog', () => ({ trackEvent: vi.fn() }));

// The WebGL layers can't render in jsdom; stub them so we can test the DOM overlays.
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: ReactNode }) => <div data-testid="canvas">{children}</div>,
}));
vi.mock('../SupportersScene', () => ({ SupportersScene: () => null }));

const motion = { reduced: false };
vi.mock('@/shared/hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => motion.reduced,
}));

// Fetching is covered by useSupportersData's own tests; here we pin the data so
// these assertions stay about the page.
const supportersState: { data: SupportersData; settled: boolean } = {
  data: FALLBACK_SUPPORTERS,
  settled: true,
};
vi.mock('../../hooks/useSupportersData', () => ({
  useSupportersData: () => supportersState,
}));

const NOT_A_SUPPORTER = { supporter: false, badgePublic: false, name: null, message: null };
const statusState: { status: SupporterStatus } = { status: NOT_A_SUPPORTER };
vi.mock('../../hooks/useSupporterStatus', () => ({
  useSupporterStatus: () => ({ ...statusState, settled: true, save: async () => null }),
}));

const LIVE: SupportersData = {
  supporters: [
    { name: 'Ada', joinedAt: '2026-07-10T00:00:00Z', message: 'a wonderful tool', department: 1 },
    { name: 'Grace', joinedAt: '2026-06-01T00:00:00Z', department: 4 },
    { name: 'Linus', joinedAt: '2026-05-01T00:00:00Z', department: 4 },
    { name: null, joinedAt: '2026-07-05T00:00:00Z' },
  ],
};

const find = (name: string) => {
  fireEvent.change(screen.getByPlaceholderText('supporters.find.placeholder'), {
    target: { value: name },
  });
  fireEvent.click(screen.getByRole('button', { name: 'supporters.find.submit' }));
};

describe('SupportersPage', () => {
  let openSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    motion.reduced = false;
    statusState.status = NOT_A_SUPPORTER;
    supportersState.settled = true;
    supportersState.data = LIVE;
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-07-15T00:00:00Z'));
    openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    // jsdom lays nothing out; stack the credits 50 px apart so the roll has a length.
    vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(function (
      this: HTMLElement
    ) {
      const credits = [...document.querySelectorAll('[data-credit-id]')];
      return Math.max(0, credits.indexOf(this)) * 50;
    });
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(50);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('a first visit', () => {
    it('opens on the title card and rolls the credits', () => {
      render(<SupportersPage />);
      expect(
        screen.getByText(/supporters\.credits\.victoryLine1/, { selector: '.sr-only' })
      ).toBeInTheDocument();
      expect(screen.getByRole('region', { name: 'supporters.credits.listLabel' })).toBeVisible();
      expect(screen.getByRole('button', { name: 'supporters.credits.skip' })).toBeInTheDocument();
      expect(screen.queryByText('supporters.credits.theEnd')).not.toBeInTheDocument();
    });

    it('credits every supporter, the anonymous one as a redaction', () => {
      render(<SupportersPage />);
      for (const name of ['Ada', 'Grace', 'Linus']) {
        expect(screen.getByRole('button', { name })).toBeInTheDocument();
      }
      expect(screen.getByRole('button', { name: 'supporters.anonymous' })).toBeInTheDocument();
      expect(screen.getByText('a wonderful tool')).toBeInTheDocument();
    });

    it('skips to the finale and remembers it was seen', () => {
      render(<SupportersPage />);
      fireEvent.click(screen.getByRole('button', { name: 'supporters.credits.skip' }));
      expect(screen.getByText('supporters.credits.theEnd')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'supporters.credits.skip' })).toBeNull();
      expect(hasSeenCredits()).toBe(true);
    });

    it('offers a quiet Ko-fi door while the credits roll', () => {
      render(<SupportersPage />);
      fireEvent.click(screen.getByRole('button', { name: 'supporters.cta.button' }));
      expect(trackEvent).toHaveBeenCalledWith('kofi_clicked', { source: 'supporters_credits' });
      expect(openSpy).toHaveBeenCalledWith(KOFI_URL, '_blank', 'noopener,noreferrer');
    });

    it('pauses on a found supporter and names their department', () => {
      render(<SupportersPage />);
      find('Ada');
      expect(screen.getByText('supporters.find.department')).toBeInTheDocument();
      expect(screen.getByText('supporters.thanksNamed')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'supporters.credits.play' })).toBeInTheDocument();
    });
  });

  it('drops an earlier selection when Tab moves to another credit', () => {
    render(<SupportersPage />);
    find('Ada');
    expect(screen.getByText('supporters.thanksNamed')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Tab' });
    fireEvent.focus(screen.getByRole('button', { name: 'Grace' }));
    expect(screen.queryByText('supporters.thanksNamed')).not.toBeInTheDocument();
  });

  it('does not celebrate a skip that came long after the roll started', () => {
    const start = performance.now();
    const now = vi.spyOn(performance, 'now').mockReturnValue(start);
    render(<SupportersPage />);
    now.mockReturnValue(start + 60_000);
    fireEvent.click(screen.getByRole('button', { name: 'supporters.credits.skip' }));
    expect(screen.queryByText('supporters.achievements.speedrunner')).not.toBeInTheDocument();
  });

  it('notices a supporter finding their own bin, even when sign-in lands afterwards', () => {
    const { rerender } = render(<SupportersPage />);
    find('Ada');
    expect(screen.queryByText('supporters.achievements.foundOwnBin')).not.toBeInTheDocument();
    statusState.status = { supporter: true, badgePublic: true, name: 'Ada', message: null };
    rerender(<SupportersPage />);
    expect(screen.getByText('supporters.achievements.foundOwnBin')).toBeInTheDocument();
  });

  it('celebrates a skip within three seconds', () => {
    render(<SupportersPage />);
    fireEvent.click(screen.getByRole('button', { name: 'supporters.credits.skip' }));
    expect(screen.getByText('supporters.achievements.speedrunner')).toBeInTheDocument();
  });

  describe('a shared credit link', () => {
    afterEach(() => window.history.replaceState(null, '', '/'));

    it('opens paused on its supporter, starring them, even after the credits were seen', () => {
      markCreditsSeen();
      window.history.replaceState(null, '', '/supporters?credit=Grace');
      render(<SupportersPage />);
      expect(screen.getByText('supporters.credits.nowStarring')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'supporters.credits.play' })).toBeInTheDocument();
      expect(screen.getByText('supporters.thanksNamed')).toBeInTheDocument();
    });

    it('opens normally for a name that is not in the credits', () => {
      window.history.replaceState(null, '', '/supporters?credit=Nobody');
      render(<SupportersPage />);
      expect(screen.queryByText('supporters.credits.nowStarring')).not.toBeInTheDocument();
    });
  });

  describe('a return visit', () => {
    beforeEach(() => markCreditsSeen());

    it('opens on the finale, with the count and the empty socket', () => {
      render(<SupportersPage />);
      expect(
        screen.getByRole('heading', { level: 1, name: /^4\s*supporters\.countLabel$/ })
      ).toBeInTheDocument();
      expect(screen.getByText('supporters.credits.theEnd')).toBeInTheDocument();
      expect(screen.getByText('supporters.thisMonth')).toBeInTheDocument();
    });

    it('fires kofi_clicked with the supporters_page source', () => {
      render(<SupportersPage />);
      fireEvent.click(screen.getByRole('button', { name: /supporters\.cta\.button/ }));
      expect(trackEvent).toHaveBeenCalledWith('kofi_clicked', { source: 'supporters_page' });
    });

    it('can replay the credits', () => {
      render(<SupportersPage />);
      fireEvent.click(screen.getByRole('button', { name: 'supporters.credits.replay' }));
      expect(screen.getByRole('button', { name: 'supporters.credits.skip' })).toBeInTheDocument();
    });

    it('reports when no supporter matches the search', () => {
      render(<SupportersPage />);
      find('Nobody');
      expect(screen.getByText('supporters.find.notFound')).toBeInTheDocument();
    });
  });

  describe('with reduced motion', () => {
    beforeEach(() => {
      motion.reduced = true;
    });

    it('shows the finale beside credits the visitor scrolls, with nothing to replay', () => {
      render(<SupportersPage />);
      expect(screen.getByText('supporters.credits.theEnd')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Ada' })).toBeVisible();
      expect(screen.queryByRole('button', { name: 'supporters.credits.skip' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'supporters.credits.replay' })).toBeNull();
    });
  });

  it('never renders an email address', () => {
    supportersState.data = FALLBACK_SUPPORTERS;
    const { container } = render(<SupportersPage />);
    expect(container.textContent ?? '').not.toContain('@');
  });

  // Rendering before the count is known would count up to the bundled total
  // and then restart at the real one.
  it('holds everything until the supporter list settles', () => {
    supportersState.settled = false;
    render(<SupportersPage />);
    expect(screen.queryByTestId('canvas')).not.toBeInTheDocument();
    expect(screen.queryByText('supporters.credits.listLabel')).not.toBeInTheDocument();
  });
});

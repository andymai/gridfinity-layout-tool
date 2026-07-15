import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SupportersPage } from './SupportersPage';
import { trackEvent } from '@/shared/analytics/posthog';
import { KOFI_URL } from '@/shared/constants/links';
import supportersData from '../../data/supporters.json';
import { FALLBACK_SUPPORTERS } from '../../utils/supportersData';

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
    render(<SupportersPage />);
    expect(screen.getByText(supportersData.named[0])).toBeInTheDocument();
    // queryAllByText (not getAllByText) so the assertion holds even at 0 anonymous.
    expect(screen.queryAllByText('supporters.anonymous')).toHaveLength(
      supportersData.anonymousCount
    );
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
});

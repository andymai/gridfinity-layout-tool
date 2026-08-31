import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HeaderSupportLinks } from './HeaderSupportLinks';

// Mock i18n
vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

vi.mock('@/shared/components/LanguageSelector', () => ({
  LanguageSelector: () => <div data-testid="language-selector" />,
}));

vi.mock('@/shared/analytics/posthog', () => ({
  trackEvent: vi.fn(),
}));

const mockAddToast = vi.fn();
vi.mock('@/core/store/toast', () => ({
  useToastStore: {
    getState: () => ({ addToast: mockAddToast }),
  },
}));

describe('HeaderSupportLinks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('renders language selector', () => {
    render(<HeaderSupportLinks />);
    expect(screen.getByTestId('language-selector')).toBeInTheDocument();
  });

  it('renders feedback button', () => {
    render(<HeaderSupportLinks />);
    expect(screen.getByLabelText('header.sendFeedback')).toBeInTheDocument();
  });

  it('renders help button', () => {
    render(<HeaderSupportLinks />);
    expect(screen.getByLabelText('header.helpAndShortcuts')).toBeInTheDocument();
  });

  it('renders the settings cog and opens settings via the global event (#4034)', () => {
    const dispatch = vi.spyOn(window, 'dispatchEvent');
    render(<HeaderSupportLinks />);
    fireEvent.click(screen.getByLabelText('sidebar.openSettings'));
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'open-settings-modal' }));
  });

  it('renders Ko-fi support button', () => {
    render(<HeaderSupportLinks />);
    expect(screen.getByLabelText('header.supportOnKofi')).toBeInTheDocument();
  });

  it('keeps the outbound links out of the bar until the overflow is opened', () => {
    render(<HeaderSupportLinks />);
    expect(screen.queryByText('header.starOnGithubLong')).not.toBeInTheDocument();
    expect(screen.queryByText('common.redditCommunity')).not.toBeInTheDocument();
    expect(screen.getByLabelText('header.moreLinks')).toHaveAttribute('aria-expanded', 'false');
  });

  it('renders GitHub and r/gridfinity as real links inside the overflow', () => {
    render(<HeaderSupportLinks />);

    fireEvent.click(screen.getByLabelText('header.moreLinks'));

    expect(screen.getByText('header.starOnGithubLong').closest('a')).toHaveAttribute(
      'href',
      'https://github.com/andymai/gridfinity-layout-tool'
    );
    expect(screen.getByText('common.redditCommunity').closest('a')).toHaveAttribute(
      'href',
      'https://www.reddit.com/r/gridfinity/'
    );
  });

  it('closes the overflow on a second click of the trigger', () => {
    render(<HeaderSupportLinks />);
    const trigger = screen.getByLabelText('header.moreLinks');

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('header.starOnGithubLong')).not.toBeInTheDocument();
  });

  it('opens GitHub Issues on feedback click', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(<HeaderSupportLinks />);

    fireEvent.click(screen.getByLabelText('header.sendFeedback'));

    expect(openSpy).toHaveBeenCalledWith(
      'https://github.com/andymai/gridfinity-layout-tool/issues',
      '_blank',
      'noopener,noreferrer'
    );
  });

  it('shows Ko-fi thank-you toast after feedback click', () => {
    vi.spyOn(window, 'open').mockImplementation(() => null);
    render(<HeaderSupportLinks />);

    fireEvent.click(screen.getByLabelText('header.sendFeedback'));
    vi.advanceTimersByTime(1000);

    expect(mockAddToast).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'engagement.feedbackThankYou',
        type: 'success',
      })
    );
  });

  it('dispatches open-help-modal event on help click', () => {
    const handler = vi.fn();
    window.addEventListener('open-help-modal', handler);

    render(<HeaderSupportLinks />);
    fireEvent.click(screen.getByLabelText('header.helpAndShortcuts'));

    expect(handler).toHaveBeenCalledOnce();
    window.removeEventListener('open-help-modal', handler);
  });

  it('opens Ko-fi on support click', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(<HeaderSupportLinks />);

    fireEvent.click(screen.getByLabelText('header.supportOnKofi'));

    expect(openSpy).toHaveBeenCalledWith(
      'https://ko-fi.com/andyaragon',
      '_blank',
      'noopener,noreferrer'
    );
  });

  describe('compact', () => {
    it('leaves only the language selector and the overflow in the bar', () => {
      render(<HeaderSupportLinks compact />);
      expect(screen.getByTestId('language-selector')).toBeInTheDocument();
      expect(screen.getByLabelText('header.moreLinks')).toBeInTheDocument();
      expect(screen.queryByLabelText('header.sendFeedback')).toBeNull();
      expect(screen.queryByLabelText('header.helpAndShortcuts')).toBeNull();
      expect(screen.queryByLabelText('header.supportOnKofi')).toBeNull();
    });

    it('still reaches every action through the overflow', () => {
      render(<HeaderSupportLinks compact />);
      fireEvent.click(screen.getByLabelText('header.moreLinks'));

      expect(screen.getByRole('menuitem', { name: 'header.sendFeedback' })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'header.helpAndShortcuts' })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'header.supportOnKofi' })).toBeInTheDocument();
      expect(screen.getByText('header.starOnGithubLong')).toBeInTheDocument();
    });

    it('dispatches the help event from the overflow', () => {
      const handler = vi.fn();
      window.addEventListener('open-help-modal', handler);
      render(<HeaderSupportLinks compact />);

      fireEvent.click(screen.getByLabelText('header.moreLinks'));
      fireEvent.click(screen.getByRole('menuitem', { name: 'header.helpAndShortcuts' }));

      expect(handler).toHaveBeenCalledOnce();
      window.removeEventListener('open-help-modal', handler);
    });
  });
});

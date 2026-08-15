import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SupporterBadge } from './SupporterBadge';

const trackEvent = vi.fn();
vi.mock('@/shared/analytics/posthog', () => ({
  trackEvent: (...args: unknown[]) => trackEvent(...args),
}));

describe('SupporterBadge', () => {
  beforeEach(() => {
    trackEvent.mockClear();
    window.history.pushState(null, '', '/community');
  });

  afterEach(() => {
    window.history.pushState(null, '', '/');
  });

  it('renders the supporter label', () => {
    render(<SupporterBadge source="community_card" />);
    expect(screen.getByText('Supporter')).toBeInTheDocument();
  });

  it('carries an accessible name that explains what the badge means', () => {
    render(<SupporterBadge source="community_card" />);
    expect(screen.getByRole('button', { name: /Ko-fi supporter/i })).toBeInTheDocument();
  });

  it('navigates to the supporters wall', async () => {
    render(<SupporterBadge source="community_card" />);
    await userEvent.click(screen.getByRole('button'));
    expect(window.location.pathname).toBe('/supporters');
  });

  it('reports where the click came from', async () => {
    render(<SupporterBadge source="community_detail" />);
    await userEvent.click(screen.getByRole('button'));
    expect(trackEvent).toHaveBeenCalledWith('supporters_page_opened', {
      source: 'community_detail',
    });
  });

  it('does not let the click reach the card it sits inside', async () => {
    const onCardClick = vi.fn();
    render(
      // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events -- stand-in for the clickable card wrapper
      <div onClick={onCardClick}>
        <SupporterBadge source="community_card" />
      </div>
    );
    await userEvent.click(screen.getByRole('button'));
    expect(onCardClick).not.toHaveBeenCalled();
  });
});

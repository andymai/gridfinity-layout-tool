// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/shared/analytics/posthog', () => ({
  trackEvent: vi.fn(),
}));

const responsive = { isMobile: true, isTablet: false, isDesktop: false, isLandscape: false };
vi.mock('@/shared/hooks/useResponsive', () => ({
  useResponsive: () => responsive,
}));

import { trackEvent } from '@/shared/analytics/posthog';
import { useSessionStore } from '@/core/sync/session/useSession';
import { MobileHandoffBanner } from './MobileHandoffBanner';

beforeEach(() => {
  responsive.isMobile = true;
  useSessionStore.setState({ status: 'anonymous', user: null });
  vi.mocked(trackEvent).mockClear();
});

describe('MobileHandoffBanner', () => {
  it('offers sign-in on mobile for anonymous users and tracks the impression', () => {
    render(<MobileHandoffBanner />);

    expect(screen.getByRole('link', { name: /google/i })).toHaveAttribute(
      'href',
      '/api/auth/login/google'
    );
    expect(screen.getByRole('link', { name: /github/i })).toHaveAttribute(
      'href',
      '/api/auth/login/github'
    );
    expect(trackEvent).toHaveBeenCalledWith('mobile_handoff', { action: 'shown' });
  });

  it('renders nothing on desktop', () => {
    responsive.isMobile = false;

    const { container } = render(<MobileHandoffBanner />);

    expect(container).toBeEmptyDOMElement();
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('renders nothing for signed-in users', () => {
    useSessionStore.setState({
      status: 'authenticated',
      user: { userId: 'u1', email: 'a@b.c', provider: 'google' },
    });

    const { container } = render(<MobileHandoffBanner />);

    expect(container).toBeEmptyDOMElement();
  });
});

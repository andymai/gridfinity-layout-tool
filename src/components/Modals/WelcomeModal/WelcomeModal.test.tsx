import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WelcomeModal } from './WelcomeModal';
import { resetAllStores } from '@/test/testUtils';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => {
    if (key === 'onboarding.welcome.title') return 'Welcome';
    if (key === 'common.getStarted') return 'Get Started';
    return key;
  },
}));

vi.mock('@/hooks', () => ({
  useLayoutSwitcher: () => ({
    importLayoutFromJSON: vi.fn(),
    switchLayout: vi.fn(),
  }),
}));

vi.mock('@/shared/hooks', () => ({
  useResponsive: () => ({ isMobile: false, isDesktop: true }),
}));

vi.mock('@/shared/analytics/posthog', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('@/features/inspiration-gallery/components/LayoutThumbnailWithLabels', () => ({
  LayoutThumbnailWithLabels: () => <div data-testid="layout-thumbnail" />,
}));

describe('WelcomeModal', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  it('renders without crashing when open', () => {
    const onClose = vi.fn();
    render(<WelcomeModal isOpen={true} onClose={onClose} />);
  });

  it('renders nothing when closed', () => {
    const onClose = vi.fn();
    const { container } = render(<WelcomeModal isOpen={false} onClose={onClose} />);
    expect(container.firstChild).toBeNull();
  });

  it('displays title when open', () => {
    const onClose = vi.fn();
    render(<WelcomeModal isOpen={true} onClose={onClose} />);
    expect(screen.getByText('Welcome')).toBeInTheDocument();
  });
});

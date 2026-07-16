import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WelcomeModal } from './WelcomeModal';
import { resetAllStores } from '@/test/testUtils';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => {
    if (key === 'onboarding.welcome.title') return 'Welcome';
    if (key === 'onboarding.welcome.desktopNudge') return 'This tool works best on desktop.';
    if (key === 'onboarding.welcome.startDesigning') return 'Start designing';
    if (key === 'common.getStarted') return 'Get Started';
    return key;
  },
  useLocale: () => ({ locale: 'en' }),
}));

const mockUseResponsive = vi.fn();
vi.mock('@/shared/hooks', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useLayoutSwitcher: () => ({
    importLayoutFromJSON: vi.fn(),
    switchLayout: vi.fn(),
  }),
  useResponsive: () => mockUseResponsive(),
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
    mockUseResponsive.mockReturnValue({ isMobile: false, isDesktop: true });
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

  describe('desktop', () => {
    beforeEach(() => {
      mockUseResponsive.mockReturnValue({ isMobile: false, isDesktop: true });
    });

    it('shows template cards', () => {
      render(<WelcomeModal isOpen={true} onClose={vi.fn()} />);
      expect(screen.getAllByTestId('layout-thumbnail').length).toBeGreaterThan(0);
    });

    it('does not show desktop nudge message', () => {
      render(<WelcomeModal isOpen={true} onClose={vi.fn()} />);
      expect(screen.queryByText('This tool works best on desktop.')).not.toBeInTheDocument();
    });
  });

  describe('mobile', () => {
    beforeEach(() => {
      mockUseResponsive.mockReturnValue({ isMobile: true, isDesktop: false });
    });

    it('shows desktop nudge message', () => {
      render(<WelcomeModal isOpen={true} onClose={vi.fn()} />);
      expect(screen.getByText('This tool works best on desktop.')).toBeInTheDocument();
    });

    it('does not render template cards', () => {
      render(<WelcomeModal isOpen={true} onClose={vi.fn()} />);
      expect(screen.queryAllByTestId('layout-thumbnail')).toHaveLength(0);
    });

    it('shows "Start designing" button that calls onClose with blank', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(<WelcomeModal isOpen={true} onClose={onClose} />);

      const button = screen.getByText('Start designing');
      await user.click(button);
      expect(onClose).toHaveBeenCalledWith('blank');
    });
  });
});

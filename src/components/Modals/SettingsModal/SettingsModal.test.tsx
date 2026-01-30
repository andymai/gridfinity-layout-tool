import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SettingsModal } from './SettingsModal';

vi.mock('@/shared/hooks', () => ({
  useResponsive: () => ({ isMobile: false, isTablet: false, isDesktop: true }),
}));

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

vi.mock('./TabNavigation/TabNavigation', () => ({
  TabNavigation: ({
    activeTab,
    onTabChange,
  }: {
    activeTab: string;
    onTabChange: (tab: string) => void;
  }) => (
    <nav role="tablist" data-testid="tab-nav">
      <button role="tab" onClick={() => onTabChange('general')}>
        {activeTab}
      </button>
    </nav>
  ),
}));

vi.mock('./tabs/GeneralTab/GeneralTab', () => ({
  GeneralTab: () => <div data-testid="general-tab">General</div>,
}));
vi.mock('./tabs/DefaultsTab/DefaultsTab', () => ({
  DefaultsTab: () => <div data-testid="defaults-tab">Defaults</div>,
}));
vi.mock('./tabs/IntegrationsTab/IntegrationsTab', () => ({
  IntegrationsTab: () => <div data-testid="integrations-tab">Integrations</div>,
}));
vi.mock('./tabs/PrivacyTab/PrivacyTab', () => ({
  PrivacyTab: () => <div data-testid="privacy-tab">Privacy</div>,
}));
vi.mock('./tabs/LabsTab/LabsTab', () => ({
  LabsTab: () => <div data-testid="labs-tab">Labs</div>,
}));

describe('SettingsModal', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('renders nothing when closed', () => {
    const { container } = render(<SettingsModal isOpen={false} onClose={vi.fn()} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders dialog when open', () => {
    render(<SettingsModal isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('renders general tab by default', () => {
    render(<SettingsModal isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByTestId('general-tab')).toBeInTheDocument();
  });

  it('renders specified initial tab', () => {
    render(<SettingsModal isOpen={true} onClose={vi.fn()} initialTab="defaults" />);
    expect(screen.getByTestId('defaults-tab')).toBeInTheDocument();
  });

  it('displays settings title', () => {
    render(<SettingsModal isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText('settings.title')).toBeInTheDocument();
  });
});

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SettingsModal } from './SettingsModal';

const mockOnClose = vi.hoisted(() => vi.fn());

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
    <div role="tablist" data-testid="tab-nav">
      <button role="tab" onClick={() => onTabChange('general')}>
        {activeTab}
      </button>
    </div>
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

vi.mock('@/core/store', () => ({
  useSettingsStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ resetSettings: vi.fn() }),
}));

vi.mock('@/core/store/toast', () => ({
  useToastStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ addToast: vi.fn() }),
}));

vi.mock('@/shared/components/ConfirmDialog', () => ({
  ConfirmDialog: () => null,
}));

vi.mock('@/features/onboarding/hooks/useOnboarding', () => ({
  resetOnboarding: vi.fn(),
}));

describe('SettingsModal', () => {
  beforeEach(() => {
    sessionStorage.clear();
    mockOnClose.mockClear();
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

  it('renders reset all settings button', () => {
    render(<SettingsModal isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText('settings.resetTabDefaults')).toBeInTheDocument();
  });

  it('renders legal links in footer', () => {
    render(<SettingsModal isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText('settings.privacyPolicy')).toBeInTheDocument();
    expect(screen.getByText('settings.termsOfService')).toBeInTheDocument();
  });

  it('renders reset onboarding button in footer', () => {
    render(<SettingsModal isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText('settings.resetOnboarding')).toBeInTheDocument();
  });

  it('Escape key calls onClose', () => {
    render(<SettingsModal isOpen={true} onClose={mockOnClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('clicking overlay calls onClose', () => {
    render(<SettingsModal isOpen={true} onClose={mockOnClose} />);
    // The overlay is the outermost presentation div (backdrop with onClick={onClose})
    const overlay = screen.getAllByRole('presentation')[0];
    fireEvent.click(overlay);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('clicking modal content does NOT call onClose', () => {
    render(<SettingsModal isOpen={true} onClose={mockOnClose} />);
    const dialog = screen.getByRole('dialog');
    fireEvent.click(dialog);
    expect(mockOnClose).not.toHaveBeenCalled();
  });
});

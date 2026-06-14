import type * as DesignSystem from '@/design-system';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SettingSection } from './SettingSection';
import { SettingsNavProvider } from '../../SettingsModalContext';

const mockResetSettingKeys = vi.hoisted(() => vi.fn());
const mockAddToast = vi.hoisted(() => vi.fn());

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

vi.mock('@/core/store', () => ({
  useSettingsStore: Object.assign(() => undefined, {
    getState: () => ({ resetSettingKeys: mockResetSettingKeys }),
  }),
}));

vi.mock('@/core/store/toast', () => ({
  useToastStore: Object.assign(() => undefined, {
    getState: () => ({ addToast: mockAddToast }),
  }),
  INITIAL_TOAST_STATE: {},
}));

vi.mock('@/design-system', async (importActual) => {
  const actual = await importActual<typeof DesignSystem>();
  return {
    ...actual,
    ConfirmDialog: ({
      isOpen,
      onConfirm,
      confirmText,
    }: {
      isOpen: boolean;
      onConfirm: () => void;
      confirmText: string;
    }) =>
      isOpen ? (
        <button data-testid="confirm" onClick={onConfirm}>
          {confirmText}
        </button>
      ) : null,
  };
});

describe('SettingSection', () => {
  beforeEach(() => {
    mockResetSettingKeys.mockClear();
    mockAddToast.mockClear();
  });

  it('renders title and hint', () => {
    render(
      <SettingSection id="x" title="My Section" hint="Some hint">
        <p>content</p>
      </SettingSection>
    );
    expect(screen.getByText('My Section')).toBeInTheDocument();
    expect(screen.getByText('Some hint')).toBeInTheDocument();
    expect(screen.getByText('content')).toBeInTheDocument();
  });

  it('shows no reset control without resetKeys or onReset', () => {
    render(
      <SettingSection id="x" title="X">
        <p>content</p>
      </SettingSection>
    );
    expect(screen.queryByText('settings.section.reset')).not.toBeInTheDocument();
  });

  it('resets the given keys after confirmation and toasts', () => {
    render(
      <SettingSection id="x" title="X" resetKeys={['theme', 'accentColor']}>
        <p>content</p>
      </SettingSection>
    );
    fireEvent.click(screen.getByText('settings.section.reset'));
    fireEvent.click(screen.getByTestId('confirm'));
    expect(mockResetSettingKeys).toHaveBeenCalledWith(['theme', 'accentColor']);
    expect(mockAddToast).toHaveBeenCalled();
  });

  it('invokes a custom onReset instead of the store when provided', () => {
    const onReset = vi.fn();
    render(
      <SettingSection id="x" title="X" onReset={onReset}>
        <p>content</p>
      </SettingSection>
    );
    fireEvent.click(screen.getByText('settings.section.reset'));
    fireEvent.click(screen.getByTestId('confirm'));
    expect(onReset).toHaveBeenCalled();
    expect(mockResetSettingKeys).not.toHaveBeenCalled();
  });

  it('hides the reset control when resetDisabled', () => {
    render(
      <SettingSection id="x" title="X" resetKeys={['theme']} resetDisabled>
        <p>content</p>
      </SettingSection>
    );
    expect(screen.queryByText('settings.section.reset')).not.toBeInTheDocument();
  });

  it('applies a highlight ring when it is the active search target', () => {
    const { container } = render(
      <SettingsNavProvider value={{ navigateToSection: vi.fn(), highlightedSectionId: 'target' }}>
        <SettingSection id="target" title="X">
          <p>content</p>
        </SettingSection>
      </SettingsNavProvider>
    );
    expect(container.querySelector('#target')?.className).toContain('ring-accent');
  });
});

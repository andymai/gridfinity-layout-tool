import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SettingSection } from './SettingSection';
import { SettingsNavProvider } from '../../SettingsModalContext';

const mockResetSettingKeys = vi.hoisted(() => vi.fn());
const mockUpdateSettings = vi.hoisted(() => vi.fn());
const mockAddToast = vi.hoisted(() => vi.fn());
const mockSettings = vi.hoisted(() => ({ theme: 'dark', accentColor: 'amber' }));

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

vi.mock('@/core/store', () => ({
  useSettingsStore: Object.assign(() => undefined, {
    getState: () => ({
      settings: mockSettings,
      resetSettingKeys: mockResetSettingKeys,
      updateSettings: mockUpdateSettings,
    }),
  }),
}));

vi.mock('@/core/store/toast', () => ({
  useToastStore: Object.assign(() => undefined, {
    getState: () => ({ addToast: mockAddToast }),
  }),
  INITIAL_TOAST_STATE: {},
}));

describe('SettingSection', () => {
  beforeEach(() => {
    mockResetSettingKeys.mockClear();
    mockUpdateSettings.mockClear();
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

  it('resets the given keys immediately (no confirmation) and toasts', () => {
    render(
      <SettingSection id="x" title="X" resetKeys={['theme', 'accentColor']}>
        <p>content</p>
      </SettingSection>
    );
    fireEvent.click(screen.getByText('settings.section.reset'));
    expect(mockResetSettingKeys).toHaveBeenCalledWith(['theme', 'accentColor']);
    expect(mockAddToast).toHaveBeenCalledTimes(1);
  });

  it('offers an Undo action that restores the previous values', () => {
    render(
      <SettingSection id="x" title="X" resetKeys={['theme', 'accentColor']}>
        <p>content</p>
      </SettingSection>
    );
    fireEvent.click(screen.getByText('settings.section.reset'));
    const toast = mockAddToast.mock.calls[0][0];
    expect(toast.action.label).toBe('common.undo');
    toast.action.onClick();
    expect(mockUpdateSettings).toHaveBeenCalledWith({ theme: 'dark', accentColor: 'amber' });
  });

  it('invokes a custom onReset instead of the store when provided', () => {
    const onReset = vi.fn();
    render(
      <SettingSection id="x" title="X" onReset={onReset}>
        <p>content</p>
      </SettingSection>
    );
    fireEvent.click(screen.getByText('settings.section.reset'));
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

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { GeneralTab } from './GeneralTab';

const mockUpdateSetting = vi.hoisted(() => vi.fn());
const mockSetLocale = vi.hoisted(() => vi.fn());
const mockDetectBrowserLocale = vi.hoisted(() => vi.fn(() => 'en'));

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
  useLocale: () => ({ locale: 'en', setLocale: mockSetLocale }),
  SUPPORTED_LOCALES: [
    { code: 'en', nativeName: 'English', englishName: 'English' },
    { code: 'nb', nativeName: 'Norsk bokmål', englishName: 'Norwegian Bokmål' },
  ],
  detectBrowserLocale: mockDetectBrowserLocale,
}));

vi.mock('zustand/shallow', () => ({
  useShallow: (fn: unknown) => fn,
}));

vi.mock('@/core/store', () => ({
  useSettingsStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      settings: { locale: 'auto' },
      updateSetting: mockUpdateSetting,
    }),
}));

describe('GeneralTab', () => {
  it('renders language section', () => {
    render(<GeneralTab />);
    expect(screen.getByText('settings.language')).toBeInTheDocument();
  });

  it('renders auto-detect radio option', () => {
    render(<GeneralTab />);
    expect(screen.getByText('settings.autoDetect')).toBeInTheDocument();
    const autoRadio = screen.getByText('settings.autoDetect').closest('[role="radio"]');
    expect(autoRadio).toHaveAttribute('aria-checked', 'true');
  });

  it('renders all supported locale options with native names', () => {
    render(<GeneralTab />);
    expect(screen.getByText('English')).toBeInTheDocument();
    expect(screen.getByText('Norsk bokmål')).toBeInTheDocument();
  });

  it('clicking auto-detect calls updateSetting and setLocale', () => {
    render(<GeneralTab />);
    const autoOption = screen.getByText('settings.autoDetect').closest('[role="radio"]')!;
    fireEvent.click(autoOption);
    expect(mockUpdateSetting).toHaveBeenCalledWith('locale', 'auto');
    expect(mockSetLocale).toHaveBeenCalledWith('en');
  });

  it('clicking a specific locale calls updateSetting and setLocale', () => {
    render(<GeneralTab />);
    const nbOption = screen.getByText('Norsk bokmål').closest('[role="radio"]')!;
    fireEvent.click(nbOption);
    expect(mockUpdateSetting).toHaveBeenCalledWith('locale', 'nb');
    expect(mockSetLocale).toHaveBeenCalledWith('nb');
  });

  it('keyboard Enter/Space on locale triggers selection', () => {
    render(<GeneralTab />);
    const nbOption = screen.getByText('Norsk bokmål').closest('[role="radio"]')!;
    fireEvent.keyDown(nbOption, { key: 'Enter' });
    expect(mockUpdateSetting).toHaveBeenCalledWith('locale', 'nb');
    mockUpdateSetting.mockClear();
    fireEvent.keyDown(nbOption, { key: ' ' });
    expect(mockUpdateSetting).toHaveBeenCalledWith('locale', 'nb');
  });
});

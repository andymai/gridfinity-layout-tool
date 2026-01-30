import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { GeneralTab } from './GeneralTab';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
  useLocale: () => ({ locale: 'en', setLocale: vi.fn() }),
  SUPPORTED_LOCALES: [{ code: 'en', nativeName: 'English', englishName: 'English' }],
  detectBrowserLocale: () => 'en',
}));

vi.mock('zustand/shallow', () => ({
  useShallow: (fn: unknown) => fn,
}));

vi.mock('@/core/store', () => ({
  useSettingsStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      settings: { locale: 'auto' },
      updateSetting: vi.fn(),
    }),
}));

vi.mock('@/core/store/toast', () => ({
  useToastStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ addToast: vi.fn() }),
}));

vi.mock('@/features/onboarding/hooks/useOnboarding', () => ({
  resetOnboarding: vi.fn(),
}));

describe('GeneralTab', () => {
  it('renders language section', () => {
    render(<GeneralTab />);
    expect(screen.getByText('settings.language')).toBeInTheDocument();
  });

  it('renders onboarding reset section', () => {
    render(<GeneralTab />);
    expect(screen.getAllByText('settings.resetOnboarding').length).toBeGreaterThan(0);
  });

  it('renders reset to defaults button', () => {
    render(<GeneralTab />);
    expect(screen.getByText('settings.resetTabDefaults')).toBeInTheDocument();
  });
});

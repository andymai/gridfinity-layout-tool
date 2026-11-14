import { act, render, screen, fireEvent } from '@testing-library/react';
import { beforeAll, beforeEach, describe, it, expect, vi } from 'vitest';
import { GeneralTab } from './GeneralTab';
import { useSpaceMouseStore } from '@/shared/spacemouse/settingsStore';
import { captureInstallPrompt } from '@/shared/pwa/installPrompt';

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

  it('renders each locale option as a radio with correct checked state', () => {
    render(<GeneralTab />);
    const autoOption = screen.getByText('settings.autoDetect').closest('[role="radio"]');
    const nbOption = screen.getByText('Norsk bokmål').closest('[role="radio"]');
    expect(autoOption).toHaveAttribute('aria-checked', 'true');
    expect(nbOption).toHaveAttribute('aria-checked', 'false');
  });

  describe('SpaceMouse', () => {
    beforeEach(() => {
      useSpaceMouseStore.setState({ enabled: false });
    });

    it('is off by default and shows no tuning', () => {
      render(<GeneralTab />);
      expect(screen.getByRole('switch', { name: 'settings.spacemouseEnable' })).not.toBeChecked();
      expect(screen.queryByText('spacemouse.sensitivity')).not.toBeInTheDocument();
    });

    it('turning it on stores the choice and reveals the tuning', () => {
      render(<GeneralTab />);
      fireEvent.click(screen.getByRole('switch', { name: 'settings.spacemouseEnable' }));
      expect(useSpaceMouseStore.getState().enabled).toBe(true);
      expect(screen.getByText('spacemouse.status.idle')).toBeInTheDocument();
    });
  });

  describe('Install app', () => {
    beforeAll(() => {
      captureInstallPrompt();
    });

    beforeEach(() => {
      window.dispatchEvent(new Event('appinstalled'));
      localStorage.clear();
    });

    it('points to the browser when the app cannot prompt an install', () => {
      render(<GeneralTab />);
      expect(screen.getByText('settings.general.installAppManual')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'pwaInstall.install' })).not.toBeInTheDocument();
    });

    it('opens the browser install dialog from the Install button', () => {
      const prompt = vi.fn().mockResolvedValue(undefined);
      act(() => {
        window.dispatchEvent(
          Object.assign(new Event('beforeinstallprompt'), {
            prompt,
            userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
          })
        );
      });
      render(<GeneralTab />);

      fireEvent.click(screen.getByRole('button', { name: 'pwaInstall.install' }));

      expect(prompt).toHaveBeenCalledTimes(1);
    });

    it('says the app is installed after an install that stays in the tab', () => {
      render(<GeneralTab />);

      act(() => {
        window.dispatchEvent(new Event('appinstalled'));
      });

      expect(screen.getByText('settings.general.installAppInstalledInBrowser')).toBeInTheDocument();
      expect(screen.queryByText('settings.general.installAppManual')).not.toBeInTheDocument();
    });

    it('shows the installed note when the tab moves into the app window', () => {
      const originalMatchMedia = window.matchMedia;
      let standalone = false;
      const listeners = new Set<() => void>();
      window.matchMedia = (query: string) =>
        ({
          media: query,
          get matches() {
            return standalone && query.includes('standalone');
          },
          addEventListener: (_type: string, cb: () => void) => listeners.add(cb),
          removeEventListener: (_type: string, cb: () => void) => listeners.delete(cb),
        }) as unknown as MediaQueryList;
      try {
        render(<GeneralTab />);
        expect(screen.queryByText('settings.general.installAppInstalled')).not.toBeInTheDocument();

        act(() => {
          standalone = true;
          for (const cb of listeners) cb();
        });

        expect(screen.getByText('settings.general.installAppInstalled')).toBeInTheDocument();
      } finally {
        window.matchMedia = originalMatchMedia;
      }
    });
  });
});

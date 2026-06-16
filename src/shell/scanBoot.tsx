/**
 * Isolated boot for the `/scan/:token` capture page.
 *
 * Dynamically imported from `main.tsx` so the mobile capture route never pulls
 * the editor, the 3D/generation bundle, or the layout/library store hydration.
 * Mounts only the providers the page needs.
 */

import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from '@/shell/ErrorBoundary';
import { LocaleProvider } from '@/i18n/context';
import { detectBrowserLocale } from '@/i18n/detection';
import { isLocale } from '@/i18n/types';
import type { Locale } from '@/i18n/types';
import { useSettingsStore } from '@/core/store/settings';
import { getScanToken } from '@/features/scan-capture';
// ScanPage is imported from its module (not the feature barrel) so the tracer
// it pulls stays in this lazy chunk and never leaks into the eager main bundle.
import { ScanPage } from '@/features/scan-capture/components/ScanPage';

export function runScanBoot(): void {
  const rootElement = document.getElementById('root');
  if (!rootElement) throw new Error('Root element not found');

  const saved = useSettingsStore.getState().settings.locale;
  const initialLocale: Locale = saved !== 'auto' && isLocale(saved) ? saved : detectBrowserLocale();
  document.documentElement.lang = initialLocale === 'pt-BR' ? 'pt' : initialLocale;

  const token = getScanToken();
  if (!token) {
    // No valid token — this route only makes sense with one. Send them home
    // rather than mounting a capture page that would POST to a tokenless URL.
    window.location.replace('/');
    return;
  }

  createRoot(rootElement).render(
    <ErrorBoundary>
      <LocaleProvider
        initialLocale={initialLocale}
        onLocaleChange={(locale) => useSettingsStore.getState().updateSetting('locale', locale)}
      >
        <ScanPage token={token} />
      </LocaleProvider>
    </ErrorBoundary>
  );
}

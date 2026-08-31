import { Suspense, useEffect, useState } from 'react';
import { useTranslation } from '@/i18n';
import { lazyWithRetry, namedExport } from '@/shared/utils/lazyWithRetry';
import { LoadingFallback } from '@/shared/components/LoadingFallback';
import type { SettingsTabId } from './types';

const SettingsModal = lazyWithRetry(() =>
  import('./SettingsModal').then(namedExport('SettingsModal'))
);

/**
 * Global host for the app-wide settings modal. Mounted once at the app root so
 * the `open-settings-modal` event opens settings from every view (the header
 * cog, the sidebar account link, the command palette), not just the layout
 * sidebar (#4034). Dispatchers may carry a `detail.tab` to deep-link a tab, or
 * omit the detail entirely.
 */
export function GlobalSettingsModal() {
  const t = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [initialTab, setInitialTab] = useState<SettingsTabId | undefined>(undefined);

  useEffect(() => {
    const handleOpen = (e: Event) => {
      const detail = (e as CustomEvent<{ tab?: SettingsTabId } | null>).detail;
      setInitialTab(detail?.tab);
      setIsOpen(true);
    };
    window.addEventListener('open-settings-modal', handleOpen);
    return () => window.removeEventListener('open-settings-modal', handleOpen);
  }, []);

  if (!isOpen) return null;
  return (
    <Suspense fallback={<LoadingFallback variant="overlay" label={t('loading.settings')} />}>
      <SettingsModal
        isOpen={isOpen}
        onClose={() => {
          setIsOpen(false);
          setInitialTab(undefined);
        }}
        initialTab={initialTab}
      />
    </Suspense>
  );
}

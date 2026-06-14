import { useState, useEffect, useRef, useCallback } from 'react';
import { useSettingsStore } from '@/core/store';
import { useToastStore } from '@/core/store/toast';
import { useTranslation } from '@/i18n';
import { Button, Dialog, ConfirmDialog } from '@/design-system';
import { resetOnboarding } from '@/features/onboarding';
import { TabNavigation } from './TabNavigation/TabNavigation';
import { SettingsSearch } from './components/SettingsSearch/SettingsSearch';
import { SettingsNavProvider } from './SettingsModalContext';
import { useSettingsTab } from './hooks/useSettingsTab';
import { GeneralTab } from './tabs/GeneralTab/GeneralTab';
import { AppearanceTab } from './tabs/AppearanceTab/AppearanceTab';
import { AccountTab } from './tabs/AccountTab/AccountTab';
import { DefaultsTab } from './tabs/DefaultsTab/DefaultsTab';
import { PrintTab } from './tabs/PrintTab/PrintTab';
import { CategoriesTab } from './tabs/CategoriesTab/CategoriesTab';
import { IntegrationsTab } from './tabs/IntegrationsTab/IntegrationsTab';
import { PrivacyTab } from './tabs/PrivacyTab/PrivacyTab';
import { StorageTab } from './tabs/StorageTab/StorageTab';
import { LabsTab } from './tabs/LabsTab/LabsTab';
import type { SettingsModalProps, SettingsTabId } from './types';

const HIGHLIGHT_DURATION_MS = 1600;

function renderTab(tabId: SettingsTabId) {
  switch (tabId) {
    case 'general':
      return <GeneralTab />;
    case 'appearance':
      return <AppearanceTab />;
    case 'account':
      return <AccountTab />;
    case 'defaults':
      return <DefaultsTab />;
    case 'print':
      return <PrintTab />;
    case 'categories':
      return <CategoriesTab />;
    case 'integrations':
      return <IntegrationsTab />;
    case 'privacy':
      return <PrivacyTab />;
    case 'storage':
      return <StorageTab />;
    case 'labs':
      return <LabsTab />;
  }
}

export function SettingsModal({ isOpen, onClose, initialTab }: SettingsModalProps) {
  const t = useTranslation();
  const { activeTab, setActiveTab } = useSettingsTab(initialTab);
  const [query, setQuery] = useState('');
  const [highlightedSectionId, setHighlightedSectionId] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const resetSettings = useSettingsStore((state) => state.resetSettings);
  const addToast = useToastStore((state) => state.addToast);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const navigateToSection = useCallback(
    (tabId: SettingsTabId, sectionId?: string) => {
      setActiveTab(tabId);
      setHighlightedSectionId(sectionId ?? null);
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
      if (sectionId) {
        highlightTimer.current = setTimeout(
          () => setHighlightedSectionId(null),
          HIGHLIGHT_DURATION_MS
        );
      }
    },
    [setActiveTab]
  );

  useEffect(() => {
    return () => {
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
    };
  }, []);

  // Scroll the targeted section into view after its tab has rendered. Runs on
  // the next frame so the freshly-mounted tab DOM exists. Works for any anchor
  // with a matching id (SettingSection or a plain wrapper like AccountTab).
  useEffect(() => {
    if (!highlightedSectionId) return;
    const raf = requestAnimationFrame(() => {
      document
        .getElementById(highlightedSectionId)
        ?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(raf);
  }, [highlightedSectionId]);

  const handleResetAll = () => {
    resetSettings();
    setShowResetConfirm(false);
    addToast(t('settings.resetAllConfirmed'), 'info');
  };

  const legalLinks = (
    <div className="space-x-3 text-xs text-content-disabled">
      <a
        href="/privacy"
        target="_blank"
        rel="noopener noreferrer"
        className="transition-colors hover:text-content-tertiary"
      >
        {t('settings.privacyPolicy')}
      </a>
      <span>·</span>
      <a
        href="/terms"
        target="_blank"
        rel="noopener noreferrer"
        className="transition-colors hover:text-content-tertiary"
      >
        {t('settings.termsOfService')}
      </a>
    </div>
  );

  return (
    <Dialog.Root
      open={isOpen}
      onClose={onClose}
      size="3xl"
      height="fixed"
      fullScreen="mobile"
      closeOnOverlayClick
    >
      <SettingsNavProvider value={{ navigateToSection, highlightedSectionId }}>
        <Dialog.Header title={t('settings.title')} bordered closeAriaLabel={t('common.close')} />
        <Dialog.SubHeader>
          <SettingsSearch query={query} onQueryChange={setQuery} />
        </Dialog.SubHeader>
        <Dialog.Split>
          <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
          <Dialog.Pane>
            <div
              key={activeTab}
              className="animate-fade-in"
              role="tabpanel"
              id={`settings-tabpanel-${activeTab}`}
              aria-labelledby={`settings-tab-${activeTab}`}
            >
              {renderTab(activeTab)}
            </div>
          </Dialog.Pane>
        </Dialog.Split>
        <Dialog.Footer
          justify="between"
          bordered
          leading={
            <div className="space-x-3 text-xs text-content-tertiary">
              <Button
                variant="ghost"
                onClick={() => setShowResetConfirm(true)}
                className="h-auto p-0 text-xs font-normal hover:bg-transparent hover:text-content"
              >
                {t('settings.resetTabDefaults')}
              </Button>
              <span className="text-content-disabled">·</span>
              <Button
                variant="ghost"
                onClick={() => {
                  resetOnboarding();
                  addToast(t('toast.onboardingReset'), 'info');
                }}
                className="h-auto p-0 text-xs font-normal hover:bg-transparent hover:text-content"
              >
                {t('settings.resetOnboarding')}
              </Button>
            </div>
          }
        >
          {legalLinks}
        </Dialog.Footer>

        <ConfirmDialog
          isOpen={showResetConfirm}
          title={t('settings.resetTabDefaults')}
          message={t('settings.confirmResetAll')}
          confirmText={t('common.apply')}
          onConfirm={handleResetAll}
          onCancel={() => setShowResetConfirm(false)}
        />
      </SettingsNavProvider>
    </Dialog.Root>
  );
}

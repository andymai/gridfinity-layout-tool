import { useState, useEffect, useRef, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useResponsive } from '@/shared/hooks';
import { useSettingsStore } from '@/core/store';
import { useToastStore } from '@/core/store/toast';
import { useTranslation } from '@/i18n';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { resetOnboarding } from '@/features/onboarding';
import { TabNavigation } from './TabNavigation/TabNavigation';
import { useSettingsTab } from './hooks/useSettingsTab';
import { GeneralTab } from './tabs/GeneralTab/GeneralTab';
import { AppearanceTab } from './tabs/AppearanceTab/AppearanceTab';
import { AccountTab } from './tabs/AccountTab/AccountTab';
import { DefaultsTab } from './tabs/DefaultsTab/DefaultsTab';
import { IntegrationsTab } from './tabs/IntegrationsTab/IntegrationsTab';
import { PrivacyTab } from './tabs/PrivacyTab/PrivacyTab';
import { StorageTab } from './tabs/StorageTab/StorageTab';
import { LabsTab } from './tabs/LabsTab/LabsTab';
import { ICON_PATHS } from '@/shared/constants/iconPaths';
import type { SettingsModalProps, SettingsTabId } from './types';

const STYLES = {
  overlay: { backgroundColor: 'var(--overlay-dark)' } as CSSProperties,
  title: {
    fontSize: 'var(--text-2xl)',
    fontWeight: 'var(--font-bold)',
    color: 'var(--text-primary)',
  } as CSSProperties,
} as const;

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
  const { isMobile } = useResponsive();
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const { activeTab, setActiveTab } = useSettingsTab(initialTab);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const resetSettings = useSettingsStore((state) => state.resetSettings);
  const addToast = useToastStore((state) => state.addToast);

  const handleResetAll = () => {
    resetSettings();
    setShowResetConfirm(false);
    addToast(t('settings.resetAllConfirmed'), 'info');
  };

  // Handle escape key and body scroll lock
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    closeButtonRef.current?.focus();
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center z-50 animate-fade-in"
      style={STYLES.overlay}
      onClick={onClose}
      role="presentation"
    >
      <div
        role="presentation"
        className={isMobile ? 'w-full h-full' : ''}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          ref={modalRef}
          className={`flex flex-col animate-scale-in ${
            isMobile ? 'w-full h-full' : 'w-[48rem] h-[85vh]'
          }`}
          style={{
            backgroundColor: 'var(--bg-secondary)',
            ...(isMobile
              ? {}
              : {
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-xl)',
                  boxShadow: 'var(--shadow-xl)',
                }),
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings-title"
        >
          {/* Header */}
          <div className="flex justify-between items-center p-6 pb-4 border-b border-stroke-subtle">
            <h2 id="settings-title" style={STYLES.title}>
              {t('settings.title')}
            </h2>
            <button
              ref={closeButtonRef}
              onClick={onClose}
              className="btn btn-ghost btn-icon"
              style={{ minWidth: 'auto', minHeight: 'auto' }}
              aria-label={t('common.close')}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {ICON_PATHS.close.map((d) => (
                  <path
                    key={d}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d={d}
                  />
                ))}
              </svg>
            </button>
          </div>

          {/* Tab layout */}
          <div className={`flex-1 flex overflow-hidden ${isMobile ? 'flex-col' : 'flex-row'}`}>
            <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
            <div
              className="flex-1 overflow-y-auto scrollbar-thin p-6"
              role="tabpanel"
              id={`settings-tabpanel-${activeTab}`}
              aria-labelledby={`settings-tab-${activeTab}`}
            >
              <div key={activeTab} className="animate-fade-in">
                {renderTab(activeTab)}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-3 border-t border-stroke-subtle text-xs">
            <div className="text-content-tertiary space-x-3">
              <button
                onClick={() => setShowResetConfirm(true)}
                className="hover:text-content transition-colors"
              >
                {t('settings.resetTabDefaults')}
              </button>
              <span className="text-content-disabled">·</span>
              <button
                onClick={() => {
                  resetOnboarding();
                  addToast(t('toast.onboardingReset'), 'info');
                }}
                className="hover:text-content transition-colors"
              >
                {t('settings.resetOnboarding')}
              </button>
            </div>
            <div className="text-content-disabled space-x-3">
              <a
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-content-tertiary transition-colors"
              >
                {t('settings.privacyPolicy')}
              </a>
              <span>·</span>
              <a
                href="/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-content-tertiary transition-colors"
              >
                {t('settings.termsOfService')}
              </a>
            </div>
          </div>

          <ConfirmDialog
            isOpen={showResetConfirm}
            title={t('settings.resetTabDefaults')}
            message={t('settings.confirmResetAll')}
            confirmText={t('common.apply')}
            onConfirm={handleResetAll}
            onCancel={() => setShowResetConfirm(false)}
          />
        </div>
      </div>
    </div>,
    document.body
  );
}

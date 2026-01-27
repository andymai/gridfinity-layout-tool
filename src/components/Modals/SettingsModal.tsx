import { useEffect, useRef, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useShallow } from 'zustand/shallow';
import { useSettingsStore, useLabsStore } from '@/core/store';
import { getToggleableFeatures, getGraduatedFeatures, type FeatureId } from '@/core/labs';
import { FeatureCard } from '@/features/labs/components/FeatureCard';
import { GraduatedSection } from '@/features/labs/components/GraduatedSection';
import { SparklesIcon } from '@/features/labs/components/icons';
import { Checkbox } from '@/shared/components/Checkbox';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { useDrawerSettings } from '@/hooks/useDrawerSettings';
import { useTranslation, useLocale, SUPPORTED_LOCALES, detectBrowserLocale } from '@/i18n';
import type { Locale } from '@/i18n';
import type { STLSearchSite } from '@/core/store/settings';
import { DEFAULT_CATEGORIES } from '@/core/constants';
import { optInAnalytics, optOutAnalytics } from '@/utils/analytics';

// Style constants
const STYLES = {
  overlay: { backgroundColor: 'var(--overlay-dark)' } as CSSProperties,
  modal: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-xl)',
    boxShadow: 'var(--shadow-xl)',
  } as CSSProperties,
  title: {
    fontSize: 'var(--text-2xl)',
    fontWeight: 'var(--font-bold)',
    color: 'var(--text-primary)',
  } as CSSProperties,
  sectionHeader: {
    fontSize: 'var(--text-base)',
    fontWeight: 'var(--font-semibold)',
    color: 'var(--text-primary)',
  } as CSSProperties,
} as const;

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const t = useTranslation();
  const { locale, setLocale } = useLocale();
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const {
    drawer,
    gridUnitMm,
    printBedSize,
    activeLayerHeight,
    settings,
    toggleSTLSite,
    handleSaveDefaults,
    showSaveDefaultsConfirm,
    setShowSaveDefaultsConfirm,
    currentCategories,
    hasCustomCategoryDefaults,
    showSaveCategoriesConfirm,
    setShowSaveCategoriesConfirm,
    handleSaveCategoriesAsDefaults,
  } = useDrawerSettings();

  const { analyticsEnabled, settingsLocale, updateSetting } = useSettingsStore(
    useShallow((state) => ({
      analyticsEnabled: state.settings.analyticsEnabled,
      settingsLocale: state.settings.locale,
      updateSetting: state.updateSetting,
    }))
  );

  const { toggleFeature, isFeatureEnabled } = useLabsStore(
    useShallow((state) => ({
      toggleFeature: state.toggleFeature,
      isFeatureEnabled: state.isFeatureEnabled,
    }))
  );

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

  const toggleableFeatures = getToggleableFeatures();
  const graduatedFeatures = getGraduatedFeatures();

  const handlePrivacyToggle = () => {
    const newValue = !analyticsEnabled;
    updateSetting('analyticsEnabled', newValue);
    // Apply the change to PostHog immediately
    if (newValue) {
      optInAnalytics();
    } else {
      optOutAnalytics();
    }
  };

  // Use portal to escape parent stacking contexts (e.g., BottomSheet with transform)
  return createPortal(
    <>
      <div
        className="fixed inset-0 flex items-center justify-center z-50 animate-fade-in"
        style={STYLES.overlay}
        onClick={onClose}
      >
        <div
          ref={modalRef}
          className="max-w-lg w-full mx-4 max-h-[85vh] flex flex-col animate-scale-in"
          style={STYLES.modal}
          onClick={(e) => e.stopPropagation()}
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
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-8">
            {/* Language Section */}
            <section>
              <h3 style={STYLES.sectionHeader} className="mb-3">
                {t('settings.language')}
              </h3>
              <p className="text-sm text-content-tertiary mb-3">{t('settings.languageHint')}</p>
              <div className="space-y-1">
                {/* Auto option */}
                <div
                  className={`flex items-center justify-between text-sm cursor-pointer group rounded-md p-2 -m-1 outline-none focus-visible:ring-2 focus-visible:ring-accent ${settingsLocale === 'auto' ? 'bg-surface-elevated border border-accent/30' : 'hover:bg-surface-hover'}`}
                  onClick={() => {
                    updateSetting('locale', 'auto');
                    setLocale(detectBrowserLocale());
                  }}
                  role="radio"
                  aria-checked={settingsLocale === 'auto'}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      updateSetting('locale', 'auto');
                      setLocale(detectBrowserLocale());
                    }
                  }}
                >
                  <span
                    className={
                      settingsLocale === 'auto' ? 'text-content' : 'text-content-secondary'
                    }
                  >
                    {t('settings.autoDetect')}
                  </span>
                  {settingsLocale === 'auto' && (
                    <svg
                      className="w-4 h-4 text-accent"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </div>
                {/* Language options */}
                {SUPPORTED_LOCALES.map((loc) => (
                  <div
                    key={loc.code}
                    className={`flex items-center justify-between text-sm cursor-pointer group rounded-md p-2 -m-1 outline-none focus-visible:ring-2 focus-visible:ring-accent ${locale === loc.code && settingsLocale !== 'auto' ? 'bg-surface-elevated border border-accent/30' : 'hover:bg-surface-hover'}`}
                    onClick={() => {
                      updateSetting('locale', loc.code);
                      setLocale(loc.code as Locale);
                    }}
                    role="radio"
                    aria-checked={locale === loc.code && settingsLocale !== 'auto'}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === ' ' || e.key === 'Enter') {
                        e.preventDefault();
                        updateSetting('locale', loc.code);
                        setLocale(loc.code as Locale);
                      }
                    }}
                  >
                    <div>
                      <span
                        className={
                          locale === loc.code && settingsLocale !== 'auto'
                            ? 'text-content'
                            : 'text-content-secondary'
                        }
                      >
                        {loc.nativeName}
                      </span>
                      {loc.code !== 'en' && (
                        <span className="text-xs text-content-disabled ml-2">
                          {loc.englishName}
                        </span>
                      )}
                    </div>
                    {locale === loc.code && settingsLocale !== 'auto' && (
                      <svg
                        className="w-4 h-4 text-accent"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Divider */}
            <hr className="border-stroke-subtle" />

            {/* Default Preferences Section */}
            <section>
              <h3 style={STYLES.sectionHeader} className="mb-3">
                {t('settings.defaultPreferences')}
              </h3>
              <p className="text-sm text-content-tertiary mb-3">
                {t('settings.defaultPreferencesHint')}
              </p>
              <div className="text-sm text-content-secondary space-y-1 mb-4 p-3 rounded-lg bg-surface-elevated border border-stroke-subtle">
                <div className="flex justify-between">
                  <span>{t('settings.drawerSize')}</span>
                  <span className="text-content-tertiary">
                    {settings.defaultDrawerWidth}×{settings.defaultDrawerDepth}×
                    {settings.defaultDrawerHeight}u
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>{t('settings.layerHeight')}</span>
                  <span className="text-content-tertiary">{settings.defaultLayerHeight}u</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('settings.printBed')}</span>
                  <span className="text-content-tertiary">{settings.defaultPrintBedSize}mm</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('settings.gridUnit')}</span>
                  <span className="text-content-tertiary">{settings.defaultGridUnitMm}mm</span>
                </div>
              </div>
              <button
                onClick={() => setShowSaveDefaultsConfirm(true)}
                className="w-full text-sm py-2 px-3 rounded-lg bg-surface-elevated hover:bg-surface-hover text-content-secondary hover:text-content border border-stroke-subtle transition-colors"
                title={t('settings.saveCurrentTitle')}
              >
                {t('settings.saveCurrentAsDefaults')}
              </button>
            </section>

            {/* Divider */}
            <hr className="border-stroke-subtle" />

            {/* Default Categories Section */}
            <section>
              <h3 style={STYLES.sectionHeader} className="mb-3">
                {t('settings.defaultCategories')}
              </h3>
              <p className="text-sm text-content-tertiary mb-3">
                {t('settings.defaultCategoriesHint')}
              </p>
              <div className="text-sm text-content-secondary mb-4 p-3 rounded-lg bg-surface-elevated border border-stroke-subtle">
                <div className="text-xs text-content-tertiary mb-2">
                  {hasCustomCategoryDefaults
                    ? t('settings.usingCustomCategories', {
                        count: settings.defaultCategories?.length ?? 0,
                      })
                    : t('settings.usingBuiltInCategories', { count: DEFAULT_CATEGORIES.length })}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(settings.defaultCategories ?? DEFAULT_CATEGORIES).map((cat) => (
                    <div
                      key={cat.id}
                      className="flex items-center gap-1.5 px-2 py-1 rounded bg-surface-hover"
                    >
                      <span
                        className="w-3 h-3 rounded-sm shadow-sm flex-shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="text-xs text-content-secondary truncate max-w-[80px]">
                        {cat.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowSaveCategoriesConfirm(true)}
                  className="flex-1 text-sm py-2 px-3 rounded-lg bg-surface-elevated hover:bg-surface-hover text-content-secondary hover:text-content border border-stroke-subtle transition-colors"
                >
                  {t('settings.saveCategoriesAsDefaults')}
                </button>
                {hasCustomCategoryDefaults && (
                  <button
                    onClick={() => updateSetting('defaultCategories', null)}
                    className="text-sm py-2 px-3 rounded-lg text-content-tertiary hover:text-content hover:bg-surface-hover border border-stroke-subtle transition-colors"
                  >
                    {t('settings.resetToBuiltIn')}
                  </button>
                )}
              </div>
            </section>

            {/* Divider */}
            <hr className="border-stroke-subtle" />

            {/* STL Search Section */}
            <section>
              <h3 style={STYLES.sectionHeader} className="mb-3">
                {t('settings.stlSearch')}
              </h3>
              <p className="text-sm text-content-tertiary mb-3">{t('settings.stlSearchHint')}</p>
              <div className="space-y-2">
                {settings.stlSearchSites.map((site: STLSearchSite) => (
                  <div
                    key={site.id}
                    className="flex items-center justify-between text-sm cursor-pointer group rounded-md p-1 -m-1 outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-surface"
                    onClick={() => toggleSTLSite(site.id)}
                    role="checkbox"
                    aria-checked={site.enabled}
                    aria-label={t('settings.toggleSite', { name: site.name })}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === ' ' || e.key === 'Enter') {
                        e.preventDefault();
                        toggleSTLSite(site.id);
                      }
                    }}
                  >
                    <span
                      className={`${site.enabled ? 'text-content' : 'text-content-tertiary'} group-hover:text-content transition-colors`}
                    >
                      {site.name}
                    </span>
                    <Checkbox checked={site.enabled} variant="desktop" />
                  </div>
                ))}
              </div>
            </section>

            {/* Divider */}
            <hr className="border-stroke-subtle" />

            {/* Privacy Section */}
            <section>
              <h3 style={STYLES.sectionHeader} className="mb-3">
                {t('settings.privacy')}
              </h3>
              <div
                className="flex items-center justify-between text-sm cursor-pointer group rounded-md p-1 -m-1 outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-surface"
                onClick={handlePrivacyToggle}
                role="checkbox"
                aria-checked={analyticsEnabled}
                aria-label={t('settings.toggleUsageData')}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    handlePrivacyToggle();
                  }
                }}
              >
                <div>
                  <span
                    className={`${analyticsEnabled ? 'text-content' : 'text-content-tertiary'} group-hover:text-content transition-colors`}
                  >
                    {t('settings.helpImprove')}
                  </span>
                  <p className="text-xs text-content-disabled mt-0.5">
                    {t('settings.helpImproveHint')}
                  </p>
                </div>
                <Checkbox checked={analyticsEnabled} variant="desktop" />
              </div>
            </section>

            {/* Divider */}
            <hr className="border-stroke-subtle" />

            {/* Labs Section */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <SparklesIcon className="w-5 h-5 text-accent" />
                <h3 style={STYLES.sectionHeader}>{t('settings.labs')}</h3>
              </div>
              <p className="text-sm text-content-tertiary mb-4">{t('settings.labsHint')}</p>

              {toggleableFeatures.length > 0 ? (
                <div className="space-y-3">
                  {toggleableFeatures.map((feature) => (
                    <FeatureCard
                      key={feature.id}
                      feature={feature}
                      isEnabled={isFeatureEnabled(feature.id as FeatureId)}
                      onToggle={() => toggleFeature(feature.id as FeatureId)}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-content-tertiary">
                  <SparklesIcon className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">{t('settings.labsEmpty')}</p>
                  <p className="text-xs mt-1">{t('settings.labsCheckBack')}</p>
                </div>
              )}

              <GraduatedSection features={graduatedFeatures} />
            </section>

            {/* Legal Links */}
            <div className="pt-4 border-t border-stroke-subtle text-center">
              <div className="text-xs text-content-disabled space-x-3">
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
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showSaveDefaultsConfirm}
        title={t('settings.confirmSaveDefaults.title')}
        message={t('settings.confirmSaveDefaults.message', {
          width: drawer.width,
          depth: drawer.depth,
          height: drawer.height,
          layerHeight: activeLayerHeight,
          printBed: printBedSize,
          gridUnit: gridUnitMm,
        })}
        confirmText={t('settings.confirmSaveDefaults.confirm')}
        onConfirm={handleSaveDefaults}
        onCancel={() => setShowSaveDefaultsConfirm(false)}
      />

      <ConfirmDialog
        isOpen={showSaveCategoriesConfirm}
        title={t('settings.confirmSaveCategories.title')}
        message={`${t('settings.confirmSaveCategories.message', {
          count: currentCategories.length,
        })}\n\n${currentCategories.map((c) => c.name).join(', ')}`}
        confirmText={t('settings.confirmSaveCategories.confirm')}
        onConfirm={handleSaveCategoriesAsDefaults}
        onCancel={() => setShowSaveCategoriesConfirm(false)}
      />
    </>,
    document.body
  );
}

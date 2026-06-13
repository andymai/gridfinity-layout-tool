import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLabsStore } from '@/core/store';
import { getToggleableFeatures, getGraduatedFeatures, type FeatureId } from '@/core/labs';
import { EngineSelector, KERNEL_FEATURE_IDS } from '../EngineSelector';
import { FeatureCard } from '../FeatureCard';
import { GraduatedSection } from '../GraduatedSection';
import { SparklesIcon, CloseIcon } from '../icons';
import { IconButton } from '@/design-system';
import { useTranslation } from '@/i18n';

export function LabsDrawer() {
  const t = useTranslation();
  // Subscribe to `enabledFeatures` (a fresh object on every toggle) — not the
  // stable `isFeatureEnabled` reference — so the switches re-render when a flag
  // flips. The drawer only renders toggleable (experimental/preview) features,
  // for which enabled state is exactly `enabledFeatures[id]`.
  const { isOpen, closeDrawer, toggleFeature, enabledFeatures } = useLabsStore(
    useShallow((state) => ({
      isOpen: state.isDrawerOpen,
      closeDrawer: state.closeDrawer,
      toggleFeature: state.toggleFeature,
      enabledFeatures: state.preferences.enabledFeatures,
    }))
  );

  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    closeButtonRef.current?.focus();
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDrawer();
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, closeDrawer]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) closeDrawer();
  };

  const toggleableFeatures = getToggleableFeatures().filter(
    (f) => !KERNEL_FEATURE_IDS.some((id) => id === f.id)
  );
  const graduatedFeatures = getGraduatedFeatures();

  return (
    <>
      <div
        className={`fixed inset-0 z-[99] bg-overlay-dark transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('labs.labsExperimentalFeatures')}
        className={`fixed top-0 right-0 z-[100] h-full w-full max-w-[400px] bg-surface-elevated border-l border-stroke-subtle shadow-xl transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          <header className="flex items-center justify-between px-6 py-4 border-b border-stroke-subtle">
            <div className="flex items-center gap-2">
              <SparklesIcon className="w-5 h-5 text-accent" />
              <h2 className="text-lg font-semibold text-content">{t('labs.labs')}</h2>
            </div>
            <IconButton
              ref={closeButtonRef}
              onClick={closeDrawer}
              className="-mr-2"
              aria-label={t('labs.closeLabs')}
            >
              <CloseIcon className="w-5 h-5" />
            </IconButton>
          </header>

          <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
            <p className="text-sm text-content-secondary leading-relaxed mb-6" data-nosnippet>
              {t('labs.description')}
            </p>

            <div className="mb-3">
              <EngineSelector />
            </div>

            {toggleableFeatures.length > 0 ? (
              <div className="space-y-3">
                {toggleableFeatures.map((feature) => (
                  <FeatureCard
                    key={feature.id}
                    feature={feature}
                    isEnabled={enabledFeatures[feature.id as FeatureId] ?? false}
                    onToggle={() => toggleFeature(feature.id as FeatureId)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-content-tertiary">
                <SparklesIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No experimental features available right now.</p>
                <p className="text-xs mt-1">{t('labs.checkBackLater')}</p>
              </div>
            )}

            <GraduatedSection features={graduatedFeatures} />
          </div>
        </div>
      </div>
    </>
  );
}

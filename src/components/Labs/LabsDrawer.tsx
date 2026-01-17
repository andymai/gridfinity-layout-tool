import { useEffect, useRef, useCallback } from 'react';
import { useShallow } from 'zustand/shallow';
import { useLabsStore } from '../../core/store/labs';
import { getToggleableFeatures, getGraduatedFeatures, type FeatureId } from '../../core/labs/features';
import { FeatureCard } from './FeatureCard';
import { GraduatedSection } from './GraduatedSection';
import { SparklesIcon, CloseIcon } from './icons';

export function LabsDrawer() {
  const { isOpen, closeDrawer, toggleFeature, isFeatureEnabled } =
    useLabsStore(
      useShallow((state) => ({
        isOpen: state.isDrawerOpen,
        closeDrawer: state.closeDrawer,
        toggleFeature: state.toggleFeature,
        isFeatureEnabled: state.isFeatureEnabled,
      }))
    );

  const drawerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeDrawer();
      }
    },
    [closeDrawer]
  );

  useEffect(() => {
    if (!isOpen) return;

    closeButtonRef.current?.focus();
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      closeDrawer();
    }
  };

  const toggleableFeatures = getToggleableFeatures();
  const graduatedFeatures = getGraduatedFeatures();

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[99] bg-black/50 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Labs experimental features"
        className={`fixed top-0 right-0 z-[100] h-full w-full max-w-[400px] bg-surface-elevated border-l border-stroke-subtle shadow-xl transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <header className="flex items-center justify-between px-6 py-4 border-b border-stroke-subtle">
            <div className="flex items-center gap-2">
              <SparklesIcon className="w-5 h-5 text-accent" />
              <h2 className="text-lg font-semibold text-content">Labs</h2>
            </div>
            <button
              ref={closeButtonRef}
              onClick={closeDrawer}
              className="p-2 -mr-2 rounded-md text-content-secondary hover:text-content hover:bg-surface-hover transition-colors"
              aria-label="Close Labs"
            >
              <CloseIcon className="w-5 h-5" />
            </button>
          </header>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
            {/* Description */}
            <p className="text-sm text-content-secondary leading-relaxed mb-6">
              Try experimental features before they're ready for everyone. These
              may be buggy or change without notice.
            </p>

            {/* Feature Cards */}
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
              <div className="text-center py-8 text-content-tertiary">
                <SparklesIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No experimental features available right now.</p>
                <p className="text-xs mt-1">Check back later!</p>
              </div>
            )}

            {/* Graduated Features Section */}
            <GraduatedSection features={graduatedFeatures} />
          </div>
        </div>
      </div>
    </>
  );
}

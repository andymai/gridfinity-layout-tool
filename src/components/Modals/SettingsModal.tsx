import { useEffect, useRef, type CSSProperties } from 'react';
import { useShallow } from 'zustand/shallow';
import { useSettingsStore, useLabsStore } from '@/core/store';
import { getToggleableFeatures, getGraduatedFeatures, type FeatureId } from '@/core/labs';
import { FeatureCard } from '@/features/labs/components/FeatureCard';
import { GraduatedSection } from '@/features/labs/components/GraduatedSection';
import { SparklesIcon } from '@/features/labs/components/icons';
import { Checkbox } from '@/shared/components/Checkbox';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { useDrawerSettings } from '@/hooks/useDrawerSettings';
import type { STLSearchSite } from '@/core/store/settings';

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
  } = useDrawerSettings();

  const { mlTelemetryEnabled, updateSetting } = useSettingsStore(
    useShallow((state) => ({
      mlTelemetryEnabled: state.settings.mlTelemetryEnabled,
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
    updateSetting('mlTelemetryEnabled', !mlTelemetryEnabled);
  };

  return (
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
              Settings
            </h2>
            <button
              ref={closeButtonRef}
              onClick={onClose}
              className="btn btn-ghost btn-icon"
              style={{ minWidth: 'auto', minHeight: 'auto' }}
              aria-label="Close settings"
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
            {/* Default Preferences Section */}
            <section>
              <h3 style={STYLES.sectionHeader} className="mb-3">
                Default Preferences
              </h3>
              <p className="text-sm text-content-tertiary mb-3">
                New layouts will use these settings:
              </p>
              <div className="text-sm text-content-secondary space-y-1 mb-4 p-3 rounded-lg bg-surface-elevated border border-stroke-subtle">
                <div className="flex justify-between">
                  <span>Drawer size</span>
                  <span className="text-content-tertiary">
                    {settings.defaultDrawerWidth}×{settings.defaultDrawerDepth}×
                    {settings.defaultDrawerHeight}u
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Layer height</span>
                  <span className="text-content-tertiary">{settings.defaultLayerHeight}u</span>
                </div>
                <div className="flex justify-between">
                  <span>Print bed</span>
                  <span className="text-content-tertiary">{settings.defaultPrintBedSize}mm</span>
                </div>
                <div className="flex justify-between">
                  <span>Grid unit</span>
                  <span className="text-content-tertiary">{settings.defaultGridUnitMm}mm</span>
                </div>
              </div>
              <button
                onClick={() => setShowSaveDefaultsConfirm(true)}
                className="w-full text-sm py-2 px-3 rounded-lg bg-surface-elevated hover:bg-surface-hover text-content-secondary hover:text-content border border-stroke-subtle transition-colors"
                title="Save current layout settings as defaults for new layouts"
              >
                Save Current as Defaults
              </button>
            </section>

            {/* Divider */}
            <hr className="border-stroke-subtle" />

            {/* STL Search Section */}
            <section>
              <h3 style={STYLES.sectionHeader} className="mb-3">
                STL Search
              </h3>
              <p className="text-sm text-content-tertiary mb-3">
                Choose which sites to search for Gridfinity STL files:
              </p>
              <div className="space-y-2">
                {settings.stlSearchSites.map((site: STLSearchSite) => (
                  <div
                    key={site.id}
                    className="flex items-center justify-between text-sm cursor-pointer group rounded-md p-1 -m-1 outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-surface"
                    onClick={() => toggleSTLSite(site.id)}
                    role="checkbox"
                    aria-checked={site.enabled}
                    aria-label={`Toggle ${site.name}`}
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
                Privacy
              </h3>
              <div
                className="flex items-center justify-between text-sm cursor-pointer group rounded-md p-1 -m-1 outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-surface"
                onClick={handlePrivacyToggle}
                role="checkbox"
                aria-checked={mlTelemetryEnabled}
                aria-label="Toggle usage data collection"
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
                    className={`${mlTelemetryEnabled ? 'text-content' : 'text-content-tertiary'} group-hover:text-content transition-colors`}
                  >
                    Help improve suggestions
                  </span>
                  <p className="text-xs text-content-disabled mt-0.5">
                    Share bin sizes and placement patterns (no personal data)
                  </p>
                </div>
                <Checkbox checked={mlTelemetryEnabled} variant="desktop" />
              </div>
            </section>

            {/* Divider */}
            <hr className="border-stroke-subtle" />

            {/* Labs Section */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <SparklesIcon className="w-5 h-5 text-accent" />
                <h3 style={STYLES.sectionHeader}>Labs</h3>
              </div>
              <p className="text-sm text-content-tertiary mb-4">
                Try new features before they're released. Features may change based on feedback.
              </p>

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
                  <p className="text-sm">No experimental features available right now.</p>
                  <p className="text-xs mt-1">Check back later!</p>
                </div>
              )}

              <GraduatedSection features={graduatedFeatures} />
            </section>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showSaveDefaultsConfirm}
        title="Save as Defaults"
        message={`Save current settings as defaults for new layouts?\n\nDrawer: ${drawer.width}×${drawer.depth}×${drawer.height}u\nLayer height: ${activeLayerHeight}u\nPrint bed: ${printBedSize}mm\nGrid unit: ${gridUnitMm}mm`}
        confirmText="Save"
        onConfirm={handleSaveDefaults}
        onCancel={() => setShowSaveDefaultsConfirm(false)}
      />
    </>
  );
}

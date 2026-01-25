import { useMemo } from 'react';
// Import stores directly to avoid circular dependency via barrel export
import { useSettingsStore } from '@/core/store/settings';
import { useLabsStore } from '@/core/store/labs';
import { getFeature } from '@/core/labs';
import { useShallow } from 'zustand/shallow';
import { useDrawerSettings } from '@/hooks/useDrawerSettings';
import { SparklesIcon, ChevronRightIcon } from '@/features/labs/components/icons';
import { CONSTRAINTS } from '@/core/constants';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { HalfBinModeBlockedModal } from '@/components/Modals';
import { DeferredNumberInput } from '@/shared/components/DeferredNumberInput';
import { StepperControl } from '@/shared/components/StepperControl';
import { Checkbox } from '@/shared/components/Checkbox';
import { SectionHeader } from '@/shared/components/SectionHeader';
import { SettingsRow } from '@/shared/components/SettingsRow';
import type { STLSearchSite } from '@/core/store/settings';
import { useTranslation } from '@/i18n';

/**
 * Privacy settings section for mobile.
 */
function MobilePrivacySection() {
  const t = useTranslation();
  const { mlTelemetryEnabled, updateSetting } = useSettingsStore(
    useShallow((state) => ({
      mlTelemetryEnabled: state.settings.mlTelemetryEnabled,
      updateSetting: state.updateSetting,
    }))
  );

  const handleToggle = () => {
    updateSetting('mlTelemetryEnabled', !mlTelemetryEnabled);
  };

  return (
    <section>
      <SectionHeader title={t('settings.privacy')} />
      <div
        className="flex items-center justify-between py-2 cursor-pointer"
        onClick={handleToggle}
        role="checkbox"
        aria-checked={mlTelemetryEnabled}
        aria-label={t('mobile.settings.toggleUsageDataCollection')}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            handleToggle();
          }
        }}
      >
        <div>
          <span
            className={`text-sm ${mlTelemetryEnabled ? 'text-content' : 'text-content-secondary'}`}
          >
            {t('mobile.settings.helpImproveSuggestions')}
          </span>
          <p className="text-xs text-content-tertiary">
            {t('mobile.settings.shareBinSizesAndPlacementPatternsNo')}
          </p>
        </div>
        <Checkbox checked={mlTelemetryEnabled} variant="mobile" />
      </div>
    </section>
  );
}

/**
 * Mobile settings panel with grid configuration and app actions.
 */
export function MobileSettingsPanel() {
  const t = useTranslation();
  // Use consolidated drawer settings hook
  const {
    drawer,
    widthStep,
    depthStep,
    realWorldDimensions,
    maxGridUnits,
    gridUnitMm,
    heightUnitMm,
    printBedSize,
    halfBinMode,
    settings,
    activeLayerHeight,
    handleDrawerWidthChange,
    handleDrawerDepthChange,
    handleDrawerHeightChange,
    handleDrawerWidthInput,
    handleDrawerDepthInput,
    handleHalfBinToggle,
    handleRemediate,
    handleSaveDefaults,
    setGridUnitMm,
    setHeightUnitMm,
    setPrintBedSize,
    toggleSTLSite,
    showSaveDefaultsConfirm,
    setShowSaveDefaultsConfirm,
    showHalfBinBlockedModal,
    setShowHalfBinBlockedModal,
    halfBinViolation,
  } = useDrawerSettings();

  const openLabsDrawer = useLabsStore((state) => state.openDrawer);
  const enabledFeatures = useLabsStore((state) => state.preferences.enabledFeatures);

  // Compute enabled count from raw state (only experimental/preview features)
  const labsEnabledCount = useMemo(() => {
    return Object.entries(enabledFeatures).filter(([id, enabled]) => {
      if (!enabled) return false;
      const feature = getFeature(id);
      return feature?.status === 'experimental' || feature?.status === 'preview';
    }).length;
  }, [enabledFeatures]);

  return (
    <div className="pb-4 space-y-6">
      {/* Drawer Dimensions */}
      <section>
        <SectionHeader title={t('settings.drawerDimensions')} />

        <div className="grid grid-cols-2 gap-3 mb-3">
          {/* Width */}
          <div>
            <label className="block text-sm mb-1 text-content-tertiary">{t('common.width')}</label>
            <StepperControl
              value={drawer.width}
              onChange={handleDrawerWidthInput}
              onStep={handleDrawerWidthChange}
              min={0.5}
              max={CONSTRAINTS.GRID_MAX}
              step={widthStep}
              variant="mobile"
              ariaLabel="Drawer width in grid units"
            />
          </div>

          {/* Depth */}
          <div>
            <label className="block text-sm mb-1 text-content-tertiary">{t('common.depth')}</label>
            <StepperControl
              value={drawer.depth}
              onChange={handleDrawerDepthInput}
              onStep={handleDrawerDepthChange}
              min={0.5}
              max={CONSTRAINTS.GRID_MAX}
              step={depthStep}
              variant="mobile"
              ariaLabel="Drawer depth in grid units"
            />
          </div>
        </div>

        {/* Height */}
        <div>
          <label className="block text-sm mb-1 text-content-tertiary">{t('common.height')}</label>
          <StepperControl
            value={drawer.height}
            onStep={handleDrawerHeightChange}
            min={1}
            max={CONSTRAINTS.GRID_MAX}
            variant="mobile"
            ariaLabel="Drawer height in units"
            displayValue={`${drawer.height}u`}
          />
        </div>

        {/* Real-world drawer dimensions */}
        <div className="mt-3 flex items-center gap-1.5 text-sm text-content-tertiary">
          <svg
            className="w-4 h-4 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 12h16M4 12v-2M8 12v-1M12 12v-2M16 12v-1M20 12v-2"
            />
          </svg>
          <span className="tabular-nums">
            {realWorldDimensions.width.toFixed(0)} × {realWorldDimensions.depth.toFixed(0)} ×{' '}
            {realWorldDimensions.height.toFixed(0)} mm
          </span>
        </div>
      </section>

      {/* Half-bin mode */}
      <section>
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={handleHalfBinToggle}
          role="checkbox"
          aria-checked={halfBinMode}
          aria-label={t('mobile.settings.toggleHalfBinMode')}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault();
              handleHalfBinToggle();
            }
          }}
        >
          <div>
            <span className={`text-sm ${halfBinMode ? 'text-content' : 'text-content-secondary'}`}>
              {t('mobile.settings.halfBinMode')}
            </span>
            <p className="text-xs text-content-tertiary">
              {t('mobile.settings.allow05UnitPrecision')}
            </p>
          </div>
          <Checkbox checked={halfBinMode} variant="mobile" />
        </div>
      </section>

      {/* Grid Settings */}
      <section>
        <SectionHeader title={t('settings.gridSettings')} />

        <div className="space-y-3">
          <SettingsRow label="1 grid unit" unit="mm" variant="mobile">
            <DeferredNumberInput
              value={gridUnitMm}
              onChange={setGridUnitMm}
              className="input w-20 h-10 text-center"
              min={1}
              max={200}
            />
          </SettingsRow>

          <SettingsRow label="1u height" unit="mm" variant="mobile">
            <DeferredNumberInput
              value={heightUnitMm}
              onChange={setHeightUnitMm}
              className="input w-20 h-10 text-center"
              min={1}
              max={50}
            />
          </SettingsRow>

          <SettingsRow label="Print bed size" unit="mm" variant="mobile">
            <DeferredNumberInput
              value={printBedSize}
              onChange={setPrintBedSize}
              className="input w-20 h-10 text-center"
              min={42}
              max={500}
              step={10}
            />
          </SettingsRow>

          <div className="text-sm text-right text-content-disabled">
            {t('mobile.settings.maxBinSize')}
            {maxGridUnits}×{maxGridUnits}
          </div>
        </div>
      </section>

      {/* STL Search */}
      <section>
        <SectionHeader title={t('settings.stlSearch')} />
        <div className="space-y-2">
          {settings.stlSearchSites.map((site: STLSearchSite) => (
            <div
              key={site.id}
              className="flex items-center justify-between py-2 cursor-pointer"
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
                className={`text-sm ${site.enabled ? 'text-content' : 'text-content-tertiary'}`}
              >
                {site.name}
              </span>
              <Checkbox checked={site.enabled} variant="mobile" />
            </div>
          ))}
        </div>
      </section>

      {/* Preferences */}
      <section>
        <SectionHeader title={t('settings.defaultPreferences')} />

        <div className="bg-surface-elevated rounded-lg p-3 space-y-2">
          <div className="text-xs text-content-tertiary">
            {t('mobile.settings.newLayoutsWillUseTheseDefaults')}
          </div>
          <div className="text-sm text-content-secondary">
            {t('mobile.settings.drawer')}
            {settings.defaultDrawerWidth}×{settings.defaultDrawerDepth}×
            {settings.defaultDrawerHeight}u
          </div>
          <div className="text-sm text-content-secondary">
            {t('mobile.settings.layerHeight')}
            {settings.defaultLayerHeight}u
          </div>
          <div className="text-sm text-content-secondary">
            {t('mobile.settings.printBed')}
            {settings.defaultPrintBedSize}mm
          </div>
          <div className="text-sm text-content-secondary">
            {t('mobile.settings.gridUnit')}
            {settings.defaultGridUnitMm}mm
          </div>
          <button
            onClick={() => setShowSaveDefaultsConfirm(true)}
            className="btn btn-secondary w-full mt-3"
          >
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
              />
            </svg>
            {t('mobile.settings.saveCurrentAsDefaults')}
          </button>
        </div>
      </section>

      {/* Privacy */}
      <MobilePrivacySection />

      {/* Labs */}
      <section>
        <SectionHeader title={t('settings.experimental')} />
        <button
          onClick={openLabsDrawer}
          className="w-full flex items-center justify-between px-4 py-3 bg-surface-elevated rounded-lg hover:bg-surface-hover transition-colors"
        >
          <div className="flex items-center gap-3">
            <SparklesIcon className="w-5 h-5 text-accent" />
            <div className="text-left">
              <div className="text-sm font-medium text-content">{t('mobile.settings.labs')}</div>
              <div className="text-xs text-content-tertiary">
                {t('mobile.settings.tryExperimentalFeatures')}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {labsEnabledCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 text-[11px] font-semibold text-on-dark bg-accent rounded-full">
                {labsEnabledCount > 9 ? t('common.overflowCount') : labsEnabledCount}
              </span>
            )}
            <ChevronRightIcon className="w-5 h-5 text-content-tertiary" />
          </div>
        </button>
      </section>

      {/* Info */}
      <section className="pt-4 text-center border-t border-stroke-subtle">
        <div className="text-xs text-content-disabled leading-relaxed">
          <a
            href="https://www.youtube.com/c/ZackFreedman"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline text-content-tertiary"
          >
            Gridfinity
          </a>{' '}
          {t('mobile.settings.byZackFreedman')}
          <br />
          {t('mobile.settings.toolBy')}{' '}
          <a
            href="https://www.linkedin.com/in/andyhmai/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline text-content-tertiary"
          >
            Andy Aragon
          </a>
        </div>
      </section>

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

      {halfBinViolation && (
        <HalfBinModeBlockedModal
          isOpen={showHalfBinBlockedModal}
          violation={halfBinViolation}
          onClose={() => setShowHalfBinBlockedModal(false)}
          onRemediate={handleRemediate}
        />
      )}
    </div>
  );
}

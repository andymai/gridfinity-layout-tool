import { useMemo } from 'react';
import { useLabsStore } from '../../core/store';
import { useDrawerSettings } from '../../hooks';
import { getFeature } from '../../core/labs/features';
import { SparklesIcon, ChevronRightIcon } from '../Labs/icons';
import { CONSTRAINTS } from '../../core/constants';
import { ConfirmDialog } from '../../shared/components/ConfirmDialog';
import { HalfBinModeBlockedModal } from '../Modals/HalfBinModeBlockedModal';
import { DeferredNumberInput } from '../../shared/components/DeferredNumberInput';
import { StepperControl } from '../../shared/components/StepperControl';
import { Checkbox } from '../../shared/components/Checkbox';
import { SectionHeader } from '../SectionHeader';
import { SettingsRow } from '../SettingsRow';
import type { STLSearchSite } from '../../core/store/settings';

/**
 * Mobile settings panel with grid configuration and app actions.
 */
export function MobileSettingsPanel() {
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

  const openLabsDrawer = useLabsStore(state => state.openDrawer);
  const enabledFeatures = useLabsStore(state => state.preferences.enabledFeatures);

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
        <SectionHeader title="Drawer Dimensions" />

        <div className="grid grid-cols-2 gap-3 mb-3">
          {/* Width */}
          <div>
            <label className="block text-sm mb-1 text-content-tertiary">
              Width
            </label>
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
            <label className="block text-sm mb-1 text-content-tertiary">
              Depth
            </label>
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
          <label className="block text-sm mb-1 text-content-tertiary">
            Height
          </label>
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
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 12h16M4 12v-2M8 12v-1M12 12v-2M16 12v-1M20 12v-2" />
          </svg>
          <span className="tabular-nums">
            {realWorldDimensions.width.toFixed(0)} × {realWorldDimensions.depth.toFixed(0)} × {realWorldDimensions.height.toFixed(0)} mm
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
          aria-label="Toggle half-bin mode"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault();
              handleHalfBinToggle();
            }
          }}
        >
          <div>
            <div className="flex items-center gap-1.5">
              <span className={`text-sm ${halfBinMode ? 'text-content' : 'text-content-secondary'}`}>Half-bin mode</span>
              <span className="text-[9px] text-amber-500/80 bg-amber-500/10 px-1 py-0.5 rounded">experimental</span>
            </div>
            <p className="text-xs text-content-tertiary">Allow 0.5 unit precision</p>
          </div>
          <Checkbox checked={halfBinMode} variant="mobile" />
        </div>
      </section>

      {/* Grid Settings */}
      <section>
        <SectionHeader title="Grid Settings" />

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
            Max bin size: {maxGridUnits}×{maxGridUnits}
          </div>
        </div>
      </section>

      {/* STL Search */}
      <section>
        <SectionHeader title="STL Search" />
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
              <span className={`text-sm ${site.enabled ? 'text-content' : 'text-content-tertiary'}`}>
                {site.name}
              </span>
              <Checkbox checked={site.enabled} variant="mobile" />
            </div>
          ))}
        </div>
      </section>

      {/* Preferences */}
      <section>
        <SectionHeader title="Default Preferences" />

        <div className="bg-surface-elevated rounded-lg p-3 space-y-2">
          <div className="text-xs text-content-tertiary">
            New layouts will use these defaults:
          </div>
          <div className="text-sm text-content-secondary">
            Drawer: {settings.defaultDrawerWidth}×{settings.defaultDrawerDepth}×{settings.defaultDrawerHeight}u
          </div>
          <div className="text-sm text-content-secondary">
            Layer height: {settings.defaultLayerHeight}u
          </div>
          <div className="text-sm text-content-secondary">
            Print bed: {settings.defaultPrintBedSize}mm
          </div>
          <div className="text-sm text-content-secondary">
            Grid unit: {settings.defaultGridUnitMm}mm
          </div>
          <button
            onClick={() => setShowSaveDefaultsConfirm(true)}
            className="btn btn-secondary w-full mt-3"
          >
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            Save Current as Defaults
          </button>
        </div>
      </section>

      {/* Labs */}
      <section>
        <SectionHeader title="Experimental" />
        <button
          onClick={openLabsDrawer}
          className="w-full flex items-center justify-between px-4 py-3 bg-surface-elevated rounded-lg hover:bg-surface-hover transition-colors"
        >
          <div className="flex items-center gap-3">
            <SparklesIcon className="w-5 h-5 text-accent" />
            <div className="text-left">
              <div className="text-sm font-medium text-content">Labs</div>
              <div className="text-xs text-content-tertiary">Try experimental features</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {labsEnabledCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 text-[11px] font-semibold text-white bg-accent rounded-full">
                {labsEnabledCount > 9 ? '9+' : labsEnabledCount}
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
          </a>
          {' '}by Zack Freedman
          <br />
          Tool by{' '}
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
        title="Save as Defaults"
        message={`Save current settings as defaults for new layouts?\n\nDrawer: ${drawer.width}×${drawer.depth}×${drawer.height}u\nLayer height: ${activeLayerHeight}u\nPrint bed: ${printBedSize}mm\nGrid unit: ${gridUnitMm}mm`}
        confirmText="Save"
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

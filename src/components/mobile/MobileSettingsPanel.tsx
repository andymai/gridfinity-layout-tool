import { useState, useMemo, useCallback } from 'react';
import { useLayoutStore, useUndoableAction, useUIStore, useSettingsStore, useToastStore, useLabsStore } from '../../store';
import { useMutations } from '../../context/MutationsContext';
import { getFeature } from '../../labs/features';
import { SparklesIcon, ChevronRightIcon } from '../labs/icons';
import { calcMaxGridUnits, CONSTRAINTS, STAGING_ID } from '../../constants';
import { validateHalfBinModeToggle } from '../../utils/halfBinConstraints';
import type { HalfBinConstraintViolation } from '../../utils/halfBinConstraints';
import type { STLSearchSite } from '../../store/settings';
import { ConfirmDialog } from '../modals/ConfirmDialog';
import { HalfBinModeBlockedModal } from '../modals/HalfBinModeBlockedModal';
import { DeferredNumberInput } from '../DeferredNumberInput';

/**
 * Custom checkbox visual indicator for mobile.
 * Parent element should handle click/keyboard events.
 */
function MobileCheckbox({ checked }: { checked: boolean }) {
  return (
    <div className="relative w-6 h-6 flex-shrink-0 pointer-events-none" aria-hidden="true">
      <div
        className={`w-6 h-6 rounded border-2 transition-colors ${
          checked
            ? 'bg-accent border-accent'
            : 'bg-surface border-stroke'
        }`}
      />
      {checked && (
        <svg className="absolute inset-0 w-6 h-6 text-white p-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
    </div>
  );
}

/**
 * Mobile settings panel with grid configuration and app actions.
 */
export function MobileSettingsPanel() {
  const [showSaveDefaultsConfirm, setShowSaveDefaultsConfirm] = useState(false);
  const [showHalfBinBlockedModal, setShowHalfBinBlockedModal] = useState(false);
  const [halfBinViolation, setHalfBinViolation] = useState<HalfBinConstraintViolation | null>(null);

  const layout = useLayoutStore(state => state.layout);
  const { setGridUnitMm, setHeightUnitMm, setPrintBedSize, updateDrawer, updateBin } = useMutations();

  const maxGridUnits = calcMaxGridUnits(layout.printBedSize, layout.gridUnitMm);
  const { execute } = useUndoableAction();

  const halfBinMode = useUIStore(state => state.halfBinMode);
  const toggleHalfBinMode = useUIStore(state => state.toggleHalfBinMode);
  const setHalfBinMode = useUIStore(state => state.setHalfBinMode);
  const addToast = useToastStore(state => state.addToast);

  const settings = useSettingsStore(state => state.settings);
  const saveCurrentAsDefaults = useSettingsStore(state => state.saveCurrentAsDefaults);
  const updateSetting = useSettingsStore(state => state.updateSetting);

  // STL search site toggle handler
  const toggleSTLSite = useCallback((siteId: string) => {
    const updatedSites = settings.stlSearchSites.map((site: STLSearchSite) =>
      site.id === siteId ? { ...site, enabled: !site.enabled } : site
    );
    updateSetting('stlSearchSites', updatedSites);
  }, [settings.stlSearchSites, updateSetting]);

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

  // Get active layer's height to save as default
  const activeLayerId = useUIStore((state) => state.activeLayerId);
  const layers = useLayoutStore((state) => state.layout.layers);
  const activeLayer = useMemo(
    () => layers.find((l) => l.id === activeLayerId),
    [layers, activeLayerId]
  );

  // Check if dimensions are fractional (for step size calculation)
  const hasFractionalWidth = layout.drawer.width % 1 !== 0;
  const hasFractionalDepth = layout.drawer.depth % 1 !== 0;

  // Use 0.5 step when in half-bin mode OR when dimension is already fractional
  const widthStep = halfBinMode || hasFractionalWidth ? 0.5 : 1;
  const depthStep = halfBinMode || hasFractionalDepth ? 0.5 : 1;

  const handleSaveDefaults = () => {
    const layerHeight = activeLayer?.height ?? 3;
    saveCurrentAsDefaults(layout.drawer, layout.printBedSize, layout.gridUnitMm, layout.heightUnitMm, layerHeight);
    setShowSaveDefaultsConfirm(false);
  };

  const handleDrawerChange = (field: 'width' | 'depth' | 'height', delta: number) => {
    const current = layout.drawer[field];
    const minVal = field === 'height' ? 1 : 0.5;
    const newValue = Math.max(minVal, Math.min(CONSTRAINTS.GRID_MAX, current + delta));
    execute(() => updateDrawer({ [field]: newValue }));
  };

  const handleDrawerWidthStepper = (delta: number) => {
    const step = halfBinMode || hasFractionalWidth ? 0.5 : 1;
    const newWidth = Math.max(0.5, Math.min(CONSTRAINTS.GRID_MAX, layout.drawer.width + delta * step));
    execute(() => updateDrawer({ width: newWidth }));
  };

  const handleDrawerDepthStepper = (delta: number) => {
    const step = halfBinMode || hasFractionalDepth ? 0.5 : 1;
    const newDepth = Math.max(0.5, Math.min(CONSTRAINTS.GRID_MAX, layout.drawer.depth + delta * step));
    execute(() => updateDrawer({ depth: newDepth }));
  };

  const handleDrawerWidthChange = (width: number) => {
    execute(() => updateDrawer({ width: Math.max(0.5, Math.min(CONSTRAINTS.GRID_MAX, width)) }));
  };

  const handleDrawerDepthChange = (depth: number) => {
    execute(() => updateDrawer({ depth: Math.max(0.5, Math.min(CONSTRAINTS.GRID_MAX, depth)) }));
  };

  // Half-bin mode toggle with validation
  const handleHalfBinToggle = () => {
    const result = toggleHalfBinMode();

    if (!result.success) {
      // Validation failed - show blocking modal
      const validationResult = validateHalfBinModeToggle(layout, false);
      if (validationResult.violation) {
        setHalfBinViolation(validationResult.violation);
        setShowHalfBinBlockedModal(true);
      }
    }
  };

  // Remediate fractional bins by moving them to staging
  const handleRemediate = async () => {
    if (!halfBinViolation) return;

    await execute(() => {
      // Move all fractional bins to staging
      halfBinViolation.binIds.forEach(binId => {
        updateBin(binId, { layerId: STAGING_ID });
      });
    });

    // Now disable half-bin mode (forced, bypassing validation)
    setHalfBinMode(false);

    // Close modal and show success message
    setShowHalfBinBlockedModal(false);
    addToast(
      `Moved ${halfBinViolation.count} bin${halfBinViolation.count !== 1 ? 's' : ''} to staging`,
      'success'
    );
  };

  return (
    <div className="pb-4 space-y-6">
      {/* Drawer Dimensions */}
      <section>
        <h3 className="text-xs font-medium uppercase tracking-wide mb-3 text-content-tertiary">
          Drawer Dimensions
        </h3>

        <div className="grid grid-cols-2 gap-3 mb-3">
          {/* Width */}
          <div>
            <label className="block text-sm mb-1 text-content-tertiary">
              Width
            </label>
            <div className="flex items-center">
              <button
                onClick={() => handleDrawerWidthStepper(-1)}
                disabled={layout.drawer.width <= 0.5}
                className="btn btn-secondary w-12 h-12 p-0 rounded-r-none"
                aria-label="Decrease width"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
              </button>
              <DeferredNumberInput
                value={layout.drawer.width}
                onChange={handleDrawerWidthChange}
                min={0.5}
                max={CONSTRAINTS.GRID_MAX}
                step={widthStep}
                className="input flex-1 h-12 text-center font-semibold tabular-nums border-x-0 rounded-none"
                aria-label="Drawer width in grid units"
              />
              <button
                onClick={() => handleDrawerWidthStepper(1)}
                disabled={layout.drawer.width >= CONSTRAINTS.GRID_MAX}
                className="btn btn-secondary w-12 h-12 p-0 rounded-l-none"
                aria-label="Increase width"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
          </div>

          {/* Depth */}
          <div>
            <label className="block text-sm mb-1 text-content-tertiary">
              Depth
            </label>
            <div className="flex items-center">
              <button
                onClick={() => handleDrawerDepthStepper(-1)}
                disabled={layout.drawer.depth <= 0.5}
                className="btn btn-secondary w-12 h-12 p-0 rounded-r-none"
                aria-label="Decrease depth"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
              </button>
              <DeferredNumberInput
                value={layout.drawer.depth}
                onChange={handleDrawerDepthChange}
                min={0.5}
                max={CONSTRAINTS.GRID_MAX}
                step={depthStep}
                className="input flex-1 h-12 text-center font-semibold tabular-nums border-x-0 rounded-none"
                aria-label="Drawer depth in grid units"
              />
              <button
                onClick={() => handleDrawerDepthStepper(1)}
                disabled={layout.drawer.depth >= CONSTRAINTS.GRID_MAX}
                className="btn btn-secondary w-12 h-12 p-0 rounded-l-none"
                aria-label="Increase depth"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Height */}
        <div>
          <label className="block text-sm mb-1 text-content-tertiary">
            Height
          </label>
          <div className="flex items-center">
            <button
              onClick={() => handleDrawerChange('height', -1)}
              disabled={layout.drawer.height <= 1}
              className="btn btn-secondary w-12 h-12 p-0 rounded-r-none"
              aria-label="Decrease height"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            <span className="flex-1 h-12 flex items-center justify-center font-semibold bg-surface-elevated text-content">
              {layout.drawer.height}u
            </span>
            <button
              onClick={() => handleDrawerChange('height', 1)}
              disabled={layout.drawer.height >= CONSTRAINTS.GRID_MAX}
              className="btn btn-secondary w-12 h-12 p-0 rounded-l-none"
              aria-label="Increase height"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>

        {/* Real-world drawer dimensions */}
        <div className="mt-3 flex items-center gap-1.5 text-sm text-content-tertiary">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 12h16M4 12v-2M8 12v-1M12 12v-2M16 12v-1M20 12v-2" />
          </svg>
          <span className="tabular-nums">
            {(layout.drawer.width * layout.gridUnitMm).toFixed(0)} × {(layout.drawer.depth * layout.gridUnitMm).toFixed(0)} × {(layout.drawer.height * layout.heightUnitMm).toFixed(0)} mm
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
          <MobileCheckbox checked={halfBinMode} />
        </div>
      </section>

      {/* Grid Settings */}
      <section>
        <h3 className="text-xs font-medium uppercase tracking-wide mb-3 text-content-tertiary">
          Grid Settings
        </h3>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm text-content-secondary">
              1 grid unit
            </label>
            <div className="flex items-center gap-2">
              <DeferredNumberInput
                value={layout.gridUnitMm}
                onChange={setGridUnitMm}
                className="input w-20 h-10 text-center"
                min={1}
                max={200}
              />
              <span className="text-content-tertiary">mm</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm text-content-secondary">
              1u height
            </label>
            <div className="flex items-center gap-2">
              <DeferredNumberInput
                value={layout.heightUnitMm}
                onChange={setHeightUnitMm}
                className="input w-20 h-10 text-center"
                min={1}
                max={50}
              />
              <span className="text-content-tertiary">mm</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm text-content-secondary">
              Print bed size
            </label>
            <div className="flex items-center gap-2">
              <DeferredNumberInput
                value={layout.printBedSize}
                onChange={setPrintBedSize}
                className="input w-20 h-10 text-center"
                min={42}
                max={500}
                step={10}
              />
              <span className="text-content-tertiary">mm</span>
            </div>
          </div>

          <div className="text-sm text-right text-content-disabled">
            Max bin size: {maxGridUnits}×{maxGridUnits}
          </div>
        </div>
      </section>

      {/* STL Search */}
      <section>
        <h3 className="text-xs font-medium uppercase tracking-wide mb-3 text-content-tertiary">
          STL Search
        </h3>
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
              <MobileCheckbox checked={site.enabled} />
            </div>
          ))}
        </div>
      </section>

      {/* Preferences */}
      <section>
        <h3 className="text-xs font-medium uppercase tracking-wide mb-3 text-content-tertiary">
          Default Preferences
        </h3>

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
        <h3 className="text-xs font-medium uppercase tracking-wide mb-3 text-content-tertiary">
          Experimental
        </h3>
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
        message={`Save current settings as defaults for new layouts?\n\nDrawer: ${layout.drawer.width}×${layout.drawer.depth}×${layout.drawer.height}u\nLayer height: ${activeLayer?.height ?? 3}u\nPrint bed: ${layout.printBedSize}mm\nGrid unit: ${layout.gridUnitMm}mm`}
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

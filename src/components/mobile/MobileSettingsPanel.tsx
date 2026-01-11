import { useState } from 'react';
import { useLayoutStore, useUndoableAction, useUIStore, useSettingsStore } from '../../store';
import { calcMaxGridUnits, CONSTRAINTS } from '../../constants';
import { ConfirmDialog } from '../modals/ConfirmDialog';
import { DeferredNumberInput } from '../DeferredNumberInput';

/**
 * Mobile settings panel with grid configuration and app actions.
 */
export function MobileSettingsPanel() {
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showSaveDefaultsConfirm, setShowSaveDefaultsConfirm] = useState(false);

  const layout = useLayoutStore(state => state.layout);
  const setGridUnitMm = useLayoutStore(state => state.setGridUnitMm);
  const setHeightUnitMm = useLayoutStore(state => state.setHeightUnitMm);
  const setPrintBedSize = useLayoutStore(state => state.setPrintBedSize);
  const updateDrawer = useLayoutStore(state => state.updateDrawer);
  const reset = useLayoutStore(state => state.reset);

  const maxGridUnits = calcMaxGridUnits(layout.printBedSize, layout.gridUnitMm);
  const { execute } = useUndoableAction();

  const halfBinMode = useUIStore(state => state.halfBinMode);
  const toggleHalfBinMode = useUIStore(state => state.toggleHalfBinMode);

  const settings = useSettingsStore(state => state.settings);
  const saveCurrentAsDefaults = useSettingsStore(state => state.saveCurrentAsDefaults);

  const handleSaveDefaults = () => {
    saveCurrentAsDefaults(layout.drawer, layout.printBedSize, layout.gridUnitMm, layout.heightUnitMm);
    setShowSaveDefaultsConfirm(false);
  };

  const handleDrawerChange = (field: 'width' | 'depth' | 'height', delta: number) => {
    const current = layout.drawer[field];
    const newValue = Math.max(1, Math.min(CONSTRAINTS.GRID_MAX, current + delta));
    execute(() => updateDrawer({ [field]: newValue }));
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
                onClick={() => handleDrawerChange('width', -1)}
                disabled={layout.drawer.width <= 1}
                className="btn btn-secondary w-12 h-12 p-0 rounded-r-none"
                aria-label="Decrease width"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
              </button>
              <span className="flex-1 h-12 flex items-center justify-center font-semibold bg-surface-elevated text-content">
                {layout.drawer.width}
              </span>
              <button
                onClick={() => handleDrawerChange('width', 1)}
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
                onClick={() => handleDrawerChange('depth', -1)}
                disabled={layout.drawer.depth <= 1}
                className="btn btn-secondary w-12 h-12 p-0 rounded-r-none"
                aria-label="Decrease depth"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
              </button>
              <span className="flex-1 h-12 flex items-center justify-center font-semibold bg-surface-elevated text-content">
                {layout.drawer.depth}
              </span>
              <button
                onClick={() => handleDrawerChange('depth', 1)}
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

          {/* Half-bin mode checkbox */}
          <label className="flex items-center justify-between pt-3 border-t border-stroke-subtle cursor-pointer">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-content-secondary">Half-bin mode</span>
                <span className="text-[9px] text-amber-500/80 bg-amber-500/10 px-1 py-0.5 rounded">experimental</span>
              </div>
              <p className="text-xs text-content-tertiary">Allow 0.5 unit precision</p>
            </div>
            <input
              type="checkbox"
              checked={halfBinMode}
              onChange={toggleHalfBinMode}
              className="w-5 h-5 rounded accent-accent"
              aria-label="Toggle half-bin mode"
            />
          </label>
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

      {/* Actions */}
      <section>
        <h3 className="text-xs font-medium uppercase tracking-wide mb-3 text-content-tertiary">
          Actions
        </h3>

        <div className="space-y-2">
          <button
            onClick={() => setShowResetConfirm(true)}
            className="btn btn-danger w-full"
          >
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v16m4-8h12m-12 0l4-4m-4 4l4 4" />
            </svg>
            Reset to Defaults
          </button>
        </div>
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
        isOpen={showResetConfirm}
        title="Reset to Defaults"
        message="This will clear your layout and restore all default settings. This cannot be undone."
        confirmText="Reset"
        destructive
        onConfirm={() => { reset(); setShowResetConfirm(false); }}
        onCancel={() => setShowResetConfirm(false)}
      />

      <ConfirmDialog
        isOpen={showSaveDefaultsConfirm}
        title="Save as Defaults"
        message={`Save current settings as defaults for new layouts?\n\nDrawer: ${layout.drawer.width}×${layout.drawer.depth}×${layout.drawer.height}u\nPrint bed: ${layout.printBedSize}mm\nGrid unit: ${layout.gridUnitMm}mm`}
        confirmText="Save"
        onConfirm={handleSaveDefaults}
        onCancel={() => setShowSaveDefaultsConfirm(false)}
      />
    </div>
  );
}

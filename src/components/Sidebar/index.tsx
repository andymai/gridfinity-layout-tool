import { useState, useMemo } from 'react';
import { useShallow } from 'zustand/shallow';
import { useUIStore, useLayoutStore, useSettingsStore, useToastStore } from '../../store';
import { useUndoableAction } from '../../store/history';
import { calcMaxGridUnits, CONSTRAINTS, STAGING_ID } from '../../constants';
import { validateHalfBinModeToggle } from '../../utils/halfBinConstraints';
import type { HalfBinConstraintViolation } from '../../utils/halfBinConstraints';
import { ActiveLayerPanel } from './ActiveLayerPanel';
import { LayerPanel } from './LayerPanel';
import { CategoriesPanel } from './CategoriesPanel';
import { DeferredNumberInput } from '../DeferredNumberInput';
import { ConfirmDialog } from '../modals/ConfirmDialog';
import { HalfBinModeBlockedModal } from '../modals/HalfBinModeBlockedModal';
import { CollapsibleSection } from '../CollapsibleSection';
import { useResponsive } from '../../hooks/useResponsive';

export function Sidebar() {
  const [showSaveDefaultsConfirm, setShowSaveDefaultsConfirm] = useState(false);
  const [showHalfBinBlockedModal, setShowHalfBinBlockedModal] = useState(false);
  const [halfBinViolation, setHalfBinViolation] = useState<HalfBinConstraintViolation | null>(null);
  const { isDesktop } = useResponsive();

  const { collapsed, toggle, halfBinMode, toggleHalfBinMode, setHalfBinMode } = useUIStore(
    useShallow((state) => ({
      collapsed: state.leftPanelCollapsed,
      toggle: state.toggleLeftPanel,
      halfBinMode: state.halfBinMode,
      toggleHalfBinMode: state.toggleHalfBinMode,
      setHalfBinMode: state.setHalfBinMode,
    }))
  );

  const {
    layout,
    gridUnitMm,
    heightUnitMm,
    printBedSize,
    drawerWidth,
    drawerDepth,
    drawerHeight,
    setGridUnitMm,
    setHeightUnitMm,
    setPrintBedSize,
    updateDrawer,
    updateBin,
  } = useLayoutStore(
    useShallow((state) => ({
      layout: state.layout,
      gridUnitMm: state.layout.gridUnitMm,
      heightUnitMm: state.layout.heightUnitMm,
      printBedSize: state.layout.printBedSize,
      drawerWidth: state.layout.drawer.width,
      drawerDepth: state.layout.drawer.depth,
      drawerHeight: state.layout.drawer.height,
      setGridUnitMm: state.setGridUnitMm,
      setHeightUnitMm: state.setHeightUnitMm,
      setPrintBedSize: state.setPrintBedSize,
      updateDrawer: state.updateDrawer,
      updateBin: state.updateBin,
    }))
  );

  const settings = useSettingsStore((state) => state.settings);
  const saveCurrentAsDefaults = useSettingsStore((state) => state.saveCurrentAsDefaults);
  const addToast = useToastStore((state) => state.addToast);
  const { execute } = useUndoableAction();

  // Get active layer's height to save as default
  const activeLayerId = useUIStore((state) => state.activeLayerId);
  const layers = useLayoutStore((state) => state.layout.layers);
  const activeLayer = useMemo(
    () => layers.find((l) => l.id === activeLayerId),
    [layers, activeLayerId]
  );

  const handleSaveDefaults = () => {
    const layerHeight = activeLayer?.height ?? 3;
    saveCurrentAsDefaults(
      { width: drawerWidth, depth: drawerDepth, height: drawerHeight },
      printBedSize,
      gridUnitMm,
      heightUnitMm,
      layerHeight
    );
    setShowSaveDefaultsConfirm(false);
  };

  const handleDrawerHeightChange = (delta: number) => {
    const newHeight = Math.max(1, drawerHeight + delta);
    updateDrawer({ height: newHeight });
  };

  const handleDrawerWidthChange = (width: number) => {
    updateDrawer({ width: Math.max(0.5, Math.min(CONSTRAINTS.GRID_MAX, width)) });
  };

  const handleDrawerDepthChange = (depth: number) => {
    updateDrawer({ depth: Math.max(0.5, Math.min(CONSTRAINTS.GRID_MAX, depth)) });
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
    <aside
      className="flex-shrink-0 flex flex-col transition-all duration-200 ease-in-out bg-surface-secondary border-r border-stroke-subtle"
      style={{ width: collapsed ? '40px' : '288px' }}
    >
      {collapsed ? (
        // Collapsed state - just show expand button
        <div className="flex flex-col items-center py-3">
          <button
            onClick={toggle}
            className="p-1 rounded transition-colors text-content-secondary hover:bg-surface-hover hover:text-content"
            title="Expand panel"
            aria-label="Expand left panel"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      ) : (
        // Expanded state
        <>
          <div className="flex items-center gap-3 px-4 py-3 border-b border-stroke-subtle">
            <h2 className="flex-1 text-xs font-semibold text-content-tertiary uppercase tracking-wider">
              Tools
            </h2>
            <button
              onClick={toggle}
              className="p-1 rounded transition-colors text-content-tertiary hover:bg-surface-hover hover:text-content"
              title="Collapse panel"
              aria-label="Collapse left panel"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin flex flex-col">
            <div className="px-4 py-4 border-b border-stroke-subtle">
              <ActiveLayerPanel />
            </div>
            <div className="px-4 py-4 border-b border-stroke-subtle">
              <LayerPanel />
            </div>
            <div className="px-4 py-4 border-b border-stroke-subtle">
              <CategoriesPanel />
            </div>

            {/* Grid Size */}
            <div className="mt-auto px-4 py-4">
              <CollapsibleSection title="Grid Size" variant="default">
                <div className="text-xs text-content-secondary space-y-2">
                  {/* Width / Depth / Height in compact grid */}
                  <div className="grid grid-cols-3 gap-1.5">
                    <div>
                      <label className="block text-content-tertiary mb-1" title="Number of grid units wide (supports 0.5 increments)">
                        Width
                      </label>
                      <DeferredNumberInput
                        value={drawerWidth}
                        onChange={handleDrawerWidthChange}
                        min={0.5}
                        max={CONSTRAINTS.GRID_MAX}
                        step={0.5}
                        className="input w-full h-6 text-xs text-center tabular-nums"
                        aria-label="Drawer width in grid units"
                      />
                    </div>
                    <div>
                      <label className="block text-content-tertiary mb-1" title="Number of grid units deep (supports 0.5 increments)">
                        Depth
                      </label>
                      <DeferredNumberInput
                        value={drawerDepth}
                        onChange={handleDrawerDepthChange}
                        min={0.5}
                        max={CONSTRAINTS.GRID_MAX}
                        step={0.5}
                        className="input w-full h-6 text-xs text-center tabular-nums"
                        aria-label="Drawer depth in grid units"
                      />
                    </div>
                    <div>
                      <label className="block text-content-tertiary mb-1" title="Maximum height in units">
                        Height
                      </label>
                      <div className="flex items-center h-6">
                        <button
                          onClick={() => handleDrawerHeightChange(-1)}
                          disabled={drawerHeight <= 1}
                          className="h-full px-1 rounded-l border border-r-0 border-stroke-subtle bg-surface-elevated text-content-tertiary hover:text-content hover:bg-surface-hover disabled:opacity-30 transition-colors"
                          aria-label="Decrease height"
                        >
                          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" d="M20 12H4" />
                          </svg>
                        </button>
                        <span className="flex-1 h-full flex items-center justify-center border-y border-stroke-subtle bg-surface text-center tabular-nums text-content-secondary text-xs">
                          {drawerHeight}u
                        </span>
                        <button
                          onClick={() => handleDrawerHeightChange(1)}
                          className="h-full px-1 rounded-r border border-l-0 border-stroke-subtle bg-surface-elevated text-content-tertiary hover:text-content hover:bg-surface-hover transition-colors"
                          aria-label="Increase height"
                        >
                          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" d="M12 4v16m8-8H4" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                  {/* Real-world drawer dimensions */}
                  <div className="flex items-center justify-center gap-1 pt-1 text-content-tertiary">
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 12h16M4 12v-2M8 12v-1M12 12v-2M16 12v-1M20 12v-2" />
                    </svg>
                    <span className="tabular-nums">
                      {(drawerWidth * gridUnitMm).toFixed(0)} × {(drawerDepth * gridUnitMm).toFixed(0)} × {(drawerHeight * heightUnitMm).toFixed(0)} mm
                    </span>
                  </div>
                </div>
              </CollapsibleSection>
            </div>

            {/* Physical Units */}
            <div className="px-4 py-4 border-t border-stroke-subtle">
              <CollapsibleSection title="Physical Units" variant="default" defaultExpanded={isDesktop}>
                <div className="text-xs text-content-secondary space-y-2">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="gridUnit"
                      className="text-content-tertiary"
                      title="Size of one grid unit in mm (standard Gridfinity = 42mm)"
                    >
                      Grid unit
                    </label>
                    <div className="flex items-center gap-1">
                      <DeferredNumberInput
                        id="gridUnit"
                        value={gridUnitMm}
                        onChange={setGridUnitMm}
                        min={1}
                        max={200}
                        className="input w-14 py-0.5 px-1 text-xs text-right"
                      />
                      <span className="text-content-tertiary">mm</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="heightUnit"
                      className="text-content-tertiary"
                      title="Height of one vertical unit in mm (standard = 7mm)"
                    >
                      Height unit
                    </label>
                    <div className="flex items-center gap-1">
                      <DeferredNumberInput
                        id="heightUnit"
                        value={heightUnitMm}
                        onChange={setHeightUnitMm}
                        min={1}
                        max={50}
                        className="input w-14 py-0.5 px-1 text-xs text-right"
                      />
                      <span className="text-content-tertiary">mm</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="printBedSize"
                      className="text-content-tertiary"
                      title={`Bins larger than ${calcMaxGridUnits(printBedSize, gridUnitMm)}×${calcMaxGridUnits(printBedSize, gridUnitMm)} will be split for printing`}
                    >
                      Print bed
                    </label>
                    <div className="flex items-center gap-1">
                      <DeferredNumberInput
                        id="printBedSize"
                        value={printBedSize}
                        onChange={setPrintBedSize}
                        min={42}
                        max={500}
                        step={10}
                        className="input w-14 py-0.5 px-1 text-xs text-right"
                      />
                      <span className="text-content-tertiary">mm</span>
                    </div>
                  </div>
                  {/* Half-bin mode checkbox */}
                  <label className="flex items-center justify-between pt-2 mt-2 border-t border-stroke-subtle cursor-pointer">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="text-content-tertiary"
                        title="Enable 0.5 grid unit precision for half-size bins (H)"
                      >
                        Half-bin mode
                      </span>
                      <span className="text-[9px] text-amber-500/80 bg-amber-500/10 px-1 py-0.5 rounded">experimental</span>
                      <kbd className="text-[9px] text-content-disabled bg-surface-elevated px-1 py-0.5 rounded border border-stroke-subtle">H</kbd>
                    </div>
                    <input
                      type="checkbox"
                      checked={halfBinMode}
                      onChange={handleHalfBinToggle}
                      className="w-4 h-4 rounded accent-accent"
                      aria-label="Toggle half-bin mode"
                    />
                  </label>
                </div>
              </CollapsibleSection>
            </div>

            {/* Default Preferences */}
            <div className="px-4 py-4 border-t border-stroke-subtle">
              <CollapsibleSection title="Default Preferences" variant="default" defaultExpanded={true}>
                <div className="text-xs text-content-tertiary mb-2">
                  New layouts will use:
                </div>
                <div className="text-xs text-content-secondary space-y-1 mb-3">
                  <div>Drawer: {settings.defaultDrawerWidth}×{settings.defaultDrawerDepth}×{settings.defaultDrawerHeight}u</div>
                  <div>Layer height: {settings.defaultLayerHeight}u</div>
                  <div>Print bed: {settings.defaultPrintBedSize}mm</div>
                  <div>Grid unit: {settings.defaultGridUnitMm}mm</div>
                </div>
                <button
                  onClick={() => setShowSaveDefaultsConfirm(true)}
                  className="w-full text-xs py-1.5 px-2 rounded bg-surface-elevated hover:bg-surface-hover text-content-secondary hover:text-content border border-stroke-subtle transition-colors"
                  title="Save current layout settings as defaults for new layouts"
                >
                  Save Current as Defaults
                </button>
              </CollapsibleSection>
            </div>

            {/* Attribution */}
            <div className="px-4 py-4 border-t border-stroke-subtle text-content-disabled text-[10px] leading-relaxed">
              Gridfinity by{' '}
              <a
                href="https://www.youtube.com/c/ZackFreedman"
                target="_blank"
                rel="noopener noreferrer"
                className="text-content-tertiary hover:underline"
              >
                Zack Freedman
              </a>
              <br />
              Tool by{' '}
              <a
                href="https://www.linkedin.com/in/andyhmai/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-content-tertiary hover:underline"
              >
                Andy Aragon
              </a>
              {' '}·{' '}
              <a
                href="https://ko-fi.com/andyaragon"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline"
              >
                <svg className="w-3 h-3 inline-block align-text-bottom mr-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                </svg>
                Tip
              </a>
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        isOpen={showSaveDefaultsConfirm}
        title="Save as Defaults"
        message={`Save current settings as defaults for new layouts?\n\nDrawer: ${drawerWidth}×${drawerDepth}×${drawerHeight}u\nLayer height: ${activeLayer?.height ?? 3}u\nPrint bed: ${printBedSize}mm\nGrid unit: ${gridUnitMm}mm`}
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
    </aside>
  );
}

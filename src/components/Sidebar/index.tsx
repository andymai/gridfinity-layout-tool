import { useShallow } from 'zustand/shallow';
import { useUIStore, useLayoutStore } from '../../store';
import { calcMaxGridUnits } from '../../constants';
import { ActiveLayerPanel } from './ActiveLayerPanel';
import { LayerPanel } from './LayerPanel';
import { CategoriesPanel } from './CategoriesPanel';

export function Sidebar() {
  const { collapsed, toggle } = useUIStore(
    useShallow((state) => ({
      collapsed: state.leftPanelCollapsed,
      toggle: state.toggleLeftPanel,
    }))
  );

  const {
    gridUnitMm,
    heightUnitMm,
    printBedSize,
    drawerHeight,
    setGridUnitMm,
    setHeightUnitMm,
    setPrintBedSize,
    updateDrawer,
  } = useLayoutStore(
    useShallow((state) => ({
      gridUnitMm: state.layout.gridUnitMm,
      heightUnitMm: state.layout.heightUnitMm,
      printBedSize: state.layout.printBedSize,
      drawerHeight: state.layout.drawer.height,
      setGridUnitMm: state.setGridUnitMm,
      setHeightUnitMm: state.setHeightUnitMm,
      setPrintBedSize: state.setPrintBedSize,
      updateDrawer: state.updateDrawer,
    }))
  );

  const handleDrawerHeightChange = (delta: number) => {
    const newHeight = Math.max(1, drawerHeight + delta);
    updateDrawer({ height: newHeight });
  };

  return (
    <aside
      className="flex-shrink-0 flex flex-col transition-all duration-200 ease-in-out bg-surface-secondary border-r border-stroke-subtle"
      style={{ width: collapsed ? '40px' : '288px' }}
    >
      {collapsed ? (
        // Collapsed state - just show expand button
        <div className="flex flex-col items-center pt-3">
          <button
            onClick={toggle}
            className="p-2 rounded-md transition-colors text-content-secondary hover:bg-surface-hover hover:text-content"
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

            {/* Grid Settings */}
            <div className="mt-auto px-4 py-4">
              <h2 className="text-sm font-semibold text-content-secondary tracking-wide mb-3">
                Grid Settings
              </h2>
              <div className="text-xs text-content-secondary space-y-2">
                <div className="flex items-center justify-between">
                  <span
                    className="text-content-tertiary"
                    title="Total height available for all layers (in height units)"
                  >
                    Drawer height
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDrawerHeightChange(-1)}
                      disabled={drawerHeight <= 1}
                      className="w-5 h-5 flex items-center justify-center text-content-tertiary hover:text-content disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      aria-label="Decrease drawer height"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                      </svg>
                    </button>
                    <span className="tabular-nums min-w-[28px] text-center text-content-secondary">
                      {drawerHeight}u
                    </span>
                    <button
                      onClick={() => handleDrawerHeightChange(1)}
                      className="w-5 h-5 flex items-center justify-center text-content-tertiary hover:text-content transition-colors"
                      aria-label="Increase drawer height"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
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
                    <input
                      id="printBedSize"
                      type="number"
                      value={printBedSize}
                      onChange={(e) => setPrintBedSize(Number(e.target.value))}
                      min={42}
                      max={500}
                      step={10}
                      className="input w-14 py-0.5 px-1 text-xs text-right"
                    />
                    <span className="text-content-tertiary">mm</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="gridUnit"
                    className="text-content-tertiary"
                    title="Size of one grid unit in mm (standard Gridfinity = 42mm)"
                  >
                    1 grid unit
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      id="gridUnit"
                      type="number"
                      value={gridUnitMm}
                      onChange={(e) => setGridUnitMm(Number(e.target.value))}
                      min={1}
                      max={200}
                      className="input w-12 py-0.5 px-1 text-xs text-right"
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
                    1u height
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      id="heightUnit"
                      type="number"
                      value={heightUnitMm}
                      onChange={(e) => setHeightUnitMm(Number(e.target.value))}
                      min={1}
                      max={50}
                      className="input w-12 py-0.5 px-1 text-xs text-right"
                    />
                    <span className="text-content-tertiary">mm</span>
                  </div>
                </div>
              </div>
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
                Tip
              </a>
            </div>
          </div>
        </>
      )}
    </aside>
  );
}

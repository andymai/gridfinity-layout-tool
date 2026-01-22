import { useState, useRef, useCallback } from 'react';
import { useShallow } from 'zustand/shallow';
import { useUIStore } from '@/core/store';
import { useDrawerSettings } from '@/hooks/useDrawerSettings';
import { CONSTRAINTS } from '@/core/constants';
import { ActiveLayerPanel } from '@/features/layers/components/ActiveLayerPanel';
import { LayerPanel } from '@/features/layers/components/LayerPanel';
import { CategoriesPanel } from '@/features/categories/components/CategoriesPanel';
import { DeferredNumberInput } from '@/shared/components/DeferredNumberInput';
import { StepperControl } from '@/shared/components/StepperControl';
import { HalfBinModeBlockedModal, SettingsModal } from '@/components/Modals';
import { CollapsibleSection } from '@/shared/components/CollapsibleSection';
import { useResponsive } from '@/shared/hooks';
import { Checkbox } from '@/shared/components/Checkbox';
import { SettingsRow } from '@/shared/components/SettingsRow';
import { InspirationGallery } from '@/features/inspiration-gallery';

export function Sidebar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [showInspirationGallery, setShowInspirationGallery] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { isDesktop } = useResponsive();

  const handleScroll = useCallback(() => {
    if (scrollRef.current) {
      setIsScrolled(scrollRef.current.scrollTop > 0);
    }
  }, []);

  const { collapsed, toggle } = useUIStore(
    useShallow((state) => ({
      collapsed: state.leftPanelCollapsed,
      toggle: state.toggleLeftPanel,
    }))
  );

  // Use consolidated drawer settings hook
  const {
    drawer,
    fractionalEdges,
    widthStep,
    depthStep,
    hasFractionalWidth,
    hasFractionalDepth,
    realWorldDimensions,
    gridUnitMm,
    heightUnitMm,
    printBedSize,
    halfBinMode,
    handleDrawerWidthChange,
    handleDrawerDepthChange,
    handleDrawerHeightChange,
    handleDrawerWidthInput,
    handleDrawerDepthInput,
    handleFractionalEdgeChange,
    handleHalfBinToggle,
    handleRemediate,
    setGridUnitMm,
    setHeightUnitMm,
    setPrintBedSize,
    showHalfBinBlockedModal,
    setShowHalfBinBlockedModal,
    halfBinViolation,
  } = useDrawerSettings();

  return (
    <aside
      data-sidebar
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
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 5l7 7-7 7M5 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>
      ) : (
        // Expanded state
        <>
          <div
            className={`flex items-center gap-3 px-4 py-3 border-b border-stroke-subtle transition-shadow duration-200 ${
              isScrolled ? 'shadow-[0_2px_8px_rgba(0,0,0,0.5)]' : ''
            }`}
          >
            <h2 className="flex-1 text-xs font-semibold text-content-tertiary uppercase tracking-wider">
              Tools
            </h2>
            <button
              onClick={() => setShowSettingsModal(true)}
              className="p-1 rounded transition-colors text-content-tertiary hover:bg-surface-hover hover:text-content"
              title="Settings"
              aria-label="Open settings"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </button>
            <button
              onClick={toggle}
              className="p-1 rounded transition-colors text-content-tertiary hover:bg-surface-hover hover:text-content"
              title="Collapse panel"
              aria-label="Collapse left panel"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
                />
              </svg>
            </button>
          </div>
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto scrollbar-thin flex flex-col"
          >
            <div data-active-layer-panel className="px-4 py-4 border-b border-stroke-subtle">
              <ActiveLayerPanel />
            </div>
            <div data-layers-panel className="px-4 py-4 border-b border-stroke-subtle">
              <LayerPanel />
            </div>
            <div data-categories-panel className="px-4 py-4 border-b border-stroke-subtle">
              <CategoriesPanel />
            </div>

            {/* Inspiration Gallery - Prominent placement */}
            <div className="px-4 py-4 border-b border-stroke-subtle">
              <button
                onClick={() => setShowInspirationGallery(true)}
                className="w-full flex items-center gap-3 text-left p-3 rounded-lg bg-gradient-to-r from-accent/10 to-purple-500/10 hover:from-accent/20 hover:to-purple-500/20 border border-accent/20 transition-all group"
              >
                <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <svg
                    className="w-5 h-5 text-accent"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
                    />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-content">Inspiration Gallery</div>
                  <div className="text-xs text-content-tertiary">Get ideas for your drawer</div>
                </div>
                <svg
                  className="w-4 h-4 text-content-tertiary group-hover:translate-x-0.5 transition-transform"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>

            {/* Grid Size */}
            <div data-grid-size-panel className="mt-auto px-4 py-4">
              <CollapsibleSection title="Grid Size" variant="default">
                <div className="text-xs text-content-secondary space-y-2">
                  {/* Width / Depth / Height in compact grid */}
                  <div className="grid grid-cols-3 gap-1.5">
                    <div>
                      <label
                        className="block text-content-tertiary mb-1"
                        title={`Width in grid units (step: ${widthStep})`}
                      >
                        Width
                      </label>
                      <StepperControl
                        value={drawer.width}
                        onChange={handleDrawerWidthInput}
                        onStep={handleDrawerWidthChange}
                        min={0.5}
                        max={CONSTRAINTS.GRID_MAX}
                        step={widthStep}
                        variant="compact"
                        ariaLabel="Drawer width in grid units"
                      />
                    </div>
                    <div>
                      <label
                        className="block text-content-tertiary mb-1"
                        title={`Depth in grid units (step: ${depthStep})`}
                      >
                        Depth
                      </label>
                      <StepperControl
                        value={drawer.depth}
                        onChange={handleDrawerDepthInput}
                        onStep={handleDrawerDepthChange}
                        min={0.5}
                        max={CONSTRAINTS.GRID_MAX}
                        step={depthStep}
                        variant="compact"
                        ariaLabel="Drawer depth in grid units"
                      />
                    </div>
                    <div>
                      <label
                        className="block text-content-tertiary mb-1"
                        title="Maximum height in units"
                      >
                        Height
                      </label>
                      <StepperControl
                        value={drawer.height}
                        onStep={handleDrawerHeightChange}
                        min={1}
                        max={CONSTRAINTS.GRID_MAX}
                        variant="compact"
                        ariaLabel="Drawer height in units"
                        displayValue={`${drawer.height}u`}
                      />
                    </div>
                  </div>

                  {/* Real-world drawer dimensions */}
                  <div className="flex items-center justify-center gap-1 pt-2 text-content-tertiary">
                    <svg
                      className="w-3.5 h-3.5 flex-shrink-0"
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
                      {realWorldDimensions.width.toFixed(0)} ×{' '}
                      {realWorldDimensions.depth.toFixed(0)} ×{' '}
                      {realWorldDimensions.height.toFixed(0)} mm
                    </span>
                  </div>

                  {/* Half-bin mode toggle */}
                  <div
                    className="flex items-center justify-between pt-2 cursor-pointer"
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
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`leading-none ${halfBinMode ? 'text-content' : 'text-content-tertiary'}`}
                        title="Enable 0.5 grid unit precision for half-size bins (H)"
                      >
                        Half-bin mode
                      </span>
                      <span className="text-[9px] leading-none text-amber-500/80 bg-amber-500/10 px-1 py-0.5 rounded">
                        experimental
                      </span>
                      <kbd className="text-[9px] leading-none text-content-disabled bg-surface-elevated px-1 py-0.5 rounded border border-stroke-subtle">
                        H
                      </kbd>
                    </div>
                    <Checkbox checked={halfBinMode} variant="desktop" />
                  </div>

                  {/* Fractional edge position toggles - only shown when dimensions are fractional */}
                  {(hasFractionalWidth || hasFractionalDepth) && (
                    <div className="pt-2 space-y-1.5">
                      <div className="text-content-tertiary text-[10px] mb-1">
                        Half-unit edge position
                      </div>
                      {hasFractionalWidth && (
                        <div className="flex items-center justify-between">
                          <span className="text-content-tertiary">Width (+.5)</span>
                          <div className="flex rounded overflow-hidden border border-stroke-subtle">
                            <button
                              onClick={() => handleFractionalEdgeChange('x', 'start')}
                              className={`px-2 py-0.5 text-[10px] transition-colors ${
                                fractionalEdges.x === 'start'
                                  ? 'bg-accent text-white'
                                  : 'bg-surface-elevated text-content-tertiary hover:bg-surface-hover'
                              }`}
                              title="Place half-unit column on the left"
                            >
                              Left
                            </button>
                            <button
                              onClick={() => handleFractionalEdgeChange('x', 'end')}
                              className={`px-2 py-0.5 text-[10px] border-l border-stroke-subtle transition-colors ${
                                fractionalEdges.x === 'end'
                                  ? 'bg-accent text-white'
                                  : 'bg-surface-elevated text-content-tertiary hover:bg-surface-hover'
                              }`}
                              title="Place half-unit column on the right"
                            >
                              Right
                            </button>
                          </div>
                        </div>
                      )}
                      {hasFractionalDepth && (
                        <div className="flex items-center justify-between">
                          <span className="text-content-tertiary">Depth (+.5)</span>
                          <div className="flex rounded overflow-hidden border border-stroke-subtle">
                            <button
                              onClick={() => handleFractionalEdgeChange('y', 'start')}
                              className={`px-2 py-0.5 text-[10px] transition-colors ${
                                fractionalEdges.y === 'start'
                                  ? 'bg-accent text-white'
                                  : 'bg-surface-elevated text-content-tertiary hover:bg-surface-hover'
                              }`}
                              title="Place half-unit row at the bottom"
                            >
                              Bottom
                            </button>
                            <button
                              onClick={() => handleFractionalEdgeChange('y', 'end')}
                              className={`px-2 py-0.5 text-[10px] border-l border-stroke-subtle transition-colors ${
                                fractionalEdges.y === 'end'
                                  ? 'bg-accent text-white'
                                  : 'bg-surface-elevated text-content-tertiary hover:bg-surface-hover'
                              }`}
                              title="Place half-unit row at the top"
                            >
                              Top
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CollapsibleSection>
            </div>

            {/* Physical Units */}
            <div data-units-panel className="px-4 py-4 border-t border-stroke-subtle">
              <CollapsibleSection
                title="Physical Units"
                variant="default"
                defaultExpanded={isDesktop}
              >
                <div className="text-xs text-content-secondary space-y-2">
                  <SettingsRow
                    label="Grid unit"
                    htmlFor="gridUnit"
                    tooltip="Size of one grid unit in mm (standard Gridfinity = 42mm)"
                    unit="mm"
                  >
                    <DeferredNumberInput
                      id="gridUnit"
                      value={gridUnitMm}
                      onChange={setGridUnitMm}
                      min={1}
                      max={200}
                      className="input w-14 py-0.5 px-1 text-xs text-right"
                    />
                  </SettingsRow>
                  <SettingsRow
                    label="Height unit"
                    htmlFor="heightUnit"
                    tooltip="Height of one vertical unit in mm (standard = 7mm)"
                    unit="mm"
                  >
                    <DeferredNumberInput
                      id="heightUnit"
                      value={heightUnitMm}
                      onChange={setHeightUnitMm}
                      min={1}
                      max={50}
                      className="input w-14 py-0.5 px-1 text-xs text-right"
                    />
                  </SettingsRow>
                  <SettingsRow
                    label="Print bed"
                    htmlFor="printBedSize"
                    tooltip={`Bins larger than ${Math.floor((printBedSize - 10) / gridUnitMm)}×${Math.floor((printBedSize - 10) / gridUnitMm)} will be split for printing`}
                    unit="mm"
                  >
                    <DeferredNumberInput
                      id="printBedSize"
                      value={printBedSize}
                      onChange={setPrintBedSize}
                      min={42}
                      max={500}
                      step={10}
                      className="input w-14 py-0.5 px-1 text-xs text-right"
                    />
                  </SettingsRow>
                </div>
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
              </a>{' '}
              ·{' '}
              <a
                href="https://ko-fi.com/andyaragon"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline"
              >
                <svg
                  className="w-3 h-3 inline-block align-text-bottom mr-0.5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
                Tip
              </a>
            </div>
          </div>
        </>
      )}

      {halfBinViolation && (
        <HalfBinModeBlockedModal
          isOpen={showHalfBinBlockedModal}
          violation={halfBinViolation}
          onClose={() => setShowHalfBinBlockedModal(false)}
          onRemediate={handleRemediate}
        />
      )}

      <InspirationGallery
        isOpen={showInspirationGallery}
        onClose={() => setShowInspirationGallery(false)}
      />

      <SettingsModal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} />
    </aside>
  );
}

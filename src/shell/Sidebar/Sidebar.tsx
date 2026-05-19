import { useState, useRef, useCallback, useEffect, Suspense } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useViewStore } from '@/core/store/view';
import { useDrawerSettings } from '@/shared/hooks/useDrawerSettings';
import { CONSTRAINTS } from '@/core/constants';
import { RulerIcon } from '@/design-system/Icon';
import type { SettingsTabId } from '@/shell/Modals/SettingsModal/types';
import { ActiveLayerPanel } from '@/features/layers/components/ActiveLayerPanel';
import { LayerPanel } from '@/features/layers/components/LayerPanel';
import { CategoriesPanel } from '@/features/categories/components/CategoriesPanel';
import { DeferredNumberInput } from '@/shared/components/DeferredNumberInput';
import { PrintBedInput } from '@/shared/components/PrintBedInput';
import { StepperControl } from '@/shared/components/StepperControl';
import { HalfGridModeBlockedModal } from '@/shell/Modals';
import { CollapsibleSection } from '@/shared/components/CollapsibleSection';
import { LoadingFallback } from '@/shared/components/LoadingFallback';
import { useResponsive } from '@/shared/hooks';
import { useFeatureFlag } from '@/shared/hooks/useFeatureFlag';
import { Checkbox } from '@/shared/components/Checkbox';
import { SettingsRow } from '@/shared/components/SettingsRow';
import { UserDock } from '@/shared/components/UserDock';
import { lazyWithRetry, namedExport } from '@/shared/utils/lazyWithRetry';
import { useTranslation } from '@/i18n';
import { useOnboarding } from '@/features/onboarding';
import { ICON_PATHS } from '@/shared/constants/iconPaths';
import { helpJumpEventName } from '@/shared/help/helpJumpDispatcher';

// Lazy load modals/galleries - only loaded when opened (using lazyWithRetry for PWA resilience)
const InspirationGallery = lazyWithRetry(() =>
  import('@/features/inspiration-gallery').then(namedExport('InspirationGallery'))
);
const SettingsModal = lazyWithRetry(() =>
  import('@/shell/Modals/SettingsModal').then(namedExport('SettingsModal'))
);

/**
 * Renders the left-hand Tools sidebar with collapsed and expanded states, user controls for drawer/grid settings, and access to auxiliary panels.
 *
 * The component displays panels for active layer, layers, categories, an Inspiration Gallery entry, and physical/grid unit settings. It supports a half-bin mode and fractional-edge controls when applicable, and conditionally mounts lazy-loaded modals for the Inspiration Gallery and Settings.
 *
 * @returns The sidebar element as JSX to be mounted in the application layout.
 */
export function Sidebar() {
  const t = useTranslation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [showInspirationGallery, setShowInspirationGallery] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<SettingsTabId | undefined>(
    undefined
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const { isDesktop } = useResponsive();
  const [gridSizeExpanded, setGridSizeExpanded] = useState(true);
  const [physicalUnitsExpanded, setPhysicalUnitsExpanded] = useState(isDesktop);
  const cloudSyncEnabled = useFeatureFlag('cloud_sync');

  const handleScroll = useCallback(() => {
    if (scrollRef.current) {
      setIsScrolled(scrollRef.current.scrollTop > 0);
    }
  }, []);

  const { collapsed, toggle } = useViewStore(
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
    printBedDepth,
    maxGridUnits,
    halfGridMode,
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

  // Onboarding — sidebar gallery pulse for low-engagement users
  const { shouldPulseGallery, dismissGalleryPulse } = useOnboarding();

  // Listen for command palette open-settings-modal event (supports optional tab)
  useEffect(() => {
    const handleOpenSettings = (e: CustomEvent<{ tab?: SettingsTabId }>) => {
      setSettingsInitialTab(e.detail.tab);
      setShowSettingsModal(true);
    };
    window.addEventListener('open-settings-modal', handleOpenSettings as EventListener);
    return () =>
      window.removeEventListener('open-settings-modal', handleOpenSettings as EventListener);
  }, []);

  // Help modal deep-links: expand the destination section so the highlighted
  // control is visible when the dispatcher applies its pulse. Also ensure the
  // sidebar itself is uncollapsed — a jump while the left panel is closed
  // would target an offscreen control.
  useEffect(() => {
    const ensureSidebarOpen = () => {
      const state = useViewStore.getState();
      if (state.leftPanelCollapsed) state.toggleLeftPanel();
    };

    const handlers: Record<string, () => void> = {
      [helpJumpEventName('sidebar:grid-size')]: () => {
        ensureSidebarOpen();
        setGridSizeExpanded(true);
      },
      [helpJumpEventName('sidebar:physical-units')]: () => {
        ensureSidebarOpen();
        setPhysicalUnitsExpanded(true);
      },
      [helpJumpEventName('sidebar:layers')]: ensureSidebarOpen,
      [helpJumpEventName('sidebar:categories')]: ensureSidebarOpen,
    };

    for (const [name, fn] of Object.entries(handlers)) {
      window.addEventListener(name, fn);
    }
    return () => {
      for (const [name, fn] of Object.entries(handlers)) {
        window.removeEventListener(name, fn);
      }
    };
  }, []);

  return (
    <aside
      data-sidebar
      className="flex-shrink-0 flex flex-col transition-all duration-200 ease-in-out bg-surface-secondary border-r border-stroke-subtle"
      style={{ width: collapsed ? '40px' : '288px' }}
    >
      {collapsed ? (
        // Collapsed state - expand button at top, UserDock pinned at bottom
        <div className="flex flex-col items-center h-full py-2">
          <button
            onClick={toggle}
            className="btn btn-ghost btn-icon"
            title={t('sidebar.expandPanel')}
            aria-label={t('sidebar.expandLeftPanel')}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {ICON_PATHS.chevronDoubleRight.map((d) => (
                <path key={d} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
              ))}
            </svg>
          </button>
          {cloudSyncEnabled && (
            <div className="mt-auto w-full">
              <UserDock variant="compact" />
            </div>
          )}
        </div>
      ) : (
        // Expanded state
        <div className="flex flex-col h-full animate-fade-in">
          <div
            className={`flex items-center gap-3 px-4 py-2 border-b border-stroke-subtle transition-shadow duration-200 ${
              isScrolled ? 'shadow-elevated' : ''
            }`}
          >
            <h2 className="flex-1 text-xs leading-none font-semibold text-content-tertiary uppercase tracking-wider">
              {t('sidebar.tools')}
            </h2>
            <button
              onClick={() => setShowSettingsModal(true)}
              className="p-2 rounded-md transition-colors text-content-tertiary hover:bg-surface-hover hover:text-content"
              title={t('sidebar.settings')}
              aria-label={t('sidebar.openSettings')}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {ICON_PATHS.settings.map((d) => (
                  <path
                    key={d}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d={d}
                  />
                ))}
              </svg>
            </button>
            <button
              onClick={toggle}
              className="p-2 rounded-md transition-colors text-content-tertiary hover:bg-surface-hover hover:text-content"
              title={t('sidebar.collapsePanel')}
              aria-label={t('sidebar.collapseLeftPanel')}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {ICON_PATHS.chevronDoubleLeft.map((d) => (
                  <path
                    key={d}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d={d}
                  />
                ))}
              </svg>
            </button>
          </div>
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto scrollbar-thin flex flex-col"
          >
            <div data-active-layer-panel className="border-b border-stroke-subtle">
              <ActiveLayerPanel />
            </div>
            <div
              data-layers-panel
              data-help-target="layers-panel"
              className="border-b border-stroke-subtle"
            >
              <LayerPanel />
            </div>
            <div
              data-categories-panel
              data-help-target="categories-panel"
              className="border-b border-stroke-subtle"
            >
              <CategoriesPanel />
            </div>

            {/* Inspiration Gallery - Prominent placement */}
            <div className="px-4 py-4 border-b border-stroke-subtle">
              <button
                onClick={() => {
                  setShowInspirationGallery(true);
                  if (shouldPulseGallery) dismissGalleryPulse();
                }}
                className={`w-full flex items-center gap-3 text-left p-3 rounded-lg bg-gradient-to-r from-accent/10 to-info/10 hover:from-accent/20 hover:to-info/20 border border-accent/20 transition-all group ${shouldPulseGallery ? 'animate-gallery-pulse' : ''}`}
              >
                <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <svg
                    className="w-5 h-5 text-accent"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    {ICON_PATHS.dashboard.map((d) => (
                      <path
                        key={d}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d={d}
                      />
                    ))}
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-content">
                    {t('sidebar.inspirationGallery')}
                  </div>
                  <div className="text-xs text-content-tertiary">
                    {t('sidebar.inspirationHint')}
                  </div>
                </div>
                <svg
                  className="w-4 h-4 text-content-tertiary group-hover:translate-x-0.5 transition-transform"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  {ICON_PATHS.chevronRight.map((d) => (
                    <path
                      key={d}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d={d}
                    />
                  ))}
                </svg>
              </button>
            </div>

            {/* Grid Size */}
            <div data-grid-size-panel className="mt-auto">
              <CollapsibleSection
                title={t('sidebar.gridSize')}
                variant="default"
                expanded={gridSizeExpanded}
                onExpandedChange={setGridSizeExpanded}
              >
                <div className="text-xs text-content-secondary space-y-2">
                  {/* Width / Depth / Height in compact grid */}
                  <div data-help-target="drawer-size" className="grid grid-cols-3 gap-1.5">
                    <div>
                      <label
                        className="block text-content-tertiary mb-1"
                        title={`Width in grid units (step: ${widthStep})`}
                      >
                        {t('common.width')}
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
                        {t('common.depth')}
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
                        title={t('sidebar.maxHeight')}
                      >
                        {t('common.height')}
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
                    <RulerIcon size="xs" />
                    <span className="tabular-nums">
                      {realWorldDimensions.width.toFixed(0)} ×{' '}
                      {realWorldDimensions.depth.toFixed(0)} ×{' '}
                      {realWorldDimensions.height.toFixed(0)} mm
                    </span>
                  </div>

                  {/* Half-bin mode toggle */}
                  <div
                    data-help-target="half-bin-mode"
                    className="flex items-center justify-between pt-2 cursor-pointer"
                    onClick={handleHalfBinToggle}
                    role="checkbox"
                    aria-checked={halfGridMode}
                    aria-label={t('sidebar.toggleHalfBinMode')}
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
                        className={`leading-none ${halfGridMode ? 'text-content' : 'text-content-tertiary'}`}
                        title={t('sidebar.halfBinTooltip')}
                      >
                        {t('sidebar.halfBinMode')}
                      </span>
                      <kbd className="text-[9px] leading-none text-content-disabled bg-surface-elevated px-1 py-0.5 rounded border border-stroke-subtle">
                        H
                      </kbd>
                    </div>
                    <Checkbox checked={halfGridMode} variant="desktop" />
                  </div>

                  {/* Fractional edge position toggles - only shown when dimensions are fractional */}
                  {(hasFractionalWidth || hasFractionalDepth) && (
                    <div className="pt-2 space-y-1.5">
                      <div className="text-content-tertiary text-[10px] mb-1">
                        {t('sidebar.halfUnitEdgePosition')}
                      </div>
                      {hasFractionalWidth && (
                        <FractionalEdgeToggle
                          axis="x"
                          label={t('common.width')}
                          value={fractionalEdges.x}
                          onChange={handleFractionalEdgeChange}
                          startTitle={t('sidebar.halfBinLeft')}
                          startLabel={t('sidebar.left')}
                          endTitle={t('sidebar.halfBinRight')}
                          endLabel={t('sidebar.right')}
                        />
                      )}
                      {hasFractionalDepth && (
                        <FractionalEdgeToggle
                          axis="y"
                          label={t('common.depth')}
                          value={fractionalEdges.y}
                          onChange={handleFractionalEdgeChange}
                          startTitle={t('sidebar.halfBinBottom')}
                          startLabel={t('sidebar.bottom')}
                          endTitle={t('sidebar.halfBinTop')}
                          endLabel={t('sidebar.top')}
                        />
                      )}
                    </div>
                  )}
                </div>
              </CollapsibleSection>
            </div>

            {/* Physical Units */}
            <div data-units-panel className="border-t border-stroke-subtle">
              <CollapsibleSection
                title={t('sidebar.physicalUnits')}
                variant="default"
                expanded={physicalUnitsExpanded}
                onExpandedChange={setPhysicalUnitsExpanded}
              >
                <div className="text-xs text-content-secondary space-y-2">
                  <div data-help-target="grid-unit">
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
                  </div>
                  <div data-help-target="height-unit">
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
                  </div>
                  <div data-help-target="print-bed-size">
                    <SettingsRow
                      label="Print bed"
                      htmlFor="printBedSize"
                      tooltip={`Bins wider than ${maxGridUnits.width} or deeper than ${maxGridUnits.depth} will be split for printing`}
                      unit="mm"
                    >
                      <PrintBedInput
                        id="printBedSize"
                        width={printBedSize}
                        depth={printBedDepth}
                        onChange={setPrintBedSize}
                        variant="compact"
                      />
                    </SettingsRow>
                  </div>
                </div>
              </CollapsibleSection>
            </div>

            {/* Attribution */}
            <div className="px-4 py-4 border-t border-stroke-subtle text-content-disabled text-[10px] leading-relaxed">
              <div className="text-content-secondary text-[11px] font-semibold mb-1">
                {t('sidebar.appName')}
              </div>
              {t('sidebar.gridfinityBy')}{' '}
              <a
                href="https://www.youtube.com/c/ZackFreedman"
                target="_blank"
                rel="noopener noreferrer"
                className="text-content-tertiary hover:underline"
              >
                Zack Freedman
              </a>
              <br />
              {t('sidebar.toolBy')}{' '}
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
                  {ICON_PATHS.heart.map((d) => (
                    <path key={d} d={d} />
                  ))}
                </svg>
                {t('sidebar.tip')}
              </a>{' '}
              ·{' '}
              <a
                href="https://github.com/andymai/gridfinity-layout-tool"
                target="_blank"
                rel="noopener noreferrer"
                className="text-content-tertiary hover:underline"
              >
                {t('sidebar.github')}
              </a>{' '}
              ·{' '}
              <a
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-content-tertiary hover:underline"
              >
                {t('sidebar.privacy')}
              </a>{' '}
              ·{' '}
              <a
                href="/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-content-tertiary hover:underline"
              >
                {t('sidebar.terms')}
              </a>
            </div>
          </div>
          {cloudSyncEnabled && (
            <UserDock
              onOpenSettings={() => {
                setSettingsInitialTab('account');
                setShowSettingsModal(true);
              }}
            />
          )}
        </div>
      )}

      {halfBinViolation && (
        <HalfGridModeBlockedModal
          isOpen={showHalfBinBlockedModal}
          violation={halfBinViolation}
          onClose={() => setShowHalfBinBlockedModal(false)}
          onRemediate={handleRemediate}
        />
      )}

      {showInspirationGallery && (
        <Suspense fallback={<LoadingFallback variant="overlay" label={t('loading.gallery')} />}>
          <InspirationGallery
            isOpen={showInspirationGallery}
            onClose={() => setShowInspirationGallery(false)}
          />
        </Suspense>
      )}

      {showSettingsModal && (
        <Suspense fallback={<LoadingFallback variant="overlay" label={t('loading.settings')} />}>
          <SettingsModal
            isOpen={showSettingsModal}
            onClose={() => {
              setShowSettingsModal(false);
              setSettingsInitialTab(undefined);
            }}
            initialTab={settingsInitialTab}
          />
        </Suspense>
      )}
    </aside>
  );
}

function FractionalEdgeToggle({
  axis,
  label,
  value,
  onChange,
  startTitle,
  startLabel,
  endTitle,
  endLabel,
}: {
  axis: 'x' | 'y';
  label: string;
  value: 'start' | 'end';
  onChange: (axis: 'x' | 'y', position: 'start' | 'end') => void;
  startTitle: string;
  startLabel: string;
  endTitle: string;
  endLabel: string;
}) {
  const activeClass = 'bg-accent text-on-dark';
  const inactiveClass = 'bg-surface-elevated text-content-tertiary hover:bg-surface-hover';

  return (
    <div className="flex items-center justify-between">
      <span className="text-content-tertiary">{label}</span>
      <div className="flex rounded overflow-hidden border border-stroke-subtle">
        <button
          onClick={() => onChange(axis, 'start')}
          className={`px-2.5 py-1 text-[10px] transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ${
            value === 'start' ? activeClass : inactiveClass
          }`}
          title={startTitle}
        >
          {startLabel}
        </button>
        <button
          onClick={() => onChange(axis, 'end')}
          className={`px-2.5 py-1 text-[10px] border-l border-stroke-subtle transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ${
            value === 'end' ? activeClass : inactiveClass
          }`}
          title={endTitle}
        >
          {endLabel}
        </button>
      </div>
    </div>
  );
}

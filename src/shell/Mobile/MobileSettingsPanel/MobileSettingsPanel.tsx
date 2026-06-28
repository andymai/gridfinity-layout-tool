import { useCallback, useState, Suspense } from 'react';
// Import stores directly to avoid circular dependency via barrel export
import { useDrawerSettings } from '@/shared/hooks/useDrawerSettings';
import { useSettingsStore } from '@/core/store/settings';
import { CONSTRAINTS } from '@/core/constants';
import { PRINT_SETTINGS_CONSTRAINTS } from '@/shared/printSettings';
import { RulerIcon } from '@/design-system/Icon';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { HalfGridModeBlockedModal } from '@/shell/Modals';
import { DeferredNumberInput } from '@/shared/components/DeferredNumberInput';
import { PrintBedInput } from '@/shared/components/PrintBedInput';
import { SectionHeader } from '@/shared/components/SectionHeader';
import { SettingsRow } from '@/shared/components/SettingsRow';
import { LoadingFallback } from '@/shared/components/LoadingFallback';
import { lazyWithRetry, namedExport } from '@/shared/utils/lazyWithRetry';
import { useTranslation } from '@/i18n';
import { Button, Checkbox, Stepper } from '@/design-system';
import { UserDock } from '@/shared/components/UserDock';
import { useFeatureFlag } from '@/shared/hooks/useFeatureFlag';
import type { SettingsTabId } from '@/shell/Modals/SettingsModal/types';

// Lazy load SettingsModal — only loaded when user taps the button
const SettingsModal = lazyWithRetry(() =>
  import('@/shell/Modals/SettingsModal').then(namedExport('SettingsModal'))
);

/**
 * Mobile settings panel with per-layout drawer/grid controls.
 * App-wide settings (privacy, STL search, labs, defaults) are in the unified SettingsModal.
 */
export function MobileSettingsPanel() {
  const t = useTranslation();
  const cloudSyncEnabled = useFeatureFlag('cloud_sync');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<SettingsTabId | undefined>(
    undefined
  );
  const {
    drawer,
    widthStep,
    depthStep,
    realWorldDimensions,
    maxGridUnits,
    gridUnitMm,
    heightUnitMm,
    printBedSize,
    printBedDepth,
    halfGridMode,
    activeLayerHeight,
    handleDrawerWidthChange,
    handleDrawerDepthChange,
    handleDrawerHeightChange,
    handleDrawerHeightInput,
    handleDrawerWidthInput,
    handleDrawerDepthInput,
    handleHalfBinToggle,
    handleRemediate,
    handleSaveDefaults,
    setGridUnitMm,
    setHeightUnitMm,
    setPrintBedSize,
    resetGridfinityStandard,
    showSaveDefaultsConfirm,
    setShowSaveDefaultsConfirm,
    showHalfBinBlockedModal,
    setShowHalfBinBlockedModal,
    halfBinViolation,
  } = useDrawerSettings();

  const nozzleSizeMm = useSettingsStore((s) => s.settings.printSettings.nozzleSizeMm);
  const setNozzleSizeMm = useCallback((value: number) => {
    const current = useSettingsStore.getState().settings.printSettings;
    useSettingsStore.getState().updateSetting('printSettings', { ...current, nozzleSizeMm: value });
  }, []);

  const openSettingsModal = (tab?: SettingsTabId) => {
    setSettingsInitialTab(tab);
    setShowSettingsModal(true);
  };

  return (
    <div className="pb-4 space-y-6">
      {/* Drawer Dimensions */}
      <section>
        <SectionHeader title={t('settings.drawerDimensions')} />

        <div className="grid grid-cols-2 gap-3 mb-3">
          {/* Width */}
          <div>
            <label className="block text-sm mb-1 text-content-tertiary">{t('common.width')}</label>
            <Stepper
              value={drawer.width}
              onChange={handleDrawerWidthInput}
              onStep={handleDrawerWidthChange}
              min={0.5}
              max={CONSTRAINTS.GRID_MAX}
              step={widthStep}
              size="lg"
              aria-label={t('sidebar.drawerWidthAria')}
            />
          </div>

          {/* Depth */}
          <div>
            <label className="block text-sm mb-1 text-content-tertiary">{t('common.depth')}</label>
            <Stepper
              value={drawer.depth}
              onChange={handleDrawerDepthInput}
              onStep={handleDrawerDepthChange}
              min={0.5}
              max={CONSTRAINTS.GRID_MAX}
              step={depthStep}
              size="lg"
              aria-label={t('sidebar.drawerDepthAria')}
            />
          </div>
        </div>

        {/* Height */}
        <div>
          <label className="block text-sm mb-1 text-content-tertiary">{t('common.heightMm')}</label>
          <Stepper
            value={drawer.height * heightUnitMm}
            onChange={handleDrawerHeightInput}
            onStep={handleDrawerHeightChange}
            min={heightUnitMm}
            max={CONSTRAINTS.GRID_MAX * heightUnitMm}
            step={heightUnitMm}
            inputDecimals={2}
            size="lg"
            fullWidth
            aria-label={t('sidebar.drawerHeightAria')}
          />
        </div>

        {/* Real-world drawer dimensions */}
        <div className="mt-3 flex items-center gap-1.5 text-sm text-content-tertiary">
          <RulerIcon size="sm" />
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
          <div>
            <span className={`text-sm ${halfGridMode ? 'text-content' : 'text-content-secondary'}`}>
              {t('mobile.settings.halfBinMode')}
            </span>
            <p className="text-xs text-content-tertiary">
              {t('mobile.settings.allow05UnitPrecision')}
            </p>
          </div>
          <Checkbox checked={halfGridMode} size="lg" />
        </div>
      </section>

      {/* Grid Settings */}
      <section>
        <SectionHeader title={t('settings.gridSettings')} />

        <div className="space-y-3">
          <div>
            <SettingsRow label="1 grid unit" unit="mm" variant="mobile">
              <DeferredNumberInput
                value={gridUnitMm}
                onChange={setGridUnitMm}
                className="input w-20 h-10 text-center"
                min={CONSTRAINTS.GRID_UNIT_MM_MIN}
                max={CONSTRAINTS.GRID_UNIT_MM_MAX}
              />
            </SettingsRow>
            <p className="text-xs text-content-tertiary mt-1">
              {t('settings.gridfinityStandardMm', {
                value: CONSTRAINTS.GRID_UNIT_MM_DEFAULT,
              })}
            </p>
          </div>

          <div>
            <SettingsRow label="1u height" unit="mm" variant="mobile">
              <DeferredNumberInput
                value={heightUnitMm}
                onChange={setHeightUnitMm}
                className="input w-20 h-10 text-center"
                min={CONSTRAINTS.HEIGHT_UNIT_MM_MIN}
                max={CONSTRAINTS.HEIGHT_UNIT_MM_MAX}
                step={0.01}
                decimals={2}
              />
            </SettingsRow>
            <p className="text-xs text-content-tertiary mt-1">
              {t('settings.gridfinityStandardMm', {
                value: CONSTRAINTS.HEIGHT_UNIT_MM_DEFAULT,
              })}
            </p>
          </div>

          <SettingsRow label={t('settings.printBedSizeLabel')} unit="mm" variant="mobile">
            <PrintBedInput
              width={printBedSize}
              depth={printBedDepth}
              onChange={setPrintBedSize}
              variant="mobile"
            />
          </SettingsRow>

          <div>
            <SettingsRow label={t('settings.nozzleSize')} unit="mm" variant="mobile">
              <DeferredNumberInput
                value={nozzleSizeMm}
                onChange={setNozzleSizeMm}
                className="input w-20 h-10 text-center"
                min={PRINT_SETTINGS_CONSTRAINTS.NOZZLE_SIZE_MIN}
                max={PRINT_SETTINGS_CONSTRAINTS.NOZZLE_SIZE_MAX}
                step={PRINT_SETTINGS_CONSTRAINTS.NOZZLE_SIZE_STEP}
              />
            </SettingsRow>
            <p className="text-xs text-content-tertiary mt-1">
              {t('settings.nozzleSizeMobileHint')}
            </p>
          </div>

          <Button
            type="button"
            variant="secondary"
            fullWidth
            onClick={resetGridfinityStandard}
            disabled={
              gridUnitMm === CONSTRAINTS.GRID_UNIT_MM_DEFAULT &&
              heightUnitMm === CONSTRAINTS.HEIGHT_UNIT_MM_DEFAULT
            }
            className="text-sm py-2 px-3 rounded-lg text-content-secondary hover:text-content hover:bg-surface-hover border border-stroke-subtle disabled:cursor-not-allowed disabled:hover:text-content-secondary disabled:hover:bg-transparent"
          >
            {t('settings.resetGridfinityStandard')}
          </Button>

          <div className="text-sm text-right text-content-disabled">
            {t('mobile.settings.maxBinSize')}
            {maxGridUnits.width}×{maxGridUnits.depth}
          </div>
        </div>
      </section>

      {/* App Settings Link */}
      <section>
        <Button
          variant="ghost"
          fullWidth
          onClick={() => openSettingsModal()}
          className="flex items-center justify-between px-4 py-3 bg-surface-elevated rounded-lg hover:bg-surface-hover"
        >
          <div className="flex items-center gap-3">
            <svg
              className="w-5 h-5 text-content-tertiary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.991l1.004.827c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <div className="text-left">
              <div className="text-sm font-medium text-content">{t('settings.title')}</div>
              <div className="text-xs text-content-tertiary">
                {t('mobile.settings.openAppSettings')}
              </div>
            </div>
          </div>
          <svg
            className="w-5 h-5 text-content-tertiary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Button>
      </section>

      {/* Info */}
      <section className="pt-4 text-center border-t border-stroke-subtle">
        <div className="flex items-baseline justify-center gap-1.5 mb-2">
          <span className="text-xs font-semibold text-content-secondary">
            {t('sidebar.appName')}
          </span>
          <a
            href={`https://github.com/andymai/gridfinity-layout-tool/releases/tag/v${__APP_VERSION__}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-content-disabled hover:text-content-tertiary hover:underline"
          >
            {t('sidebar.version', { version: __APP_VERSION__ })}
          </a>
        </div>
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
        <div className="text-xs text-content-disabled mt-3 space-x-3">
          <a
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-content-tertiary"
          >
            {t('settings.privacyPolicy')}
          </a>
          <span>·</span>
          <a
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-content-tertiary"
          >
            {t('settings.termsOfService')}
          </a>
          <span>·</span>
          <a
            href="https://github.com/andymai/gridfinity-layout-tool"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-content-tertiary"
          >
            {t('sidebar.github')}
          </a>
        </div>
      </section>

      {cloudSyncEnabled && (
        <UserDock
          onOpenSettings={() => {
            setSettingsInitialTab('account');
            setShowSettingsModal(true);
          }}
        />
      )}

      {/* Settings Modal — rendered locally so it works on mobile (Sidebar not mounted) */}
      {showSettingsModal && (
        <Suspense fallback={<LoadingFallback variant="overlay" label={t('settings.title')} />}>
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
        confirmText={t('common.save')}
        onConfirm={handleSaveDefaults}
        onCancel={() => setShowSaveDefaultsConfirm(false)}
      />

      {halfBinViolation && (
        <HalfGridModeBlockedModal
          isOpen={showHalfBinBlockedModal}
          violation={halfBinViolation}
          onClose={() => setShowHalfBinBlockedModal(false)}
          onRemediate={handleRemediate}
        />
      )}
    </div>
  );
}

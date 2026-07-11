/**
 * Standalone baseplate generator page.
 *
 * Responsive layout matching the bin designer:
 * - Desktop: side-by-side, panel left (w-72), preview right
 * - Landscape: side-by-side, preview left, panel right (w-64)
 * - Tablet portrait: stacked, preview 50vh, panel below
 * - Mobile portrait: stacked, preview 40vh, panel below
 *
 * Reads layoutId from the URL query param to load the correct layout.
 */

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store/layout';
import { useViewStore } from '@/core/store/view';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/constants';
import { gridUnits } from '@/core/types';
import { useTranslation } from '@/i18n';
import { useResponsive } from '@/shared/hooks/useResponsive';

import { Button } from '@/design-system';
import { ToolSwitcher } from '@/shared/components/ToolSwitcher';
import { HeaderSupportLinks } from '@/shared/components/HeaderSupportLinks';
import { LoadingFallback } from '@/shared/components/LoadingFallback';
import { lazyWithRetry, namedExport } from '@/shared/utils/lazyWithRetry';
import { useBaseplateRouting } from '@/shared/hooks/useBaseplateRouting';
import { useBaseplateGeneration } from '../../hooks/useBaseplateGeneration';
import { useBaseplateLibraryInit } from '../../hooks/useBaseplateLibraryInit';
import { useBaseplateAutoSave } from '../../hooks/useBaseplateAutoSave';
import { useBaseplateExport } from '../../hooks/useBaseplateExport';
import { BaseplateSelector } from '../BaseplateSelector';
import { useBaseplatePageStore } from '../../store/baseplatePageStore';
import { generateBaseplateFileName, toNamingParams } from '../../utils/fileNaming';
import { buildFullParams } from '../../utils/buildFullParams';
import { stackGroupsFromTiling, planPhysicalStacks, stackHeightCap } from '../../utils/stackPrint';
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';
import { STACK_PRINT_DEFAULT_GAP_MM, STACK_PRINT_DEFAULT_COPIES } from '@/core/types';
import { BaseplatePanel } from '../BaseplatePanel/BaseplatePanel';
import { BaseplatePreview } from '../BaseplatePreview/BaseplatePreview';
import {
  ExportDialog,
  ExportSupportPrompt,
  recordExportAndShouldPromptSupport,
} from '@/shared/components/ExportDialog';
import { useToastStore } from '@/core/store/toast';
import { useSettingsStore } from '@/core/store/settings';
import { ExperimentalKernelBadge } from '@/shared/components/ExperimentalKernelBadge';
import type { ExportFileFormat } from '@/shared/types/bin';

const BaseplateLibraryModal = lazyWithRetry(() =>
  import('../BaseplateLibraryModal').then(namedExport('BaseplateLibraryModal'))
);

/** File extension display for each format */
const FORMAT_EXTENSIONS: Record<ExportFileFormat, string> = {
  stl: '.stl',
  step: '.step',
  '3mf': '.3mf',
};

export function BaseplatePage() {
  const t = useTranslation();
  const { isDesktop, isLandscape, isMobile, isTablet } = useResponsive();

  const {
    drawerWidth,
    drawerDepth,
    gridUnitMm,
    fractionalEdgeX,
    fractionalEdgeY,
    baseplateParams,
    defaultPrintBedSize,
  } = useLayoutStore(
    useShallow((state) => ({
      drawerWidth: state.layout.drawer.width,
      drawerDepth: state.layout.drawer.depth,
      gridUnitMm: state.layout.gridUnitMm,
      fractionalEdgeX: state.layout.drawer.fractionalEdgeX ?? 'end',
      fractionalEdgeY: state.layout.drawer.fractionalEdgeY ?? 'end',
      baseplateParams: state.layout.baseplateParams ?? DEFAULT_BASEPLATE_PARAMS,
      defaultPrintBedSize: state.layout.printBedSize,
    }))
  );

  // Initialize generation bridge
  useBaseplateGeneration();

  // Backfill the library pointer / re-materialize the active design on load.
  useBaseplateLibraryInit();

  // Persist edits to the active library design (debounced).
  useBaseplateAutoSave();

  const showBaseplateLibrary = useViewStore((s) => s.showBaseplateLibrary);
  const setShowBaseplateLibrary = useViewStore((s) => s.setShowBaseplateLibrary);

  const { isExporting, canExport, exportProgress, downloadBaseplate } = useBaseplateExport();
  const { isStandalone } = useBaseplateRouting();
  const setBaseplateParams = useLayoutStore((s) => s.setBaseplateParams);
  const hasBaseplateParams = useLayoutStore((s) => s.layout.baseplateParams !== undefined);

  // Standalone mode: set sensible defaults (sync OFF, 4x4 grid) on first mount
  const standaloneInitRef = useRef(false);
  useEffect(() => {
    if (!isStandalone || standaloneInitRef.current) return;
    standaloneInitRef.current = true;
    if (hasBaseplateParams) return;
    setBaseplateParams({
      ...DEFAULT_BASEPLATE_PARAMS,
      syncWithLayout: false,
      baseplateWidth: gridUnits(4),
      baseplateDepth: gridUnits(4),
    });
  }, [isStandalone, hasBaseplateParams, setBaseplateParams]);

  const exportDialogOpen = useBaseplatePageStore((s) => s.exportDialogOpen);
  const setExportDialogOpen = useBaseplatePageStore((s) => s.setExportDialogOpen);
  const exportFileNameConfig = useBaseplatePageStore((s) => s.exportFileNameConfig);
  const setExportFileNameConfig = useBaseplatePageStore((s) => s.setExportFileNameConfig);
  const tiling = useBaseplatePageStore((s) => s.tiling);

  const [splitEnabled, setSplitEnabled] = useState(true);
  const [justExported, setJustExported] = useState(false);

  const activeFormat: ExportFileFormat = exportFileNameConfig.format ?? 'stl';

  const nozzleSizeMm = useSettingsStore((s) => s.settings.printSettings.nozzleSizeMm);
  const maxPrintHeightMm = useSettingsStore((s) => s.settings.printSettings.maxPrintHeightMm);

  const fullParams = useMemo(
    () =>
      buildFullParams(
        baseplateParams,
        drawerWidth,
        drawerDepth,
        gridUnitMm,
        fractionalEdgeX,
        fractionalEdgeY,
        nozzleSizeMm
      ),
    [
      baseplateParams,
      drawerWidth,
      drawerDepth,
      gridUnitMm,
      fractionalEdgeX,
      fractionalEdgeY,
      nozzleSizeMm,
    ]
  );

  const fileName = useMemo(
    () => generateBaseplateFileName(toNamingParams(fullParams), activeFormat, exportFileNameConfig),
    [fullParams, activeFormat, exportFileNameConfig]
  );

  // Stacking exports one file per physical tower (dedup collapses identical
  // tiles first), so the "exceeds bed → N pieces" framing no longer applies —
  // describe the stacks instead. STEP never stacks.
  const stackEnabled = baseplateParams.stackPrint?.enabled === true && activeFormat !== 'step';
  const stackGapMm = baseplateParams.stackPrint?.gapMm ?? STACK_PRINT_DEFAULT_GAP_MM;
  const stackCopies = baseplateParams.stackPrint?.copies ?? STACK_PRINT_DEFAULT_COPIES;
  const stackPlan = useMemo(() => {
    if (!stackEnabled || !tiling) return [];
    const groups = stackGroupsFromTiling(tiling, fullParams, stackCopies);
    const cap = stackHeightCap(maxPrintHeightMm, GRIDFINITY_SPEC.SOCKET_HEIGHT, stackGapMm);
    return planPhysicalStacks(groups, cap);
  }, [stackEnabled, tiling, fullParams, maxPrintHeightMm, stackGapMm, stackCopies]);
  const stackFileCount = stackPlan.length;
  const stackPlateCount = stackPlan.reduce((sum, s) => sum + s.copies, 0);

  // Split-into-pieces banner only when NOT stacking (stacking has its own).
  const showSplitBanner = !stackEnabled && tiling?.isSplit === true && activeFormat !== 'step';
  // When stacking, a split drawer always takes the per-tower export path; the
  // user can't opt out, so there's no split checkbox to gate it.
  const useSplitExport = stackEnabled ? tiling?.isSplit === true : showSplitBanner && splitEnabled;
  const isZipExport = stackEnabled ? stackFileCount > 1 : useSplitExport;
  const displayExtension = isZipExport ? '.zip' : FORMAT_EXTENSIONS[activeFormat];

  const handleDownload = useCallback(() => {
    void downloadBaseplate(activeFormat, useSplitExport).then((succeeded) => {
      if (!succeeded) return;
      // Show the support view only to returning makers (2nd+ export), at most
      // once per cooldown; otherwise take the low-friction path.
      if (recordExportAndShouldPromptSupport()) {
        setJustExported(true);
        return;
      }
      // Split/dedup exports are already confirmed by toasts from the hook;
      // single-file gets a brief confirmation here. Then close.
      if (!useSplitExport) {
        useToastStore.getState().addToast(t('export.complete'), 'success', 3000);
      }
      setExportDialogOpen(false);
    });
  }, [downloadBaseplate, activeFormat, useSplitExport, setExportDialogOpen, t]);

  const closeExportDialog = useCallback(() => {
    setJustExported(false);
    setExportDialogOpen(false);
  }, [setExportDialogOpen]);

  // Re-opening the dialog always returns to the form, never a stale success view.
  const prevExportOpenRef = useRef(exportDialogOpen);
  useEffect(() => {
    if (exportDialogOpen && !prevExportOpenRef.current) setJustExported(false);
    prevExportOpenRef.current = exportDialogOpen;
  }, [exportDialogOpen]);

  const { paddingLeft, paddingRight, paddingFront, paddingBack } = baseplateParams;
  const synced = baseplateParams.syncWithLayout !== false;
  const effectiveWidth = synced ? drawerWidth : (baseplateParams.baseplateWidth ?? drawerWidth);
  const effectiveDepth = synced ? drawerDepth : (baseplateParams.baseplateDepth ?? drawerDepth);

  const preview = (
    <BaseplatePreview
      width={effectiveWidth}
      depth={effectiveDepth}
      gridUnitMm={gridUnitMm}
      paddingLeft={paddingLeft}
      paddingRight={paddingRight}
      paddingFront={paddingFront}
      paddingBack={paddingBack}
    />
  );

  const panel = <BaseplatePanel />;

  return (
    <div className="flex h-screen flex-col bg-surface">
      {/* Header */}
      <header className="h-12 flex items-center justify-between px-4 bg-surface-secondary border-b border-stroke-subtle">
        <div className="flex items-center gap-3 min-w-0">
          <ToolSwitcher compact={isMobile} iconOnly={isMobile || isTablet} />

          <Button
            type="button"
            variant="ghost"
            onClick={() => setExportDialogOpen(true)}
            disabled={!canExport || isExporting}
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-normal text-content-secondary transition-all bg-transparent hover:bg-surface-hover hover:text-content disabled:opacity-50 disabled:pointer-events-none"
            title={t('common.export')}
            aria-label={t('common.export')}
          >
            {isExporting ? (
              <svg
                className="h-4 w-4 animate-spin motion-reduce:animate-none"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
            )}
            <span className="hidden lg:inline">{t('common.export')}</span>
          </Button>

          {!isMobile && <BaseplateSelector />}
        </div>

        {isDesktop && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <HeaderSupportLinks />
          </div>
        )}
      </header>

      {/* Main content — 4 responsive states */}
      {isDesktop ? (
        /* Desktop: side-by-side, panel left */
        <div className="flex flex-1 overflow-hidden">
          <aside className="w-72 shrink-0 overflow-hidden border-r border-stroke-subtle bg-surface-secondary">
            {panel}
          </aside>
          <main className="relative flex-1 overflow-hidden">
            {preview}
            <ExperimentalKernelBadge />
          </main>
        </div>
      ) : isLandscape ? (
        /* Landscape tablet/mobile: side-by-side, panel right */
        <div className="flex flex-1 overflow-hidden">
          <main className="relative flex-1 overflow-hidden">
            {preview}
            <ExperimentalKernelBadge />
          </main>
          <aside className="w-64 shrink-0 overflow-hidden border-l border-stroke-subtle bg-surface-secondary">
            {panel}
          </aside>
        </div>
      ) : (
        /* Portrait tablet/mobile: stacked */
        <div className="flex flex-1 flex-col overflow-hidden">
          <main
            className="relative shrink-0 border-b border-stroke-subtle"
            style={{ height: isMobile ? '40vh' : '50vh' }}
          >
            {preview}
            <ExperimentalKernelBadge />
          </main>
          <aside className="flex-1 overflow-hidden bg-surface-secondary">{panel}</aside>
        </div>
      )}

      {/* Export Dialog */}
      <ExportDialog
        open={exportDialogOpen}
        onClose={closeExportDialog}
        activeFormat={activeFormat}
        fileNameConfig={exportFileNameConfig}
        onFileNameConfigChange={setExportFileNameConfig}
        fileName={fileName}
        displayExtension={displayExtension}
        canExport={canExport}
        isExporting={isExporting}
        onDownload={handleDownload}
        exportProgress={exportProgress}
        splitBanner={
          showSplitBanner
            ? {
                message: `${t('baseplate.export.splitBanner', {
                  size: defaultPrintBedSize,
                  count: tiling.pieces.length,
                })} ${t(
                  tiling.bedLoads === 1 ? 'baseplate.bedLoads.one' : 'baseplate.bedLoads.other',
                  { count: tiling.bedLoads }
                )}`,
                checkboxLabel: t('baseplate.export.enableSplit'),
                checked: splitEnabled,
                onCheckedChange: setSplitEnabled,
              }
            : null
        }
        warningBanner={
          stackEnabled && stackFileCount > 1
            ? {
                message: t('baseplate.stackPrint.exportBanner', {
                  stacks: stackFileCount,
                  plates: stackPlateCount,
                }),
              }
            : null
        }
        noMeshWarning={t('export.noMeshWarning')}
        sectionTitle={t('baseplate.export.threeDModel')}
        sectionDescription={t('baseplate.export.threeDModelDescription')}
        exported={justExported}
        successContent={
          <ExportSupportPrompt
            fileName={`${fileName.replace(/\.[^/.]+$/, '')}${displayExtension}`}
            onDone={closeExportDialog}
            source="baseplate_export"
          />
        }
      />

      {showBaseplateLibrary && (
        <Suspense fallback={<LoadingFallback variant="overlay" />}>
          <BaseplateLibraryModal
            isOpen={showBaseplateLibrary}
            onClose={() => setShowBaseplateLibrary(false)}
          />
        </Suspense>
      )}
    </div>
  );
}

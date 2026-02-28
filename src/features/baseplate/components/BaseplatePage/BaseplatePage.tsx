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
 * Gated behind the 'baseplate_generator' feature flag.
 */

import { useCallback, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store/layout';
import { useSettingsStore } from '@/core/store/settings';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/constants';
import { useTranslation } from '@/i18n';
import { useResponsive } from '@/shared/hooks/useResponsive';
import { ArrowLeftIcon } from '@/design-system/Icon';
import { useBaseplateRouting } from '@/hooks/useBaseplateRouting';
import { useBaseplateGeneration } from '../../hooks/useBaseplateGeneration';
import { useBaseplateExport } from '../../hooks/useBaseplateExport';
import { useBaseplateSlicerOpen } from '../../hooks/useBaseplateSlicerOpen';
import { useBaseplatePageStore } from '../../store/baseplatePageStore';
import { generateBaseplateFileName, toNamingParams } from '../../utils/fileNaming';
import { buildFullParams } from '../../utils/buildFullParams';
import { BaseplatePanel } from '../BaseplatePanel/BaseplatePanel';
import { BaseplatePreview } from '../BaseplatePreview/BaseplatePreview';
import { ExportDialog } from '@/shared/components/ExportDialog';
import type { ExportFileFormat } from '@/shared/types/bin';

/** File extension display for each format */
const FORMAT_EXTENSIONS: Record<ExportFileFormat, string> = {
  stl: '.stl',
  step: '.step',
  '3mf': '.3mf',
};

export function BaseplatePage() {
  const t = useTranslation();
  const { isDesktop, isLandscape, isMobile } = useResponsive();

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

  const slicerSites = useSettingsStore((s) => s.settings.slicerSites);
  const enabledSlicers = useMemo(() => slicerSites.filter((s) => s.enabled), [slicerSites]);

  // Initialize generation bridge
  useBaseplateGeneration();

  const { isExporting, canExport, exportProgress, downloadBaseplate } = useBaseplateExport();
  const { isOpening, openingSlicerId, openInSlicer } = useBaseplateSlicerOpen();
  const { navigateBack } = useBaseplateRouting();

  const exportDialogOpen = useBaseplatePageStore((s) => s.exportDialogOpen);
  const setExportDialogOpen = useBaseplatePageStore((s) => s.setExportDialogOpen);
  const exportFileNameConfig = useBaseplatePageStore((s) => s.exportFileNameConfig);
  const setExportFileNameConfig = useBaseplatePageStore((s) => s.setExportFileNameConfig);
  const tiling = useBaseplatePageStore((s) => s.tiling);

  const [splitEnabled, setSplitEnabled] = useState(true);

  const activeFormat: ExportFileFormat = exportFileNameConfig.format ?? 'stl';

  const fullParams = useMemo(
    () =>
      buildFullParams(
        baseplateParams,
        drawerWidth,
        drawerDepth,
        gridUnitMm,
        fractionalEdgeX,
        fractionalEdgeY
      ),
    [baseplateParams, drawerWidth, drawerDepth, gridUnitMm, fractionalEdgeX, fractionalEdgeY]
  );

  const fileName = useMemo(
    () => generateBaseplateFileName(toNamingParams(fullParams), activeFormat, exportFileNameConfig),
    [fullParams, activeFormat, exportFileNameConfig]
  );

  const showSplitBanner = tiling?.isSplit === true && activeFormat === 'stl';
  const useSplitExport = showSplitBanner && splitEnabled;
  const displayExtension = useSplitExport ? '.zip' : FORMAT_EXTENSIONS[activeFormat];

  const handleDownload = useCallback(() => {
    void downloadBaseplate(activeFormat, useSplitExport);
  }, [downloadBaseplate, activeFormat, useSplitExport]);

  const closeExportDialog = useCallback(() => setExportDialogOpen(false), [setExportDialogOpen]);

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
      <header className="flex h-12 items-center border-b border-stroke-subtle bg-surface-secondary px-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={navigateBack}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-content-secondary transition-colors hover:bg-surface-hover hover:text-content"
            aria-label={t('baseplate.backToLayout')}
          >
            <ArrowLeftIcon size="sm" />
            <span className="hidden sm:inline">{t('baseplate.backToLayout')}</span>
          </button>

          <div className="h-5 w-px bg-stroke-subtle" />

          <h1 className="text-sm font-semibold text-content">{t('baseplate.pageTitle')}</h1>

          <span className="inline-flex items-center gap-1 rounded-sm bg-warning-muted px-1.5 py-0.5 text-xs font-medium text-warning">
            <svg
              className="w-3 h-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
              />
            </svg>
            {t('settings.experimental')}
          </span>

          <button
            onClick={() => setExportDialogOpen(true)}
            disabled={!canExport || isExporting}
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-content-secondary transition-all bg-transparent hover:bg-surface-hover hover:text-content disabled:opacity-50 disabled:pointer-events-none"
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
          </button>
        </div>
      </header>

      {/* Main content — 4 responsive states */}
      {isDesktop ? (
        /* Desktop: side-by-side, panel left */
        <div className="flex flex-1 overflow-hidden">
          <aside className="w-72 shrink-0 overflow-hidden border-r border-stroke-subtle bg-surface-secondary">
            {panel}
          </aside>
          <main className="relative flex-1 overflow-hidden">{preview}</main>
        </div>
      ) : isLandscape ? (
        /* Landscape tablet/mobile: side-by-side, panel right */
        <div className="flex flex-1 overflow-hidden">
          <main className="relative flex-1 overflow-hidden">{preview}</main>
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
          tiling?.isSplit && activeFormat === 'stl'
            ? {
                message: t('baseplate.export.splitBanner', {
                  size: defaultPrintBedSize,
                  count: tiling.pieces.length,
                }),
                checkboxLabel: t('baseplate.export.enableSplit'),
                checked: splitEnabled,
                onCheckedChange: setSplitEnabled,
              }
            : null
        }
        slicerSection={
          enabledSlicers.length > 0
            ? {
                slicers: enabledSlicers,
                isOpening,
                openingSlicerId,
                onOpenInSlicer: (slicer) => void openInSlicer(slicer),
              }
            : null
        }
        noMeshWarning={t('export.noMeshWarning')}
        sectionTitle={t('baseplate.export.threeDModel')}
        sectionDescription={t('baseplate.export.threeDModelDescription')}
      />
    </div>
  );
}

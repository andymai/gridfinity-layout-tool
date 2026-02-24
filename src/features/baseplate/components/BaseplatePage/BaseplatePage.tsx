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

import { useState, useCallback, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store/layout';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/constants';
import { useTranslation } from '@/i18n';
import { useResponsive } from '@/shared/hooks/useResponsive';
import { Menu } from '@/design-system/Menu';
import { ArrowLeftIcon } from '@/design-system/Icon';
import { useBaseplateRouting } from '@/hooks/useBaseplateRouting';
import { useBaseplateGeneration } from '../../hooks/useBaseplateGeneration';
import { useBaseplateExport } from '../../hooks/useBaseplateExport';
import { BaseplatePanel } from '../BaseplatePanel/BaseplatePanel';
import { BaseplatePreview } from '../BaseplatePreview/BaseplatePreview';
import type { ExportFileFormat } from '@/shared/types/bin';

const EXPORT_FORMATS: ReadonlyArray<{ format: ExportFileFormat; label: string }> = [
  { format: 'stl', label: 'STL' },
  { format: 'step', label: 'STEP' },
  { format: '3mf', label: '3MF' },
];

/**
 * Ghost-styled export button with format dropdown, matching the bin designer header.
 */
function ExportButton({
  canExport,
  isExporting,
  onExport,
}: {
  canExport: boolean;
  isExporting: boolean;
  onExport: (format: ExportFileFormat) => void;
}) {
  const t = useTranslation();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });

  const handleOpen = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      setMenuPos({ x: rect.left, y: rect.bottom + 4 });
    }
    setMenuOpen(true);
  }, []);

  return (
    <>
      <button
        ref={buttonRef}
        onClick={handleOpen}
        disabled={!canExport || isExporting}
        className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-content-secondary transition-all bg-transparent hover:bg-surface-hover hover:text-content disabled:opacity-50 disabled:pointer-events-none"
        title={t('common.export')}
        aria-label={t('common.export')}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
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
      <Menu.Root open={menuOpen} onClose={() => setMenuOpen(false)} position={menuPos}>
        {EXPORT_FORMATS.map(({ format, label }) => (
          <Menu.Item key={format} onClick={() => onExport(format)}>
            {label}
          </Menu.Item>
        ))}
      </Menu.Root>
    </>
  );
}

export function BaseplatePage() {
  const t = useTranslation();
  const { isDesktop, isLandscape, isMobile } = useResponsive();

  const { drawerWidth, drawerDepth, gridUnitMm, baseplateParams } = useLayoutStore(
    useShallow((state) => ({
      drawerWidth: state.layout.drawer.width,
      drawerDepth: state.layout.drawer.depth,
      gridUnitMm: state.layout.gridUnitMm,
      baseplateParams: state.layout.baseplateParams ?? DEFAULT_BASEPLATE_PARAMS,
    }))
  );

  // Initialize generation bridge
  useBaseplateGeneration();

  const { isExporting, canExport, downloadBaseplate } = useBaseplateExport();
  const { navigateBack } = useBaseplateRouting();

  const handleExport = useCallback(
    (format: ExportFileFormat) => {
      void downloadBaseplate(format);
    },
    [downloadBaseplate]
  );

  const handleBack = useCallback(() => {
    navigateBack();
  }, [navigateBack]);

  const { paddingLeft, paddingRight, paddingFront, paddingBack } = baseplateParams;

  const preview = (
    <BaseplatePreview
      width={drawerWidth}
      depth={drawerDepth}
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
            onClick={handleBack}
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

          <ExportButton canExport={canExport} isExporting={isExporting} onExport={handleExport} />
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
    </div>
  );
}

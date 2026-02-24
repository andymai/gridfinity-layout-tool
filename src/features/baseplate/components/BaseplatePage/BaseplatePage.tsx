/**
 * Standalone baseplate generator page.
 *
 * Two-column layout: parameter panel on the left, 3D preview on the right.
 * Reads layoutId from the URL query param to load the correct layout.
 * Gated behind the 'baseplate_generator' feature flag.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store/layout';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/constants';
import { useTranslation } from '@/i18n';
import { useResponsive } from '@/shared/hooks/useResponsive';
import { useBaseplateGeneration } from '../../hooks/useBaseplateGeneration';
import { useBaseplateExport } from '../../hooks/useBaseplateExport';
import { resolveDrawerMm } from '../../utils/buildFullParams';
import { BaseplatePanel } from '../BaseplatePanel/BaseplatePanel';
import { BaseplatePreview } from '../BaseplatePreview/BaseplatePreview';
import type { ExportFileFormat } from '@/shared/types/bin';

/**
 * Export dropdown button for the baseplate header.
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
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleSelect = useCallback(
    (format: ExportFileFormat) => {
      setOpen(false);
      onExport(format);
    },
    [onExport]
  );

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        disabled={!canExport || isExporting}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isExporting ? (
          <span className="flex items-center gap-2">
            <svg
              className="h-4 w-4 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle
                className="opacity-20"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="3"
              />
              <path
                className="opacity-80"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            {t('baseplate.exportButton')}
          </span>
        ) : (
          t('baseplate.exportButton')
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-10 mt-1 w-32 rounded-lg border border-stroke-subtle bg-surface-elevated shadow-lg">
          {/* eslint-disable i18next/no-literal-string -- file format labels, not translatable */}
          <button
            onClick={() => handleSelect('stl')}
            className="w-full px-4 py-2 text-left text-sm text-content hover:bg-surface-hover first:rounded-t-lg"
          >
            STL
          </button>
          <button
            onClick={() => handleSelect('step')}
            className="w-full px-4 py-2 text-left text-sm text-content hover:bg-surface-hover"
          >
            STEP
          </button>
          <button
            onClick={() => handleSelect('3mf')}
            className="w-full px-4 py-2 text-left text-sm text-content hover:bg-surface-hover last:rounded-b-lg"
          >
            3MF
          </button>
          {/* eslint-enable i18next/no-literal-string */}
        </div>
      )}
    </div>
  );
}

export function BaseplatePage() {
  const t = useTranslation();
  const { isMobile } = useResponsive();

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

  const handleExport = useCallback(
    (format: ExportFileFormat) => {
      void downloadBaseplate(format);
    },
    [downloadBaseplate]
  );

  const handleBack = useCallback(() => {
    // Navigate back to the layout editor
    window.history.back();
  }, []);

  // Compute per-side padding for the preview
  const effectiveWidthMm = resolveDrawerMm(baseplateParams.drawerWidthMm, drawerWidth, gridUnitMm);
  const effectiveDepthMm = resolveDrawerMm(baseplateParams.drawerDepthMm, drawerDepth, gridUnitMm);
  const gridWidthMm = drawerWidth * gridUnitMm;
  const gridDepthMm = drawerDepth * gridUnitMm;
  const remainderX = Math.max(0, effectiveWidthMm - gridWidthMm);
  const remainderY = Math.max(0, effectiveDepthMm - gridDepthMm);
  const paddingLeft = remainderX * baseplateParams.paddingRatioX;
  const paddingRight = remainderX * (1 - baseplateParams.paddingRatioX);
  const paddingFront = remainderY * baseplateParams.paddingRatioY;
  const paddingBack = remainderY * (1 - baseplateParams.paddingRatioY);

  return (
    <div className="flex h-screen flex-col bg-surface">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-stroke-subtle px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-content-secondary transition-colors hover:bg-surface-hover hover:text-content"
            aria-label={t('baseplate.backToLayout')}
          >
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M10 12L6 8L10 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="hidden sm:inline">{t('baseplate.backToLayout')}</span>
          </button>

          <div className="h-5 w-px bg-stroke-subtle" />

          <h1 className="text-sm font-semibold text-content">{t('baseplate.pageTitle')}</h1>
        </div>

        <ExportButton canExport={canExport} isExporting={isExporting} onExport={handleExport} />
      </header>

      {/* Main content */}
      <div className={`flex flex-1 overflow-hidden ${isMobile ? 'flex-col' : 'flex-row'}`}>
        {/* Panel */}
        <aside
          className={`${
            isMobile ? 'h-1/3 border-b' : 'w-72 border-r'
          } shrink-0 overflow-y-auto border-stroke-subtle`}
        >
          <BaseplatePanel />
        </aside>

        {/* Preview */}
        <main className="flex-1">
          <BaseplatePreview
            width={drawerWidth}
            depth={drawerDepth}
            paddingLeft={paddingLeft}
            paddingRight={paddingRight}
            paddingFront={paddingFront}
            paddingBack={paddingBack}
          />
        </main>
      </div>
    </div>
  );
}

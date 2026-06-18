/**
 * Empty state overlay for the cutout editor canvas.
 *
 * Shows an animated draw tutorial (matching the grid editor's pattern)
 * and keyboard shortcut hints. Renders when no cutouts exist.
 */

import { Button } from '@/design-system';
import { useTranslation } from '@/i18n';

interface CutoutEmptyStateProps {
  /** Sidebar uses compact sizing; workspace uses larger sizing */
  readonly variant: 'sidebar' | 'workspace';
  /** When set, shows a "scan a real tool with your phone" call to action. */
  readonly onScanWithPhone?: () => void;
}

export function CutoutEmptyState({ variant, onScanWithPhone }: CutoutEmptyStateProps) {
  const t = useTranslation();
  const isWorkspace = variant === 'workspace';

  // Animation container dimensions
  const containerW = isWorkspace ? 120 : 104;
  const containerH = isWorkspace ? 88 : 80;

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-[5]">
      <div className="flex flex-col items-center p-6 rounded-xl max-w-xs text-center bg-surface opacity-95 backdrop-blur-sm">
        {/* Animated draw gesture */}
        <div
          className="mb-3 relative"
          style={{ width: containerW, height: containerH }}
          aria-hidden="true"
        >
          {/* Click ring — expands and fades */}
          <div
            className="absolute rounded-full border-2 border-accent animate-cutout-draw-hint-click"
            style={{ width: 36, height: 36, top: -14, left: -14 }}
          />
          {/* Dashed rectangle — grows with cursor */}
          <div className="absolute top-0 left-0 border-2 border-dashed border-accent/60 bg-accent/10 rounded-sm animate-cutout-draw-hint-rect" />
          {/* Cursor — drags diagonally */}
          <div
            className="absolute top-0 left-0 animate-cutout-draw-hint-cursor"
            style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.25))' }}
          >
            <svg width="20" height="24" viewBox="0 0 18 22" fill="none">
              <path
                d="M2 1 L2 17 L6.2 13 L9.5 20 L12.2 18.8 L9 12.5 L14 12.5 Z"
                fill="white"
                stroke="#222"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        <p className="font-medium mb-1 text-sm text-content-secondary">
          {t('binDesigner.cutouts.emptyHint')}
        </p>

        {/* Keyboard shortcut hints */}
        <div className="text-left text-xs space-y-1.5 text-content-tertiary w-full mt-2">
          <ShortcutHint shortcut="R" label={t('binDesigner.cutouts.shortcutRect')} />
          <ShortcutHint shortcut="C" label={t('binDesigner.cutouts.shortcutCircle')} />
          <ShortcutHint shortcut="G" label={t('binDesigner.cutouts.shortcutPolygon')} />
          <ShortcutHint shortcut="S" label={t('binDesigner.cutouts.shortcutSlot')} />
          <ShortcutHint shortcut="P" label={t('binDesigner.cutouts.shortcutPen')} />
          {isWorkspace && (
            <ShortcutHint shortcut="V" label={t('binDesigner.cutouts.shortcutSelect')} />
          )}
        </div>

        {onScanWithPhone && (
          <div className="pointer-events-auto mt-4 w-full border-t border-stroke-subtle pt-3">
            <Button type="button" variant="secondary" size="sm" fullWidth onClick={onScanWithPhone}>
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="h-3.5 w-3.5"
                  viewBox="0 0 14 14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="3.5" y="1" width="7" height="12" rx="1.5" />
                  <circle cx="7" cy="4" r="0.75" fill="currentColor" stroke="none" />
                  <path d="M6 11.25h2" />
                </svg>
                {t('binDesigner.cutouts.scanImport.emptyCta')}
              </span>
            </Button>
            <p className="mt-1.5 text-[11px] text-content-tertiary">
              {t('binDesigner.cutouts.scanImport.emptyHelp')}
            </p>
            <p className="mt-1 flex items-center justify-center gap-1 text-[10px] text-content-disabled">
              <svg
                className="h-3 w-3 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              {t('scan.capture.privacy')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ShortcutHint({ shortcut, label }: { readonly shortcut: string; readonly label: string }) {
  return (
    <div className="flex items-center gap-2">
      <kbd className="px-1.5 py-0.5 rounded text-[10px] bg-surface-elevated border border-stroke-subtle text-content-disabled font-mono">
        {shortcut}
      </kbd>
      <span>{label}</span>
    </div>
  );
}

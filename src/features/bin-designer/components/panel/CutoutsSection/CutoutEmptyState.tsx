/**
 * Empty state overlay for the cutout editor canvas: the two ways to start,
 * drawing a shape and scanning a tool, as equal choices. Renders when no
 * cutouts exist.
 */

import { Button } from '@/design-system';
import { ScanToolIcon } from '@/design-system/Icon';
import { useTranslation } from '@/i18n';

interface CutoutEmptyStateProps {
  /** Sidebar uses compact sizing; workspace uses larger sizing */
  readonly variant: 'sidebar' | 'workspace';
  readonly onScanTool?: () => void;
}

export function CutoutEmptyState({ variant, onScanTool }: CutoutEmptyStateProps) {
  const isWorkspace = variant === 'workspace';
  const containerW = isWorkspace ? 120 : 104;
  const containerH = isWorkspace ? 88 : 80;

  // A container query, not a viewport one: the board shares its row with the
  // inspector dock, so the window width says nothing about the room here.
  return (
    <div className="@container absolute inset-0 flex items-center justify-center pointer-events-none z-[5] p-3">
      <div className="flex flex-col @lg:flex-row items-center @lg:items-stretch gap-4 @lg:gap-6 p-6 rounded-xl max-w-xs @lg:max-w-xl text-center bg-surface opacity-95 backdrop-blur-sm">
        <DrawChoice isWorkspace={isWorkspace} width={containerW} height={containerH} />
        {onScanTool && (
          <>
            <div className="h-px w-full @lg:h-auto @lg:w-px bg-stroke-subtle" aria-hidden="true" />
            <ScanChoice height={containerH} onScanTool={onScanTool} />
          </>
        )}
      </div>
    </div>
  );
}

function DrawChoice({
  isWorkspace,
  width,
  height,
}: {
  readonly isWorkspace: boolean;
  readonly width: number;
  readonly height: number;
}) {
  const t = useTranslation();
  return (
    <div className="flex flex-col items-center @lg:flex-1">
      {/* Animated draw gesture */}
      <div className="mb-3 relative" style={{ width, height }} aria-hidden="true">
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
    </div>
  );
}

function ScanChoice({
  height,
  onScanTool,
}: {
  readonly height: number;
  readonly onScanTool: () => void;
}) {
  const t = useTranslation();
  return (
    <div className="flex flex-col items-center @lg:flex-1 @lg:justify-center">
      <div
        className="hidden @lg:flex mb-3 items-center justify-center text-accent"
        style={{ height }}
        aria-hidden="true"
      >
        <ScanToolIcon className="h-14 w-14" strokeWidth={1.5} />
      </div>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        fullWidth
        className="pointer-events-auto"
        leftIcon={<ScanToolIcon size="xs" />}
        onClick={onScanTool}
      >
        {t('binDesigner.cutouts.scanImport.title')}
      </Button>
      <p className="mt-2 text-label text-content-tertiary">
        {t('binDesigner.cutouts.scanImport.emptyHelp')}
      </p>
    </div>
  );
}

function ShortcutHint({ shortcut, label }: { readonly shortcut: string; readonly label: string }) {
  return (
    <div className="flex items-center gap-2">
      <kbd className="px-1.5 py-0.5 rounded text-micro bg-surface-elevated border border-stroke-subtle text-content-disabled font-mono">
        {shortcut}
      </kbd>
      <span>{label}</span>
    </div>
  );
}

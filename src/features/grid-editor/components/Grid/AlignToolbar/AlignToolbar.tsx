/**
 * Floating alignment toolbar for multi-selected bins.
 *
 * Renders above the bounding box of selected bins with buttons for
 * left/top/right/bottom edge alignment. Desktop only — visibility
 * is controlled by the parent (Grid.tsx) based on selection count
 * and breakpoint.
 */

import { useTranslation } from '@/i18n';
import type { BinId } from '@/core/types';
import type { AlignEdge } from '@/shared/utils/alignBins';

interface AlignToolbarProps {
  readonly selectedBinIds: readonly BinId[];
  readonly onAlign: (edge: AlignEdge) => void;
}

/** Height of the toolbar + gap below it */
const TOOLBAR_OFFSET = 44;
const VIEWPORT_PADDING = 8;
const TOOLBAR_WIDTH_ESTIMATE = 180;

/**
 * Compute toolbar position from the bounding box of selected bin DOM elements.
 * Returns null if no bin elements are found.
 */
function computePosition(selectedBinIds: readonly BinId[]): { top: number; left: number } | null {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;

  for (const id of selectedBinIds) {
    const el = document.querySelector(`[data-bin-id="${CSS.escape(id)}"]`);
    if (!el) continue;
    const rect = el.getBoundingClientRect();
    minX = Math.min(minX, rect.left);
    maxX = Math.max(maxX, rect.right);
    minY = Math.min(minY, rect.top);
  }

  if (minX === Infinity) return null;

  const centerX = (minX + maxX) / 2;
  const halfWidth = TOOLBAR_WIDTH_ESTIMATE / 2;

  return {
    top: Math.max(VIEWPORT_PADDING, minY - TOOLBAR_OFFSET),
    left: Math.max(
      VIEWPORT_PADDING + halfWidth,
      Math.min(centerX, window.innerWidth - VIEWPORT_PADDING - halfWidth)
    ),
  };
}

export function AlignToolbar({ selectedBinIds, onAlign }: AlignToolbarProps) {
  const t = useTranslation();

  // Recompute every render so position stays correct after pan/zoom/align
  const position = computePosition(selectedBinIds);

  if (!position) return null;

  const buttons: Array<{ edge: AlignEdge; label: string }> = [
    { edge: 'left', label: t('commandPalette.alignLeft') },
    { edge: 'top', label: t('commandPalette.alignTop') },
    { edge: 'bottom', label: t('commandPalette.alignBottom') },
    { edge: 'right', label: t('commandPalette.alignRight') },
  ];

  return (
    <div
      className="fixed z-50 flex items-center gap-0.5 rounded-lg border border-stroke-subtle bg-surface-elevated px-1.5 py-1 shadow-lg animate-scale-in"
      style={{
        top: position.top,
        left: position.left,
        transform: 'translateX(-50%)',
      }}
      role="toolbar"
      aria-label={t('toast.alignToolbar')}
    >
      {buttons.map(({ edge, label }) => (
        <button
          key={edge}
          type="button"
          className="rounded p-1.5 text-content-tertiary hover:bg-surface-hover hover:text-content transition-colors"
          onClick={() => onAlign(edge)}
          title={label}
          aria-label={label}
        >
          <AlignIcon edge={edge} />
        </button>
      ))}
    </div>
  );
}

/** Alignment direction icons matching the bin-designer cutout editor style. */
function AlignIcon({ edge }: { edge: AlignEdge }) {
  const props = {
    className: 'h-3.5 w-3.5',
    viewBox: '0 0 14 14',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
  } as const;

  switch (edge) {
    case 'left':
      return (
        <svg {...props}>
          <line x1="2" y1="1" x2="2" y2="13" />
          <line x1="2" y1="4" x2="10" y2="4" />
          <line x1="2" y1="10" x2="7" y2="10" />
        </svg>
      );
    case 'right':
      return (
        <svg {...props}>
          <line x1="12" y1="1" x2="12" y2="13" />
          <line x1="4" y1="4" x2="12" y2="4" />
          <line x1="7" y1="10" x2="12" y2="10" />
        </svg>
      );
    case 'top':
      return (
        <svg {...props}>
          <line x1="1" y1="2" x2="13" y2="2" />
          <line x1="4" y1="2" x2="4" y2="10" />
          <line x1="10" y1="2" x2="10" y2="7" />
        </svg>
      );
    case 'bottom':
      return (
        <svg {...props}>
          <line x1="1" y1="12" x2="13" y2="12" />
          <line x1="4" y1="4" x2="4" y2="12" />
          <line x1="10" y1="7" x2="10" y2="12" />
        </svg>
      );
  }
}

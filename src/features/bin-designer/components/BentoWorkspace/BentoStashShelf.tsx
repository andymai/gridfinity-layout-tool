/**
 * Off-grid stash shelf, mirroring the layout planner's staging strip: a
 * bottom rail of compartments waiting to be placed. Drag a tile onto the
 * canvas to place it; drag a compartment over the shelf to stash it (the
 * shelf highlights as a drop target, hit-tested by the interaction hook via
 * the ref this component receives).
 */

import { IconButton } from '@/design-system';
import { ICON_PATHS } from '@/shared/constants/iconPaths';
import { useTranslation } from '@/i18n';
import { DESIGNER_CONSTRAINTS } from '@/features/bin-designer/constants';
import type { StashedCompartment } from '@/features/bin-designer/types';
import { stashEntryMask } from '@/features/bin-designer/utils/bentoDraw';

function Icon({ paths }: { readonly paths: readonly string[] }) {
  return (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      {paths.map((d) => (
        <path key={d} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
      ))}
    </svg>
  );
}

export interface BentoStashShelfProps {
  readonly stash: readonly StashedCompartment[];
  readonly shelfRef: React.RefObject<HTMLDivElement | null>;
  /** True while a compartment move hovers the shelf (drop-target styling). */
  readonly dropActive: boolean;
  /** Index being dragged out right now — its tile renders as a placeholder. */
  readonly draggingIndex: number | null;
  readonly onEntryPointerDown: (index: number, e: React.PointerEvent) => void;
  readonly onRemoveEntry: (index: number) => void;
}

const TILE_UNIT_PX = 18;
const TILE_MAX_PX = 64;

function fillClass(isDragging: boolean): string {
  return isDragging ? 'border-dashed border-accent' : 'border-accent/70 bg-accent/15';
}

/**
 * A merged entry's footprint in DOM order. The mask is stored with row 0 at the
 * front of the bin, which the canvas paints at the bottom, so the rows come out
 * back-to-front here to keep the tile and the canvas the same way up.
 */
function maskRowsTopFirst(
  cells: readonly boolean[],
  w: number,
  h: number
): { readonly key: number; readonly filled: boolean }[] {
  const out: { key: number; filled: boolean }[] = [];
  for (let row = h - 1; row >= 0; row--) {
    for (let col = 0; col < w; col++) {
      const key = row * w + col;
      out.push({ key, filled: cells[key] });
    }
  }
  return out;
}

export function BentoStashShelf({
  stash,
  shelfRef,
  dropActive,
  draggingIndex,
  onEntryPointerDown,
  onRemoveEntry,
}: BentoStashShelfProps) {
  const t = useTranslation();

  const tileSize = (entry: StashedCompartment) => {
    const scale = Math.min(1, TILE_MAX_PX / (Math.max(entry.w, entry.h) * TILE_UNIT_PX));
    return {
      width: Math.max(14, entry.w * TILE_UNIT_PX * scale),
      height: Math.max(14, entry.h * TILE_UNIT_PX * scale),
    };
  };

  return (
    <div
      ref={shelfRef}
      data-testid="bento-stash-shelf"
      className={`flex flex-shrink-0 items-stretch gap-3 border-t px-4 py-2 transition-colors ${
        dropActive ? 'border-accent bg-accent/10' : 'border-stroke-subtle bg-surface-secondary'
      }`}
    >
      <div className="flex w-24 flex-shrink-0 flex-col justify-center">
        <span className="text-xs font-semibold text-content-secondary">
          {t('binDesigner.bento.stashTitle')}
        </span>
        <span className="text-micro tabular-nums text-content-tertiary">
          {stash.length}/{DESIGNER_CONSTRAINTS.MAX_STASH_ENTRIES}
        </span>
      </div>

      {stash.length === 0 ? (
        <div className="flex min-h-[3.5rem] flex-1 items-center justify-center rounded-md border border-dashed border-stroke-subtle">
          <p className="text-xs text-content-tertiary">
            {dropActive
              ? t('binDesigner.bento.stashDropHint')
              : t('binDesigner.bento.stashEmptyHint')}
          </p>
        </div>
      ) : (
        <div className="flex flex-1 items-center gap-2 overflow-x-auto py-1">
          {stash.map((entry, index) => {
            const isDragging = index === draggingIndex;
            const { width, height } = tileSize(entry);
            const fill = fillClass(isDragging);
            const cells = stashEntryMask(entry);
            return (
              <div
                key={`${index}-${entry.w}x${entry.h}-${entry.cells?.join('') ?? ''}-${entry.label ?? ''}`}
                className={`group relative flex flex-shrink-0 flex-col items-center gap-0.5 rounded-md border p-1.5 ${
                  isDragging
                    ? 'border-dashed border-accent bg-transparent'
                    : 'cursor-grab border-stroke-subtle bg-surface-elevated hover:border-accent/60'
                }`}
                data-testid={`bento-stash-entry-${index}`}
              >
                <div
                  role="button"
                  tabIndex={0}
                  aria-label={t('binDesigner.bento.stashEntryLabel', {
                    w: entry.w,
                    h: entry.h,
                    label: entry.label ?? '',
                  })}
                  className="flex items-center justify-center"
                  onPointerDown={(e) => onEntryPointerDown(index, e)}
                >
                  {cells ? (
                    <div
                      className="grid"
                      style={{
                        width,
                        height,
                        gridTemplateColumns: `repeat(${entry.w}, 1fr)`,
                        gridTemplateRows: `repeat(${entry.h}, 1fr)`,
                      }}
                      data-testid={`bento-stash-shape-${index}`}
                    >
                      {maskRowsTopFirst(cells, entry.w, entry.h).map(({ key, filled }) => (
                        <div
                          key={key}
                          className={filled ? `rounded-sm border ${fill}` : undefined}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className={`rounded-sm border ${fill}`} style={{ width, height }} />
                  )}
                </div>
                <span className="max-w-[5rem] truncate text-micro text-content-secondary">
                  {entry.label ?? `${entry.w}×${entry.h}`}
                </span>
                {!isDragging && (
                  <IconButton
                    size="sm"
                    variant="dangerGhost"
                    touchTarget={false}
                    className="absolute -right-1.5 -top-1.5 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
                    title={t('binDesigner.bento.stashRemove')}
                    aria-label={t('binDesigner.bento.stashRemove')}
                    onClick={() => onRemoveEntry(index)}
                  >
                    <Icon paths={ICON_PATHS.trash} />
                  </IconButton>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

import type { BinParams } from '@/features/bin-designer/types';
import { cutoutInterior } from '@/features/bin-designer/utils/binDimensions';
import { isPartialMask, type CellMask } from '@/shared/utils/cellMask';
import { autoArrangeCutouts, type ArrangedPlacement } from './autoArrange';
import { computeGrowToFit } from './growBinToFit';
import { translateCutoutPreview } from './cutoutHelpers';
import type { Bounds } from './geometryCore';
import { getOffBoardCutoutIds, type CutoutBoard } from './offBoardCutouts';

/** The editor's Arrange defaults, so a phone's packing matches what the editor would do. */
const PACK_GAP_MM = 2;
const MAX_GROWS = 4;

export interface BinPacking {
  /** The size to grow the bin to first, or null to keep it. */
  readonly size: { readonly width: number; readonly depth: number } | null;
  readonly placements: Readonly<Record<string, ArrangedPlacement>>;
}

/** The bin's floor as a cutout board: its interior, custom footprint and mesh outlines. */
export function binBoard(params: BinParams): CutoutBoard {
  const { innerW, innerD } = cutoutInterior(params);
  const mask = params.cellMask;
  return {
    width: innerW,
    depth: innerD,
    mask,
    cellSize: mask ? { cellMmX: innerW / mask.cols, cellMmY: innerD / mask.rows } : undefined,
    meshAssets: params.meshAssets,
  };
}

export function offFloorIds(params: BinParams): ReadonlySet<string> {
  const cut = params.cutouts.filter((c) => c.hidden !== true);
  return getOffBoardCutoutIds(cut, binBoard(params));
}

/** A custom footprint's missing cells, in interior mm, scaled the way the editor's board is. */
function notches(mask: CellMask, innerW: number, innerD: number): Bounds[] {
  const cellW = innerW / mask.cols;
  const cellD = innerD / mask.rows;
  const out: Bounds[] = [];
  for (let r = 0; r < mask.rows; r++) {
    for (let c = 0; c < mask.cols; c++) {
      if (mask.cells[r * mask.cols + c] === 1) continue;
      out.push({ minX: c * cellW, minY: r * cellD, maxX: (c + 1) * cellW, maxY: (r + 1) * cellD });
    }
  }
  return out;
}

/**
 * Every cutout packed onto the floor, clear of locked pockets and a custom
 * footprint's notches, with the bin grown until the packing fits. `turn` turns
 * each lone tool to its tightest fit (a group moves as one block and keeps its
 * angle); without it every tool keeps the angle it has.
 * A packing growing can't fix (a custom footprint, the size limit) comes back
 * at the last size with pockets past the floor, which the caller checks for.
 */
export function packIntoBin(
  params: BinParams,
  halfGridMode: boolean,
  { turn = true }: { readonly turn?: boolean } = {}
): BinPacking {
  let size: BinPacking['size'] = null;
  for (let attempt = 0; ; attempt++) {
    const sized = size ? { ...params, ...size } : params;
    const { innerW, innerD } = cutoutInterior(sized);
    const placements = autoArrangeCutouts(params.cutouts, {
      binWidth: innerW,
      binDepth: innerD,
      gap: PACK_GAP_MM,
      turn,
      keepOut: isPartialMask(params.cellMask) ? notches(params.cellMask, innerW, innerD) : [],
    });
    if (attempt === MAX_GROWS) return { size, placements };
    const packed = params.cutouts.map((c) =>
      c.id in placements ? translateCutoutPreview(c, placements[c.id]) : c
    );
    const grown = computeGrowToFit(sized, packed, halfGridMode);
    if (!grown) return { size, placements };
    size = grown;
  }
}

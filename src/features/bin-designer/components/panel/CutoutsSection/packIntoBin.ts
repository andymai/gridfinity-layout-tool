import type { BinParams } from '@/features/bin-designer/types';
import { cutoutInterior } from '@/features/bin-designer/utils/binDimensions';
import { autoArrangeCutouts, type ArrangedPlacement } from './autoArrange';
import { computeGrowToFit } from './growBinToFit';
import { translateCutoutPreview } from './cutoutHelpers';
import type { CutoutBoard } from './offBoardCutouts';

/** The editor's Arrange defaults, so a phone's packing matches what the editor would do. */
const PACK_GAP_MM = 2;
const MAX_GROWS = 4;

/** The bin's floor, as `CutoutWorkspace` builds it. */
export function binBoard(params: BinParams): CutoutBoard {
  const { innerW, innerD } = cutoutInterior(params);
  const mask = params.cellMask;
  return {
    width: innerW,
    depth: innerD,
    mask,
    cellSize: mask ? { cellMmX: innerW / mask.cols, cellMmY: innerD / mask.rows } : undefined,
  };
}

export interface BinPacking {
  /** The size to grow the bin to first, or null to keep it. */
  readonly size: { readonly width: number; readonly depth: number } | null;
  readonly placements: Readonly<Record<string, ArrangedPlacement>>;
}

/**
 * Every cutout packed onto the floor, with the bin grown until the packing
 * fits. `turn` turns each tool to its tightest fit; without it every tool keeps
 * the angle it has. A packing growing can't fix (a custom footprint, the size
 * limit) comes back at the last size, and the off-board warning says so.
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

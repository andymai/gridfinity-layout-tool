import type { PrintPiece } from '@/core/types';
import { formatPieceSize } from '@/features/print-export/utils/split';

const STYLES = {
  splitPiece: {
    backgroundColor: 'var(--color-primary-muted)',
    border: '1px solid var(--color-primary)',
    borderRadius: '2px',
    fontSize: '9px',
    color: 'var(--text-secondary)',
  },
} as const;

interface SplitPreviewProps {
  width: number;
  depth: number;
  pieces: PrintPiece[];
  /** Cell size in pixels - 14 for mobile, 16 for desktop */
  cellSize?: number;
  gap?: number;
}

/** Pixel span of `units` grid units, laid out on the cell+gap pitch. */
function span(units: number, cellSize: number, gap: number): number {
  return units * cellSize + (units - 1) * gap;
}

/**
 * Visual preview of how a bin will be split for printing.
 *
 * The split is a regular grid of equal pieces (see `splitBinSize`), so the
 * diagram lays that grid out directly rather than packing pieces into whole
 * cells. Packing could not draw this shape: an even split into 3 gives pieces
 * of 3.33 units, and a scan that only ever tried whole-cell origins ran out of
 * room before placing the last one — dropping a piece from the diagram while
 * the count beside it still said three.
 */
export function SplitPreview({ width, depth, pieces, cellSize = 16, gap = 2 }: SplitPreviewProps) {
  const piece = pieces[0];
  if (!piece || piece.width <= 0 || piece.depth <= 0) return null;

  // Recovered rather than passed: the pieces tile the bin exactly, so the grid
  // is implied by one piece's size and cannot disagree with the row's count.
  const cols = Math.max(1, Math.round(width / piece.width));
  const rows = Math.max(1, Math.round(depth / piece.depth));

  return (
    <div
      className="relative"
      style={{ width: span(width, cellSize, gap), height: span(depth, cellSize, gap) }}
    >
      {Array.from({ length: rows }, (_, row) =>
        Array.from({ length: cols }, (_, col) => (
          <div
            key={`${col}-${row}`}
            className="absolute flex items-center justify-center overflow-hidden"
            style={{
              left: col * (piece.width * (cellSize + gap)),
              bottom: row * (piece.depth * (cellSize + gap)),
              width: span(piece.width, cellSize, gap),
              height: span(piece.depth, cellSize, gap),
              ...STYLES.splitPiece,
            }}
          >
            {formatPieceSize(piece.width)}×{formatPieceSize(piece.depth)}
          </div>
        ))
      )}
    </div>
  );
}

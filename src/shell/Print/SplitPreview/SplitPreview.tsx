import type { PrintPiece } from '@/core/types';

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

/**
 * Visual preview of how a bin will be split for printing.
 * Shows a grid diagram with the split pieces.
 */
export function SplitPreview({ width, depth, pieces, cellSize = 16, gap = 2 }: SplitPreviewProps) {
  // Half-grid bins yield fractional width/depth; allocate and scan whole cells so a
  // fractional piece can't index a row/column the grid never allocated.
  const cols = Math.max(0, Math.ceil(width));
  const rows = Math.max(0, Math.ceil(depth));

  // Create a 2D grid to place pieces
  const grid: (PrintPiece | null)[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => null)
  );

  // Place pieces using greedy left-to-right, bottom-to-top
  const placedPieces: Array<{ piece: PrintPiece; x: number; y: number }> = [];
  const piecesToPlace = pieces.flatMap((p) =>
    Array.from({ length: p.count }, () => ({ width: p.width, depth: p.depth, count: 1 }))
  );

  for (const piece of piecesToPlace) {
    outer: for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        let fits = true;
        if (x + piece.width > width || y + piece.depth > depth) {
          fits = false;
        } else {
          for (let py = y; py < y + piece.depth && fits; py++) {
            for (let px = x; px < x + piece.width && fits; px++) {
              if (grid[py][px] !== null) fits = false;
            }
          }
        }

        if (fits) {
          for (let py = y; py < y + piece.depth; py++) {
            for (let px = x; px < x + piece.width; px++) {
              grid[py][px] = piece;
            }
          }
          placedPieces.push({ piece, x, y });
          break outer;
        }
      }
    }
  }

  return (
    <div
      className="relative"
      style={{
        width: width * cellSize + (width - 1) * gap,
        height: depth * cellSize + (depth - 1) * gap,
      }}
    >
      {placedPieces.map((placed) => (
        <div
          key={`${placed.x}-${placed.y}-${placed.piece.width}x${placed.piece.depth}`}
          className="absolute flex items-center justify-center"
          style={{
            left: placed.x * (cellSize + gap),
            bottom: placed.y * (cellSize + gap),
            width: placed.piece.width * cellSize + (placed.piece.width - 1) * gap,
            height: placed.piece.depth * cellSize + (placed.piece.depth - 1) * gap,
            ...STYLES.splitPiece,
          }}
        >
          {placed.piece.width}×{placed.piece.depth}
        </div>
      ))}
    </div>
  );
}

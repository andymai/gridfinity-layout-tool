/**
 * Top-view assembly-map PNG for split baseplate exports.
 *
 * The print guide (`printGuide.ts`) already ships an ASCII grid map, but for a
 * large or complex split plate an ASCII diagram is hard to read against the
 * physical parts. This renders the same tiling to a labeled top-view image
 * (front of drawer at the bottom) so a user can eyeball where each piece —
 * A1, B1, … — sits during assembly. The file name suffix of every export
 * (`baseplate_A1.stl`) is exactly the label drawn here, so the image doubles as
 * a file-to-slot key.
 *
 * Pieces are drawn to their true relative footprint (grid units), so edge
 * pieces that carry less than a full column/row read smaller, matching the real
 * parts. Grid positions outside a shaped-plate outline are simply absent (no
 * piece), leaving the cell blank.
 *
 * Uses a 2D canvas — the caller runs on the main thread. Returns `null` when a
 * 2D context or PNG encoder isn't available (e.g. headless test environments),
 * so callers degrade to the text-only guide.
 */

import type { BaseplateTiling } from '../types/tiling';

/** Target upper bound for the grid area's longest side, in px. */
const GRID_MAX_PX = 1000;
/** Per-grid-unit pixel size is clamped to this range for legibility. */
const MIN_PX_PER_UNIT = 24;
const MAX_PX_PER_UNIT = 80;
/** Margin around the grid for the title, front-of-drawer note, and breathing room. */
const MARGIN_PX = 56;
/** Extra space below the grid for the "Front of drawer" indicator. */
const FOOTER_PX = 44;

const COLOR_BG = '#ffffff';
const COLOR_PIECE_FILL = '#e0e7ff';
const COLOR_PIECE_BORDER = '#1e293b';
const COLOR_LABEL = '#0f172a';
const COLOR_SUBLABEL = '#475569';
const COLOR_FOOTER = '#475569';

/** Round-trip a canvas to PNG bytes, preferring the async `toBlob` encoder. */
async function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<ArrayBuffer | null> {
  if (typeof canvas.toBlob === 'function') {
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/png');
    });
    if (blob) return blob.arrayBuffer();
  }
  // Fallback: decode the data URL manually when toBlob is unavailable.
  if (typeof canvas.toDataURL === 'function') {
    const dataUrl = canvas.toDataURL('image/png');
    const comma = dataUrl.indexOf(',');
    if (comma === -1 || !dataUrl.startsWith('data:image/png')) return null;
    const binary = atob(dataUrl.slice(comma + 1));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }
  return null;
}

/**
 * Render the split tiling to a labeled top-view PNG. Returns the encoded PNG
 * bytes, or `null` when the tiling isn't a split (nothing to assemble) or a
 * canvas/encoder isn't available.
 */
export async function generateAssemblyMapImage(
  tiling: BaseplateTiling
): Promise<ArrayBuffer | null> {
  if (!tiling.isSplit || tiling.pieces.length === 0) return null;
  if (typeof document === 'undefined') return null;

  const totalW = tiling.totalWidthUnits;
  const totalD = tiling.totalDepthUnits;
  if (totalW <= 0 || totalD <= 0) return null;

  const unitsMax = Math.max(totalW, totalD);
  const pxPerUnit = Math.max(
    MIN_PX_PER_UNIT,
    Math.min(MAX_PX_PER_UNIT, Math.floor(GRID_MAX_PX / unitsMax))
  );

  const gridW = totalW * pxPerUnit;
  const gridH = totalD * pxPerUnit;
  const canvasW = gridW + MARGIN_PX * 2;
  const canvasH = gridH + MARGIN_PX * 2 + FOOTER_PX;

  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Background.
  ctx.fillStyle = COLOR_BG;
  ctx.fillRect(0, 0, canvasW, canvasH);

  // Title.
  ctx.fillStyle = COLOR_LABEL;
  ctx.font = '600 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Baseplate assembly map', canvasW / 2, MARGIN_PX / 2 + 4);

  const originX = MARGIN_PX;
  const originY = MARGIN_PX;

  for (const piece of tiling.pieces) {
    // Front of drawer is at the bottom: row/gridOffsetY grows toward the back,
    // so invert the Y axis to place row 1 (front) at the bottom of the image.
    const x = originX + piece.gridOffsetX * pxPerUnit;
    const y = originY + (totalD - piece.gridOffsetY - piece.depthUnits) * pxPerUnit;
    const w = piece.widthUnits * pxPerUnit;
    const h = piece.depthUnits * pxPerUnit;

    ctx.fillStyle = COLOR_PIECE_FILL;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = COLOR_PIECE_BORDER;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);

    const cx = x + w / 2;
    const cy = y + h / 2;

    // Prominent grid label (e.g. "A1"), scaled to the cell but capped.
    const labelSize = Math.max(14, Math.min(48, Math.floor(Math.min(w, h) * 0.4)));
    ctx.fillStyle = COLOR_LABEL;
    ctx.font = `700 ${labelSize}px sans-serif`;
    ctx.fillText(piece.label, cx, cy);

    // Secondary detail below the label when the cell is roomy enough: footprint
    // in grid units, plus a rotation hint for paired (180°-seated) pieces.
    const subSize = Math.floor(labelSize * 0.42);
    if (h > labelSize + subSize * 2 + 8 && subSize >= 9) {
      const detail =
        piece.placementRotationDeg === 180
          ? `${piece.widthUnits}×${piece.depthUnits}u · rotate 180°`
          : `${piece.widthUnits}×${piece.depthUnits}u`;
      ctx.fillStyle = COLOR_SUBLABEL;
      ctx.font = `400 ${subSize}px sans-serif`;
      ctx.fillText(detail, cx, cy + labelSize * 0.75);
    }
  }

  // Front-of-drawer indicator centered below the grid.
  ctx.fillStyle = COLOR_FOOTER;
  ctx.font = '600 18px sans-serif';
  ctx.fillText('▼ Front of drawer', canvasW / 2, originY + gridH + FOOTER_PX / 2 + 6);

  return canvasToPngBytes(canvas);
}

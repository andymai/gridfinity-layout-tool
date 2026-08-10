/**
 * The printable calibration sheet.
 *
 * Built from the same constants the detector reads (`@/shared/scanTrace`
 * → `calibrationGrid`), so a printed sheet and the code that measures it can
 * never drift apart.
 *
 * Page geometry is A4, but every printed element also sits inside US Letter's
 * bounds so one file serves both at 100% scale. The margins are deliberately
 * generous: a marker lost to a printer's unprintable edge degrades gracefully
 * (the fit just uses the rest), whereas a scaled print silently falsifies every
 * measurement — hence the 100mm check ruler, which is the one element that must
 * survive.
 */

import {
  CALIBRATION_MARKER_MM,
  CALIBRATION_COLS,
  CALIBRATION_ROWS,
  calibrationNodes,
  calibrationSpanMm,
} from '@/shared/scanTrace';

export interface CalibrationSheetLabels {
  readonly title: string;
  readonly printHint: string;
  readonly placeHint: string;
}

const PAGE_W = 210;
const PAGE_H = 297;
const ORIGIN_X = 21;
const ORIGIN_Y = 21;
const RULER_MM = 100;
const RULER_Y = 254;

export const CALIBRATION_SHEET_FILENAME = 'gridfinity-calibration-sheet.svg';

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function markerRects(): string {
  const half = CALIBRATION_MARKER_MM / 2;
  return calibrationNodes()
    .map((node) => {
      const x = ORIGIN_X + node.x - half;
      const y = ORIGIN_Y + node.y - half;
      return `<rect x="${x}" y="${y}" width="${CALIBRATION_MARKER_MM}" height="${CALIBRATION_MARKER_MM}"/>`;
    })
    .join('');
}

/** A 100mm bar with 10mm ticks — the only defence against a scaled print. */
function rulerPath(): string {
  const segments = [`M${ORIGIN_X} ${RULER_Y} h${RULER_MM}`];
  for (let mm = 0; mm <= RULER_MM; mm += 10) {
    const tall = mm === 0 || mm === RULER_MM;
    segments.push(`M${ORIGIN_X + mm} ${RULER_Y - (tall ? 3 : 1.6)} v${tall ? 6 : 3.2}`);
  }
  return segments.join(' ');
}

export function buildCalibrationSheetSvg(labels: CalibrationSheetLabels): string {
  const span = calibrationSpanMm();
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_W}mm" height="${PAGE_H}mm"`,
    ` viewBox="0 0 ${PAGE_W} ${PAGE_H}">`,
    `<rect width="${PAGE_W}" height="${PAGE_H}" fill="#ffffff"/>`,
    `<g fill="#000000">${markerRects()}</g>`,
    `<path d="${rulerPath()}" stroke="#000000" stroke-width="0.4" fill="none"/>`,
    `<g font-family="Helvetica, Arial, sans-serif" fill="#000000">`,
    `<text x="${ORIGIN_X}" y="${RULER_Y - 8}" font-size="4.2" font-weight="bold">`,
    escapeXml(labels.title),
    `</text>`,
    // The ruler's own label stays untranslated: it is a measurement on a
    // calibration target, and "100 mm" reads the same in every locale we ship.
    `<text x="${ORIGIN_X + RULER_MM + 4}" y="${RULER_Y + 1.4}" font-size="3.6">${RULER_MM} mm</text>`,
    `<text x="${ORIGIN_X}" y="${RULER_Y + 7}" font-size="3.6">`,
    escapeXml(labels.printHint),
    `</text>`,
    `<text x="${ORIGIN_X}" y="${RULER_Y + 13}" font-size="3.6">`,
    escapeXml(labels.placeHint),
    `</text>`,
    `</g>`,
    // The lattice's own extent, for anyone checking a print with calipers.
    `<!-- ${CALIBRATION_COLS}x${CALIBRATION_ROWS} markers, ${span.width}x${span.height}mm centre-to-centre -->`,
    `</svg>`,
  ].join('');
}

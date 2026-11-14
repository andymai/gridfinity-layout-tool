/**
 * The printable measuring strips: each a row of the calibration sheet's
 * markers on its own strip of paper, cut out and laid across a tall tool.
 *
 * Built from the geometry the detector reads (`measuringStrip`), and laid out
 * like the calibration sheet: A4, with every element also inside US Letter,
 * so one file serves both at 100% scale. Nothing but markers sits on a strip,
 * so no text can read as one; the 100 mm check bar is below them.
 */

import {
  CALIBRATION_MARKER_MM,
  CALIBRATION_PITCH_MM,
  STRIP_MARGIN_MM,
  STRIP_MARKER_COUNTS,
  stripSizeMm,
} from '@/shared/scanTrace';

export interface MeasuringStripsLabels {
  readonly title: string;
  readonly printHint: string;
  readonly placeHint: string;
}

const PAGE_W = 210;
const PAGE_H = 297;
const TOP = 21;
const GAP = 16;
const LEFT = 21;
const RULER_MM = 100;

export const MEASURING_STRIPS_FILENAME = 'gridfinity-measuring-strips.svg';

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function strip(markers: number, y: number): string {
  const { length, width } = stripSizeMm(markers);
  const x = (PAGE_W - length) / 2;
  const first = STRIP_MARGIN_MM;
  const squares = Array.from({ length: markers }, (_, i) => {
    const mx = x + first + i * CALIBRATION_PITCH_MM;
    return `<rect x="${mx}" y="${y + first}" width="${CALIBRATION_MARKER_MM}" height="${CALIBRATION_MARKER_MM}"/>`;
  }).join('');
  const span = (markers - 1) * CALIBRATION_PITCH_MM;
  return [
    `<rect x="${x}" y="${y}" width="${length}" height="${width}" fill="none" stroke="#9a9a9a" stroke-width="0.3" stroke-dasharray="2 1.5"/>`,
    `<g fill="#000000">${squares}</g>`,
    // A measurement, not prose: it reads the same in every locale we ship.
    `<text x="${x}" y="${y + width + 4.5}" font-size="3.2" fill="#555555">${markers} × ${span} mm</text>`,
  ].join('');
}

function rulerPath(y: number): string {
  const segments = [`M${LEFT} ${y} h${RULER_MM}`];
  for (let mm = 0; mm <= RULER_MM; mm += 10) {
    const tall = mm === 0 || mm === RULER_MM;
    segments.push(`M${LEFT + mm} ${y - (tall ? 3 : 1.6)} v${tall ? 6 : 3.2}`);
  }
  return segments.join(' ');
}

export function buildMeasuringStripsSvg(labels: MeasuringStripsLabels): string {
  let y = TOP;
  const strips = STRIP_MARKER_COUNTS.map((markers) => {
    const svg = strip(markers, y);
    y += stripSizeMm(markers).width + GAP;
    return svg;
  }).join('');
  const rulerY = y + 14;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_W}mm" height="${PAGE_H}mm"`,
    ` viewBox="0 0 ${PAGE_W} ${PAGE_H}">`,
    `<rect width="${PAGE_W}" height="${PAGE_H}" fill="#ffffff"/>`,
    `<g font-family="Helvetica, Arial, sans-serif">${strips}</g>`,
    `<path d="${rulerPath(rulerY)}" stroke="#000000" stroke-width="0.4" fill="none"/>`,
    `<g font-family="Helvetica, Arial, sans-serif" fill="#000000">`,
    `<text x="${LEFT}" y="${rulerY - 8}" font-size="4.2" font-weight="bold">${escapeXml(labels.title)}</text>`,
    `<text x="${LEFT + RULER_MM + 4}" y="${rulerY + 1.4}" font-size="3.6">${RULER_MM} mm</text>`,
    `<text x="${LEFT}" y="${rulerY + 7}" font-size="3.6">${escapeXml(labels.printHint)}</text>`,
    `<text x="${LEFT}" y="${rulerY + 13}" font-size="3.6">${escapeXml(labels.placeHint)}</text>`,
    `</g>`,
    `</svg>`,
  ].join('');
}

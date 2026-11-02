/**
 * A shadow board plan written out as SVG or DXF.
 *
 * Both carry the same geometry in the same frame: millimetres, origin at the
 * bin's centre, Y up. The SVG is sized in real millimetres so a vector editor
 * or laser software opens it at true size, and flips Y once, as SVG counts
 * down. The DXF puts the footprint and the openings on layers of their own,
 * each opening's islands on its layer, so CAM picking a layer keeps them.
 */

import { sanitizeFileName } from '@/features/bin-designer/utils/fileNaming';
import { writeDxf } from '@/shared/utils/dxfWriter';
import type { Pt, ShadowBoardPlan } from './shadowBoardPlan';

export type ShadowBoardFormat = 'svg' | 'dxf';

export const SHADOW_BOARD_FORMATS: readonly ShadowBoardFormat[] = ['svg', 'dxf'];

const DECIMALS = 3;
/** Room around the footprint, so its line is not on the page edge (mm). */
const MARGIN_MM = 2;
/** A hairline: visible at true size without reading as a cut width (mm). */
const STROKE_MM = 0.2;

function num(v: number): string {
  const rounded = Number(v.toFixed(DECIMALS));
  return Object.is(rounded, -0) ? '0' : String(rounded);
}

function describe(clearance: boolean): string[] {
  return [
    'Shadow board: the bin footprint and every opening in its top.',
    'Millimetres, origin at the bin centre, Y up.',
    clearance
      ? 'Openings include each pocket clearance, as the bin is cut.'
      : 'Openings are drawn as designed, without clearance.',
    'Outlines only: no depths, entry edges or lean.',
  ];
}

function bounds(plan: ShadowBoardPlan): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const ring of [...plan.outline, ...plan.openings.flat()]) {
    for (const p of ring) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  }
  return Number.isFinite(minX)
    ? { minX, minY, maxX, maxY }
    : { minX: 0, minY: 0, maxX: 0, maxY: 0 };
}

export function shadowBoardSvg(plan: ShadowBoardPlan, clearance: boolean): string {
  const b = bounds(plan);
  const width = b.maxX - b.minX + 2 * MARGIN_MM;
  const height = b.maxY - b.minY + 2 * MARGIN_MM;
  const at = (p: Pt) => `${num(p.x - b.minX + MARGIN_MM)} ${num(b.maxY - p.y + MARGIN_MM)}`;
  const d = (rings: readonly (readonly Pt[])[]) =>
    rings
      .filter((r) => r.length >= 3)
      .map((r) => `M ${r.map(at).join(' L ')} Z`)
      .join(' ');
  const path = (rings: readonly (readonly Pt[])[]) =>
    `    <path d="${d(rings)}" fill-rule="evenodd" />`;
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<!-- ${describe(clearance).join(' ')} -->`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${num(width)}mm" height="${num(height)}mm" viewBox="0 0 ${num(width)} ${num(height)}">`,
    `  <g id="bin-outline" fill="none" stroke="#64748b" stroke-width="${STROKE_MM}">`,
    path(plan.outline),
    '  </g>',
    `  <g id="openings" fill="none" stroke="#000000" stroke-width="${STROKE_MM}">`,
    ...plan.openings.map((polygon) => path(polygon)),
    '  </g>',
    '</svg>',
    '',
  ].join('\n');
}

export function shadowBoardDxf(plan: ShadowBoardPlan, clearance: boolean): string {
  return writeDxf(
    [
      { name: 'BIN_OUTLINE', color: 8, rings: plan.outline },
      { name: 'OPENINGS', color: 7, rings: plan.openings.flat() },
    ],
    describe(clearance)
  );
}

/** Download name, prefixed by the design name the way a cutout SVG is. */
export function shadowBoardFileName(designName: string, format: ShadowBoardFormat): string {
  const sanitized = sanitizeFileName(designName);
  const usable = sanitized && !/^_+$/.test(sanitized) && sanitized !== 'Untitled Bin';
  return `${usable ? `${sanitized}-shadow-board` : 'gridfinity-shadow-board'}.${format}`;
}

/**
 * Traced tools written out as files of their own, for use outside the
 * designer: SVG and DXF drawings, and an STL that extrudes each tool.
 *
 * Millimetres throughout, every tool where it was traced. Tools are traced
 * with Y counting down, as SVG counts; the DXF and STL flip it once so Y is
 * up, with the tools' bounds starting at the origin.
 */

import { err, ok, type Result } from '@/core/result';
import type { PathPoint } from '@/shared/types/bin';
import type { SceneShape } from '@/shared/scanTrace';
import { writeDxf } from '@/shared/utils/dxfWriter';
import { flattenPathToPolyline, pathCutoutSections } from '@/shared/utils/pathCutoutOutline';
import { dropCoincidentPoints } from '@/shared/utils/polyline';
import type { CleanedTool } from './scanFlow';

export type TraceExportFormat = 'svg' | 'dxf' | 'stl';

export const TRACE_EXPORT_FORMATS: readonly TraceExportFormat[] = ['svg', 'dxf', 'stl'];

/** The insertion clearance a traced tool's pocket gets, a side (mm). */
export const SCAN_CLEARANCE_MM = 0.4;

export const DEFAULT_TRACE_THICKNESS_MM = 10;

export interface TraceExportOptions {
  /** Grow each outline, and shrink each island, by {@link SCAN_CLEARANCE_MM}. */
  readonly clearance: boolean;
  /** How far the STL extrudes each tool (mm). */
  readonly thicknessMm: number;
}

interface Pt {
  readonly x: number;
  readonly y: number;
}

/** A tool's rings as drawn: polylines in the traced frame, Y down. */
interface FlatTool {
  readonly outline: readonly Pt[];
  readonly islands: readonly (readonly Pt[])[];
}

const DECIMALS = 3;
/** Room round the tools, so no line sits on the page edge (mm). */
const MARGIN_MM = 2;
/** A hairline: visible at true size without reading as a cut width (mm). */
const STROKE_MM = 0.2;

const MIME: Record<TraceExportFormat, string> = {
  svg: 'image/svg+xml',
  dxf: 'application/dxf',
  stl: 'model/stl',
};

function num(v: number): string {
  const rounded = Number(v.toFixed(DECIMALS));
  return Object.is(rounded, -0) ? '0' : String(rounded);
}

const corner = (p: Pt): PathPoint => ({
  x: p.x,
  y: p.y,
  handleIn: null,
  handleOut: null,
  symmetric: false,
});

export function toolsFromShapes(shapes: readonly SceneShape[], keepHoles: boolean): CleanedTool[] {
  return shapes.map((shape) => ({
    path: shape.outputPoints.map(corner),
    holes: keepHoles ? (shape.holes ?? []).map((hole) => hole.outputPoints.map(corner)) : [],
  }));
}

const flat = (ring: readonly PathPoint[]): Pt[] =>
  dropCoincidentPoints(flattenPathToPolyline(ring));

/** A ring offset as the builder offsets a pocket, or left bare where it can't be. */
function cleared(ring: readonly Pt[], island: boolean): readonly Pt[] {
  return pathCutoutSections(ring, SCAN_CLEARANCE_MM, 0, island)?.rim ?? ring;
}

function flatTools(tools: readonly CleanedTool[], clearance: boolean): FlatTool[] {
  return tools
    .map((tool) => {
      const outline = flat(tool.path);
      const islands = tool.holes.map(flat).filter((ring) => ring.length >= 3);
      return clearance
        ? { outline: cleared(outline, false), islands: islands.map((ring) => cleared(ring, true)) }
        : { outline, islands };
    })
    .filter((tool) => tool.outline.length >= 3);
}

function bounds(tools: readonly FlatTool[]): {
  minX: number;
  minY: number;
  w: number;
  h: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const tool of tools) {
    for (const p of tool.outline) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  }
  return Number.isFinite(minX)
    ? { minX, minY, w: maxX - minX, h: maxY - minY }
    : { minX: 0, minY: 0, w: 0, h: 0 };
}

function polylineData(ring: readonly Pt[], at: (p: Pt) => string): string {
  return `M ${ring.map(at).join(' L ')} Z`;
}

function curveData(ring: readonly PathPoint[], at: (p: Pt) => string): string {
  let d = `M ${at(ring[0])}`;
  for (let i = 1; i <= ring.length; i++) {
    const a = ring[i - 1];
    const b = ring[i % ring.length];
    if (a.handleOut || b.handleIn) {
      const c1 = a.handleOut ? { x: a.x + a.handleOut.dx, y: a.y + a.handleOut.dy } : a;
      const c2 = b.handleIn ? { x: b.x + b.handleIn.dx, y: b.y + b.handleIn.dy } : b;
      d += ` C ${at(c1)} ${at(c2)} ${at(b)}`;
    } else if (i < ring.length) {
      d += ` L ${at(b)}`;
    }
  }
  return `${d} Z`;
}

/**
 * The tools as an SVG at true size, one even-odd path a tool so its islands
 * read as holes. Without clearance the curves stay curves.
 */
export function traceSvg(tools: readonly CleanedTool[], options: TraceExportOptions): string {
  const drawn = flatTools(tools, options.clearance);
  const { minX, minY, w, h } = bounds(drawn);
  const at = (p: Pt) => `${num(p.x - minX + MARGIN_MM)} ${num(p.y - minY + MARGIN_MM)}`;
  const paths = options.clearance
    ? drawn.map((tool) => [tool.outline, ...tool.islands].map((r) => polylineData(r, at)))
    : tools
        .filter((tool) => flat(tool.path).length >= 3)
        .map((tool) =>
          [tool.path, ...tool.holes.filter((r) => flat(r).length >= 3)].map((r) => curveData(r, at))
        );
  const width = num(w + 2 * MARGIN_MM);
  const height = num(h + 2 * MARGIN_MM);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}mm" height="${height}mm" viewBox="0 0 ${width} ${height}">`,
    `<g fill="none" stroke="#000" stroke-width="${STROKE_MM}" fill-rule="evenodd">`,
    ...paths.map((rings) => `<path d="${rings.join(' ')}"/>`),
    '</g>',
    '</svg>',
    '',
  ].join('\n');
}

/** The tools in the Y-up frame the DXF and STL share. */
function upright(tools: readonly FlatTool[]): FlatTool[] {
  const { minX, minY, h } = bounds(tools);
  const up = (ring: readonly Pt[]): Pt[] =>
    ring.map((p) => ({ x: p.x - minX, y: h - (p.y - minY) }));
  return tools.map((tool) => ({ outline: up(tool.outline), islands: tool.islands.map(up) }));
}

export function traceDxf(tools: readonly CleanedTool[], options: TraceExportOptions): string {
  const layers = upright(flatTools(tools, options.clearance)).map((tool, i) => ({
    name: `TOOL_${i + 1}`,
    color: (i % 6) + 1,
    rings: [tool.outline, ...tool.islands],
  }));
  return writeDxf(layers, [
    'Traced tool outlines: one layer a tool, its islands on its layer.',
    'Millimetres, Y up, the outlines starting at the origin.',
    options.clearance
      ? `Each outline grown, and each island shrunk, by ${SCAN_CLEARANCE_MM} mm.`
      : 'Outlines as traced, without clearance.',
  ]);
}

/**
 * Fails for an STL whose thickness isn't a positive number, which would write
 * an unreadable file, or whose chunk can't load (offline after an update).
 */
export async function traceExportBlob(
  tools: readonly CleanedTool[],
  format: TraceExportFormat,
  options: TraceExportOptions
): Promise<Result<Blob, 'unbuilt'>> {
  try {
    if (format === 'svg') return ok(new Blob([traceSvg(tools, options)], { type: MIME.svg }));
    if (format === 'dxf') return ok(new Blob([traceDxf(tools, options)], { type: MIME.dxf }));
    if (!(Number.isFinite(options.thicknessMm) && options.thicknessMm > 0)) return err('unbuilt');
    // The extruder triangulates with three, which the phone loads only for this.
    const { extrudedStl } = await import('./traceStl');
    const solid = extrudedStl(upright(flatTools(tools, options.clearance)), options.thicknessMm);
    return ok(new Blob([solid], { type: MIME.stl }));
  } catch {
    return err('unbuilt');
  }
}

export function traceExportFileName(format: TraceExportFormat): string {
  return `traced-tools.${format}`;
}

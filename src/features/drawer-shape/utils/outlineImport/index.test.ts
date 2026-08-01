/**
 * End-to-end behaviour of the import pipeline — the parts a caller can observe.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect } from 'vitest';
import { isErr, isOk } from '@/core/result';
import { validateOutline, OUTLINE_MAX_VERTICES } from '@/shared/utils/drawerOutline';
import { importOutline } from './index';

const U = 42;
const OPTS = {
  drawerWidthMm: 10 * U,
  drawerDepthMm: 8 * U,
  gridUnitMm: U,
  gridUnitMmY: U,
  scaleToFit: false,
};

const dxf = (...pairs: [number | string, string | number][]): string =>
  pairs.map(([c, v]) => `${c}\n${v}`).join('\n') + '\n';
const entities = (...body: [number | string, string | number][]): string =>
  dxf([0, 'SECTION'], [2, 'ENTITIES'], ...body, [0, 'ENDSEC'], [0, 'EOF']);

/** Closed polyline sampled around a circle, optionally bowing every segment. */
function polygonDxf(n: number, bulge?: number): string {
  const body: [number | string, string | number][] = [
    [0, 'LWPOLYLINE'],
    [90, n],
    [70, 1],
  ];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    body.push([10, 150 + 100 * Math.cos(a)], [20, 150 + 100 * Math.sin(a)]);
    if (bulge !== undefined) body.push([42, bulge]);
  }
  return entities(...body);
}

const SVG_RECT =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">' +
  '<path d="M 0 0 L 200 0 L 200 100 L 0 100 Z" /></svg>';

describe('importOutline', () => {
  // A drawing renamed, or saved with no extension, is still the format it is.
  // Routing on the name would fail it with a message the user cannot act on.
  it('routes on content, so a misnamed file still imports', () => {
    const fromSvg = importOutline(SVG_RECT, OPTS);
    expect(isOk(fromSvg)).toBe(true);
    expect(isOk(fromSvg) && fromSvg.value.format).toBe('svg');

    const fromDxf = importOutline(polygonDxf(6), OPTS);
    expect(isOk(fromDxf)).toBe(true);
    expect(isOk(fromDxf) && fromDxf.value.format).toBe('dxf');
  });

  it('reports a binary DXF distinctly, not as an unreadable file', () => {
    const r = importOutline('AutoCAD Binary DXF\r\n', OPTS);
    expect(isErr(r) && r.error.code).toBe('BINARY_DXF');
  });

  // Everything downstream assumes a valid outline; the import is the last place
  // that can say which file was the problem.
  it('produces an outline the store validator accepts', () => {
    const r = importOutline(polygonDxf(12), OPTS);
    expect(isOk(r)).toBe(true);
    if (!isOk(r)) return;
    expect(
      validateOutline({ vertices: r.value.vertices }, OPTS.drawerWidthMm, OPTS.drawerDepthMm, U)
    ).toBeNull();
  });

  it('thins an oversized loop and reports how much it removed', () => {
    const r = importOutline(polygonDxf(2000), OPTS);
    expect(isOk(r)).toBe(true);
    if (!isOk(r)) return;
    expect(r.value.vertices.length).toBeLessThanOrEqual(OUTLINE_MAX_VERTICES);
    expect(r.value.simplifiedAway).toBeGreaterThan(0);
  });

  // Simplification pins arc endpoints, so a perimeter that is mostly arcs can
  // stay above the ceiling however far the tolerance escalates. Reporting
  // success there would block Apply later with a message naming no file.
  it('reports a loop it cannot thin far enough, rather than passing it on', () => {
    const r = importOutline(polygonDxf(400, 0.01), OPTS);
    expect(isErr(r)).toBe(true);
    if (!isErr(r)) return;
    expect(r.error.code).toBe('TOO_MANY_VERTICES');
  });

  // A circle is the whole perimeter for a round drawer, and two half-arcs
  // describe it while sitting below the outline model's three-vertex floor.
  it('imports a perimeter made only of curves', () => {
    const r = importOutline(entities([0, 'CIRCLE'], [10, 50], [20, 50], [40, 40]), OPTS);
    expect(isOk(r)).toBe(true);
    if (!isOk(r)) return;
    expect(r.value.vertices.length).toBeGreaterThanOrEqual(3);
    expect(
      validateOutline({ vertices: r.value.vertices }, OPTS.drawerWidthMm, OPTS.drawerDepthMm, U)
    ).toBeNull();
  });

  it('keeps the largest loop and counts the rest', () => {
    const both =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">' +
      '<rect x="0" y="0" width="200" height="100" />' +
      '<rect x="20" y="20" width="10" height="10" />' +
      '<circle cx="150" cy="50" r="5" />' +
      '</svg>';
    const r = importOutline(both, OPTS);
    expect(isOk(r)).toBe(true);
    if (!isOk(r)) return;
    expect(r.value.droppedLoops).toBe(2);
    expect(r.value.sourceWidthMm).toBeCloseTo(200, 6);
  });

  it('flags an oversized loop without altering it', () => {
    const r = importOutline(polygonDxf(8), {
      ...OPTS,
      drawerWidthMm: 100,
      drawerDepthMm: 100,
    });
    expect(isOk(r)).toBe(true);
    if (!isOk(r)) return;
    expect(r.value.fitsAtTrueScale).toBe(false);
    expect(r.value.scale).toBe(1);
  });

  it('surfaces the parser error unchanged', () => {
    const r = importOutline('not a drawing', OPTS);
    expect(isErr(r) && r.error.code).toBe('PARSE_FAILED');
  });
});

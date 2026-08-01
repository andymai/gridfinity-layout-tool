/**
 * The parser reads SVG through `DOMParser`, which the node-env `unit` project
 * does not provide. This file sits under `utils/`, so it is not covered by the
 * `components/` glob that routes the cutout importer's tests to jsdom.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect } from 'vitest';
import { isOk, isErr } from '@/core/result';
import {
  arcGeometry,
  flattenOutline,
  polylineSignedArea,
} from '@/shared/utils/drawerOutlineGeometry';
import { parseSvgOutline } from './svgOutlineParser';
import { largestLoop } from './fitLoop';

function svg(body: string, attrs = 'viewBox="0 0 200 100"'): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>${body}</svg>`;
}

const area = (vertices: Parameters<typeof flattenOutline>[0]['vertices']) =>
  Math.abs(polylineSignedArea(flattenOutline({ vertices })));

describe('parseSvgOutline', () => {
  it('reads a closed path', () => {
    const r = parseSvgOutline(svg('<path d="M 0 0 L 100 0 L 100 50 L 0 50 Z" />'));
    expect(isOk(r)).toBe(true);
    if (!isOk(r)) return;
    expect(r.value).toHaveLength(1);
    expect(r.value[0].vertices).toHaveLength(4);
    expect(area(r.value[0].vertices)).toBeCloseTo(5000, 6);
  });

  // The whole reason this parser is separate from the cutout importer: a
  // drawer outline is lines and circular arcs, so a circular A command must
  // survive as curvature rather than becoming a polyline that approximates it.
  it('keeps a circular arc command as a real arc', () => {
    const r = parseSvgOutline(
      svg('<path d="M 0 0 L 100 0 A 50 50 0 0 1 100 100 L 0 100 Z" />', 'viewBox="0 0 200 200"')
    );
    expect(isOk(r)).toBe(true);
    if (!isOk(r)) return;
    const v = r.value[0].vertices;
    const bowed = v.filter((p) => (p.bulge ?? 0) !== 0);
    expect(bowed).toHaveLength(1);
    const i = v.findIndex((p) => (p.bulge ?? 0) !== 0);
    const arc = arcGeometry(v[i], v[(i + 1) % v.length], v[i].bulge ?? 0);
    expect(arc?.r).toBeCloseTo(50, 4);
  });

  it('flattens a bezier instead of dropping it', () => {
    const r = parseSvgOutline(svg('<path d="M 0 0 C 30 60 70 60 100 0 Z" />'));
    expect(isOk(r)).toBe(true);
    if (!isOk(r)) return;
    // Many points along the curve, none of them carrying curvature.
    expect(r.value[0].vertices.length).toBeGreaterThan(4);
    expect(r.value[0].vertices.every((v) => (v.bulge ?? 0) === 0)).toBe(true);
  });

  it('scales user units to mm from the physical width and height', () => {
    const r = parseSvgOutline(
      svg(
        '<path d="M 0 0 L 100 0 L 100 50 L 0 50 Z" />',
        'viewBox="0 0 200 100" width="400mm" height="200mm"'
      )
    );
    expect(isOk(r)).toBe(true);
    if (!isOk(r)) return;
    // Two millimetres per user unit, so the area quadruples.
    expect(area(r.value[0].vertices)).toBeCloseTo(20000, 3);
  });

  it('applies a transform on the element', () => {
    const r = parseSvgOutline(
      svg('<g transform="scale(2)"><path d="M 0 0 L 50 0 L 50 25 L 0 25 Z" /></g>')
    );
    expect(isOk(r)).toBe(true);
    if (!isOk(r)) return;
    expect(area(r.value[0].vertices)).toBeCloseTo(5000, 6);
  });

  it('reads rect, polygon and circle elements', () => {
    for (const body of [
      '<rect x="10" y="10" width="100" height="50" />',
      '<polygon points="10,10 110,10 110,60 10,60" />',
      '<circle cx="50" cy="50" r="40" />',
    ]) {
      const r = parseSvgOutline(svg(body));
      expect(isOk(r), body).toBe(true);
      if (!isOk(r)) continue;
      expect(r.value.length).toBeGreaterThan(0);
    }
  });

  // A file usually holds the perimeter plus detail inside it; the perimeter is
  // the one enclosing the most area.
  it('returns every closed sub-path so the largest can win', () => {
    const r = parseSvgOutline(
      svg('<path d="M 0 0 L 100 0 L 100 50 L 0 50 Z M 20 20 L 30 20 L 30 30 L 20 30 Z" />')
    );
    expect(isOk(r)).toBe(true);
    if (!isOk(r)) return;
    expect(r.value).toHaveLength(2);
    expect(area(largestLoop(r.value)?.vertices ?? [])).toBeCloseTo(5000, 6);
  });

  // A perimeter drawn as several open polylines is no less a perimeter.
  it('chains open polylines into a loop', () => {
    const r = parseSvgOutline(
      svg('<polyline points="0,0 100,0 100,50" /><polyline points="100,50 0,50 0,0" />')
    );
    expect(isOk(r)).toBe(true);
    if (!isOk(r)) return;
    expect(area(r.value[0].vertices)).toBeCloseTo(5000, 6);
  });

  it('reports malformed and empty files distinctly', () => {
    const bad = parseSvgOutline('<svg><path d=');
    expect(isErr(bad) && bad.error.code).toBe('PARSE_FAILED');
    const empty = parseSvgOutline(svg('<text x="0" y="0">hi</text>'));
    expect(isErr(empty) && empty.error.code).toBe('NO_CLOSED_LOOP');
  });
});

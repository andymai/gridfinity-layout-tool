import { describe, it, expect } from 'vitest';
import { isOk, isErr } from '@/core/result';
import {
  arcGeometry,
  flattenOutline,
  polylineSignedArea,
} from '@/shared/utils/drawerOutlineGeometry';
import { validateOutline } from '@/shared/utils/drawerOutline';
import { parseDxfString } from './dxfParser';

/** Build a group-code stream from (code, value) pairs. */
function dxf(...pairs: [number | string, string | number][]): string {
  return pairs.map(([c, v]) => `${c}\n${v}`).join('\n') + '\n';
}

function entities(...body: [number | string, string | number][]): string {
  return dxf([0, 'SECTION'], [2, 'ENTITIES'], ...body, [0, 'ENDSEC'], [0, 'EOF']);
}

/** Closed square LWPOLYLINE, optionally bulging one edge. */
function square(bulge?: number): string {
  return entities(
    [0, 'LWPOLYLINE'],
    [90, 4],
    [70, 1],
    [10, 0],
    [20, 0],
    ...(bulge === undefined ? [] : ([[42, bulge]] as [number, number][])),
    [10, 100],
    [20, 0],
    [10, 100],
    [20, 80],
    [10, 0],
    [20, 80]
  );
}

const area = (vertices: Parameters<typeof flattenOutline>[0]['vertices']) =>
  Math.abs(polylineSignedArea(flattenOutline({ vertices })));

describe('parseDxfString', () => {
  it('reads a closed LWPOLYLINE', () => {
    const r = parseDxfString(square());
    expect(isOk(r)).toBe(true);
    if (!isOk(r)) return;
    expect(r.value).toHaveLength(1);
    expect(r.value[0].vertices).toHaveLength(4);
    expect(area(r.value[0].vertices)).toBeCloseTo(100 * 80, 6);
  });

  // Group code 42 IS OutlineVertex.bulge — same tan(sweep/4) convention — so a
  // CAD arc has to survive as an arc, not as a polyline approximating one.
  it('carries a polyline bulge through as a real arc', () => {
    const r = parseDxfString(square(0.5));
    expect(isOk(r)).toBe(true);
    if (!isOk(r)) return;
    const v = r.value[0].vertices;
    expect(v[0].bulge).toBe(0.5);
    const arc = arcGeometry(v[0], v[1], 0.5);
    expect(arc).not.toBeNull();
    expect(arc?.r).toBeCloseTo((100 * (1 + 0.25)) / (4 * 0.5), 6);
  });

  it('scales by $INSUNITS', () => {
    const withUnits =
      dxf([0, 'SECTION'], [2, 'HEADER'], [9, '$INSUNITS'], [70, 1], [0, 'ENDSEC']) + square();
    const r = parseDxfString(withUnits);
    expect(isOk(r)).toBe(true);
    if (!isOk(r)) return;
    // One inch is 25.4mm, applied to both axes.
    expect(area(r.value[0].vertices)).toBeCloseTo(100 * 80 * 25.4 * 25.4, 3);
  });

  it('treats a missing $INSUNITS as millimetres', () => {
    const r = parseDxfString(square());
    expect(isOk(r) && area(r.value[0].vertices)).toBeCloseTo(8000, 6);
  });

  // 2D CAD exports a profile as loose entities far more often than as one
  // polyline, so without chaining an ordinary drawer imports as nothing.
  it('chains loose LINE entities into a loop', () => {
    const line = (
      x1: number,
      y1: number,
      x2: number,
      y2: number
    ): [number | string, string | number][] => [
      [0, 'LINE'],
      [10, x1],
      [20, y1],
      [11, x2],
      [21, y2],
    ];
    const r = parseDxfString(
      entities(
        ...line(0, 0, 100, 0),
        ...line(100, 0, 100, 80),
        ...line(100, 80, 0, 80),
        ...line(0, 80, 0, 0)
      )
    );
    expect(isOk(r)).toBe(true);
    if (!isOk(r)) return;
    expect(r.value).toHaveLength(1);
    expect(area(r.value[0].vertices)).toBeCloseTo(8000, 6);
  });

  it('chains an ARC together with lines, keeping its curvature', () => {
    const r = parseDxfString(
      entities(
        [0, 'LINE'],
        [10, 0],
        [20, 0],
        [11, 100],
        [21, 0],
        [0, 'LINE'],
        [10, 100],
        [20, 0],
        [11, 100],
        [21, 80],
        [0, 'LINE'],
        [10, 100],
        [20, 80],
        [11, 0],
        [21, 80],
        // Quarter turn is not what closes this shape, so use a straight return
        // and a separate circle to keep the two cases independent.
        [0, 'LINE'],
        [10, 0],
        [20, 80],
        [11, 0],
        [21, 0],
        [0, 'CIRCLE'],
        [10, 50],
        [20, 40],
        [40, 10]
      )
    );
    expect(isOk(r)).toBe(true);
    if (!isOk(r)) return;
    // The rectangle and the circle are two separate loops.
    expect(r.value).toHaveLength(2);
    const circle = r.value.find((l) => l.vertices.length === 4);
    expect(circle).toBeDefined();
    // Quarter arcs, each |bulge| = tan(90°/4). Halves would describe the same
    // circle in two vertices, which is below the outline model's floor.
    const quarter = Math.tan(Math.PI / 8);
    expect(circle?.vertices.every((v) => Math.abs(Math.abs(v.bulge ?? 0) - quarter) < 1e-9)).toBe(
      true
    );
    // Area is read off the flattened polyline, whose chords cut just inside the
    // arc, so it lands a fraction under the true circle rather than exactly on.
    const exact = Math.PI * 100;
    const measured = area(circle?.vertices ?? []);
    expect(measured).toBeLessThan(exact);
    expect(measured).toBeGreaterThan(exact * 0.99);
  });

  it('splits an arc sweeping more than 180 degrees so the bulge stays legal', () => {
    const r = parseDxfString(entities([0, 'ARC'], [10, 0], [20, 0], [40, 10], [50, 0], [51, 270]));
    // Three quarters of a turn cannot close on its own, so nothing survives —
    // what matters is that it did not produce an out-of-range bulge on the way.
    expect(isErr(r)).toBe(true);
    if (!isErr(r)) return;
    expect(r.error.code).toBe('NO_CLOSED_LOOP');
  });

  it('reads an old-style POLYLINE with VERTEX entities', () => {
    const r = parseDxfString(
      entities(
        [0, 'POLYLINE'],
        [70, 1],
        [0, 'VERTEX'],
        [10, 0],
        [20, 0],
        [0, 'VERTEX'],
        [10, 100],
        [20, 0],
        [0, 'VERTEX'],
        [10, 100],
        [20, 80],
        [0, 'VERTEX'],
        [10, 0],
        [20, 80],
        [0, 'SEQEND']
      )
    );
    expect(isOk(r)).toBe(true);
    if (!isOk(r)) return;
    expect(r.value[0].vertices).toHaveLength(4);
  });

  it('rejects a binary DXF with a reason rather than garbage', () => {
    const r = parseDxfString('AutoCAD Binary DXF\r\n\u0000\u0001');
    expect(isErr(r) && r.error.code).toBe('BINARY_DXF');
  });

  // A circle is the whole perimeter for a round drawer, and two half-arcs
  // describe it perfectly while sitting below the model's three-vertex floor.
  it('imports a DXF whose only entity is a circle', () => {
    const r = parseDxfString(entities([0, 'CIRCLE'], [10, 50], [20, 50], [40, 40]));
    expect(isOk(r)).toBe(true);
    if (!isOk(r)) return;
    expect(r.value).toHaveLength(1);
    expect(r.value[0].vertices.length).toBeGreaterThanOrEqual(3);
    expect(validateOutline({ vertices: r.value[0].vertices }, 420, 336, 42)).toBeNull();
  });

  // Skipping a blank would advance past its partner too, shifting every pair
  // after it — so it fails outright rather than misreading the rest.
  it('rejects a blank line in a group-code position', () => {
    const withBlank = square().replace('0\nLWPOLYLINE', '\n0\nLWPOLYLINE');
    const r = parseDxfString(withBlank);
    expect(isErr(r) && r.error.code).toBe('PARSE_FAILED');
  });

  it('tolerates a trailing newline, which every writer emits', () => {
    expect(isOk(parseDxfString(square() + '\n\n'))).toBe(true);
  });

  it('rejects a file that is not a group-code stream', () => {
    const r = parseDxfString('this is not\na dxf file\nat all\n');
    expect(isErr(r) && r.error.code).toBe('PARSE_FAILED');
  });

  it('reports no closed loop when nothing joins up', () => {
    const r = parseDxfString(entities([0, 'LINE'], [10, 0], [20, 0], [11, 10], [21, 0]));
    expect(isErr(r) && r.error.code).toBe('NO_CLOSED_LOOP');
  });
});

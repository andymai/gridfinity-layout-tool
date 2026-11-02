/**
 * Closed outlines as an ASCII DXF, in millimetres.
 *
 * Written as DXF R12 (AC1009), the version CAD, CAM and laser software all
 * read: one closed POLYLINE per ring under the TABLES a reader needs to
 * resolve its layer and line type. R12 has no unit field, so the units sit
 * in a 999 comment and in `$INSUNITS` and `$MEASUREMENT`, which newer
 * readers honour and older ones skip.
 */

export interface DxfPoint {
  readonly x: number;
  readonly y: number;
}

export interface DxfLayer {
  /** Letters, digits, `_` and `-` only, as every DXF reader accepts. */
  readonly name: string;
  /** AutoCAD colour index, 1 to 255. */
  readonly color: number;
  /** Closed rings, the first point not repeated. Holes go on their shell's layer. */
  readonly rings: readonly (readonly DxfPoint[])[];
}

const DECIMALS = 6;

function num(v: number): string {
  const fixed = v.toFixed(DECIMALS);
  return /^-0\.0+$/.test(fixed) ? fixed.slice(1) : fixed;
}

/** One DXF group: a code line, then a value line. */
const pair = (code: number, value: string | number): string =>
  `${code}\n${typeof value === 'number' ? num(value) : value}`;

const int = (code: number, value: number): string => `${code}\n${Math.round(value)}`;

function header(extents: { min: DxfPoint; max: DxfPoint }): string[] {
  return [
    pair(0, 'SECTION'),
    pair(2, 'HEADER'),
    pair(9, '$ACADVER'),
    pair(1, 'AC1009'),
    pair(9, '$INSUNITS'),
    int(70, 4),
    pair(9, '$MEASUREMENT'),
    int(70, 1),
    pair(9, '$EXTMIN'),
    pair(10, extents.min.x),
    pair(20, extents.min.y),
    pair(30, 0),
    pair(9, '$EXTMAX'),
    pair(10, extents.max.x),
    pair(20, extents.max.y),
    pair(30, 0),
    pair(0, 'ENDSEC'),
  ];
}

function tables(layers: readonly DxfLayer[]): string[] {
  return [
    pair(0, 'SECTION'),
    pair(2, 'TABLES'),
    pair(0, 'TABLE'),
    pair(2, 'LTYPE'),
    int(70, 1),
    pair(0, 'LTYPE'),
    pair(2, 'CONTINUOUS'),
    int(70, 0),
    pair(3, 'Solid line'),
    int(72, 65),
    int(73, 0),
    pair(40, 0),
    pair(0, 'ENDTAB'),
    pair(0, 'TABLE'),
    pair(2, 'LAYER'),
    int(70, layers.length + 1),
    ...['0', ...layers.map((l) => l.name)].flatMap((name, i) => [
      pair(0, 'LAYER'),
      pair(2, name),
      int(70, 0),
      int(62, i === 0 ? 7 : (layers[i - 1]?.color ?? 7)),
      pair(6, 'CONTINUOUS'),
    ]),
    pair(0, 'ENDTAB'),
    pair(0, 'ENDSEC'),
  ];
}

function polyline(layer: string, ring: readonly DxfPoint[]): string[] {
  return [
    pair(0, 'POLYLINE'),
    pair(8, layer),
    int(66, 1),
    pair(10, 0),
    pair(20, 0),
    pair(30, 0),
    int(70, 1),
    ...ring.flatMap((p) => [
      pair(0, 'VERTEX'),
      pair(8, layer),
      pair(10, p.x),
      pair(20, p.y),
      pair(30, 0),
    ]),
    pair(0, 'SEQEND'),
    pair(8, layer),
  ];
}

/**
 * The DXF text for `layers`, opening with `comment` (one line per entry) so
 * a reader of the file learns what it holds.
 */
export function writeDxf(layers: readonly DxfLayer[], comment: readonly string[] = []): string {
  let min = { x: Infinity, y: Infinity };
  let max = { x: -Infinity, y: -Infinity };
  for (const l of layers) {
    for (const ring of l.rings) {
      for (const p of ring) {
        min = { x: Math.min(min.x, p.x), y: Math.min(min.y, p.y) };
        max = { x: Math.max(max.x, p.x), y: Math.max(max.y, p.y) };
      }
    }
  }
  if (!Number.isFinite(min.x)) {
    min = { x: 0, y: 0 };
    max = { x: 0, y: 0 };
  }
  const lines = [
    ...comment.map((line) => pair(999, line.replace(/\r?\n/g, ' '))),
    ...header({ min, max }),
    ...tables(layers),
    pair(0, 'SECTION'),
    pair(2, 'BLOCKS'),
    pair(0, 'ENDSEC'),
    pair(0, 'SECTION'),
    pair(2, 'ENTITIES'),
    ...layers.flatMap((l) =>
      l.rings.filter((r) => r.length >= 3).flatMap((r) => polyline(l.name, r))
    ),
    pair(0, 'ENDSEC'),
    pair(0, 'EOF'),
  ];
  return `${lines.join('\n')}\n`;
}

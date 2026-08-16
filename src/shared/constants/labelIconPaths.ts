/**
 * SVG silhouettes for the label-plate hardware icons (discussion).
 *
 * Path data rather than brepjs draw() chains so contributors can author icons
 * in any vector tool, and so the picker preview and the printed geometry read
 * the SAME strings and cannot drift. The worker turns these into solids via
 * `svgDrawing.drawingFromSvgPath`; see `docs/label-icons.md` for the authoring
 * contract.
 *
 * Holes are listed separately rather than as extra subpaths of `outline`,
 * because brepjs's SVG import does NOT reliably apply the nonzero fill rule:
 * it flattens every subpath into one Blueprint and lets the face builder infer
 * containment, which works for polygon loops but silently UNIONS arc loops
 * whatever their winding. A compound-path washer therefore prints a raised
 * boss where its bore belongs, with an identical bounding box — invisible to
 * every check except enclosed area. Cutting holes explicitly is deterministic.
 *
 * Coordinates are SVG convention (Y down); the importer flips to brepjs' Y-up.
 * The frame is arbitrary — `fitIcon` scales each silhouette from its own
 * bounding box, so a ±5 box and a 24×24 viewBox render identically. These are
 * authored in a ±5 box because the first six were ported from code that used it.
 *
 * Silhouettes must read at 7.8mm tall and 0.4mm proud, which is why every icon
 * is a chunky closed shape and none is line art.
 */

import type { LabelPlateIconId } from './labelPlates';

export const LABEL_ICON_DOMAINS = ['fastener', 'tooling'] as const;

export type LabelIconDomain = (typeof LABEL_ICON_DOMAINS)[number];

export interface LabelIconDef {
  readonly domain: LabelIconDomain;
  /** Outer boundary — a single closed subpath. */
  readonly outline: string;
  /** Fully-interior closed subpaths cut from the outline. */
  readonly holes?: readonly string[];
}

// Six decimals, not four: the ported icons are locked against their pre-port
// rendered sizes to 5dp, and 4dp rounding of the hexagon's vertices drifts the
// nut past that bound.
const round = (n: number): number => Number(n.toFixed(6));

/** Closed circle of radius `r` about (cx, cy), as two 180° arcs. */
const circle = (r: number, cx = 0, cy = 0): string =>
  `M ${round(cx)} ${round(cy - r)} A ${r} ${r} 0 0 1 ${round(cx)} ${round(cy + r)} A ${r} ${r} 0 0 1 ${round(cx)} ${round(cy - r)} Z`;

/**
 * Thread/knurl ridges along a horizontal edge, alternating between two heights.
 *
 * `continues` drops the leading point for callers already sitting on it. Emitting
 * it twice makes a zero-length segment, which SVG renderers quietly ignore but
 * the geometry kernel rejects outright with "makeLineEdge: construction failed".
 */
const ridges = (
  near: number,
  far: number,
  count: number,
  x0: number,
  x1: number,
  continues = false
): string => {
  const step = (x1 - x0) / count;
  let d = '';
  for (let i = continues ? 1 : 0; i <= count; i++)
    d += ` L ${round(x0 + i * step)} ${i % 2 ? far : near}`;
  return d;
};

/** Ridges down a vertical edge, for knurled heads seen face-on. */
const ridgesV = (
  near: number,
  far: number,
  count: number,
  y0: number,
  y1: number,
  continues = false
): string => {
  const step = (y1 - y0) / count;
  let d = '';
  for (let i = continues ? 1 : 0; i <= count; i++)
    d += ` L ${i % 2 ? far : near} ${round(y0 + i * step)}`;
  return d;
};

/**
 * Circular arc as a polyline, for boundaries where a true arc misbehaves.
 *
 * The horseshoe's outer arc meets its leg edges tangentially, and the kernel
 * collapses that wire: enclosed area drops from 45.60 to 23.51 while the
 * bounding box stays correct, so only an area check catches it. Substituting a
 * polyline for that one boundary is exact enough at 7.8mm and deterministic.
 * Prefer real arcs everywhere else — they import analytically.
 */
const arcPoints = (
  r: number,
  from: number,
  to: number,
  segments: number,
  cx = 0,
  cy = 0
): string => {
  let d = '';
  for (let i = 1; i <= segments; i++) {
    const a = from + ((to - from) * i) / segments;
    d += ` L ${round(cx + r * Math.cos(a))} ${round(cy + r * Math.sin(a))}`;
  }
  return d;
};

/** Regular polygon, first vertex at -Y (pointy-top). */
const polygon = (r: number, sides: number, cx = 0, cy = 0): string => {
  const pts = Array.from({ length: sides }, (_, i) => {
    const a = (i / sides) * 2 * Math.PI - Math.PI / 2;
    return `${round(cx + r * Math.cos(a))} ${round(cy + r * Math.sin(a))}`;
  });
  return `M ${pts.join(' L ')} Z`;
};

/** Saw-tooth ring: tips at `rTip`, roots at `rRoot`. */
const toothedCircle = (rTip: number, rRoot: number, teeth: number): string => {
  const pts: string[] = [];
  for (let i = 0; i < teeth; i++) {
    const tip = (i / teeth) * 2 * Math.PI;
    const root = ((i + 0.5) / teeth) * 2 * Math.PI;
    pts.push(`${round(rTip * Math.cos(tip))} ${round(rTip * Math.sin(tip))}`);
    pts.push(`${round(rRoot * Math.cos(root))} ${round(rRoot * Math.sin(root))}`);
  }
  return `M ${pts.join(' L ')} Z`;
};

export const LABEL_ICON_PATHS: Readonly<Record<LabelPlateIconId, LabelIconDef>> = {
  bolt: {
    domain: 'fastener',
    outline:
      'M -5 3.4 L -2.8 3.4 L -2.8 1.5 L 4.2 1.5 L 5 0.9 L 5 -0.9 L 4.2 -1.5 L -2.8 -1.5 L -2.8 -3.4 L -5 -3.4 Z',
  },
  screw: {
    domain: 'fastener',
    outline: 'M -5 3.2 L -3.6 1.4 L 3.4 1.4 L 5 0 L 3.4 -1.4 L -3.6 -1.4 L -5 -3.2 Z',
  },
  woodScrew: {
    domain: 'fastener',
    outline:
      'M -5 2.6 L -3.4 2.6 L -3.4 1.3 L 1 1.3 L 5 0 L 1 -1.3 L -3.4 -1.3 L -3.4 -2.6 L -5 -2.6 Z',
  },
  nut: {
    domain: 'fastener',
    outline: polygon(5, 6),
    holes: [circle(2.4)],
  },
  washer: {
    domain: 'fastener',
    outline: circle(5),
    holes: [circle(2.6)],
  },
  nail: {
    domain: 'fastener',
    outline: 'M -5 3 L -4.3 3 L -4.3 0.8 L 4 0.8 L 5 0 L 4 -0.8 L -4.3 -0.8 L -4.3 -3 L -5 -3 Z',
  },
  hexSocketCap: {
    domain: 'fastener',
    outline:
      'M -5 3.2 L -2.2 3.2 L -2.2 1.35 L 5 1.35 L 5 -1.35 L -2.2 -1.35 L -2.2 -3.2 L -5 -3.2 Z',
    holes: ['M -4.3 1.6 L -3 1.6 L -3 -1.6 L -4.3 -1.6 Z'],
  },
  setScrew: {
    domain: 'fastener',
    // Headless grub screw: thread down both edges and a hex socket set in from
    // the end, without which a plain capsule reads as a battery cell.
    outline: `M -5 1.25${ridges(1.9, 1.3, 8, -4.3, 4.3)} L 5 1.25 L 5 -1.25${ridges(-1.9, -1.3, 8, 4.3, -4.3)} L -5 -1.25 Z`,
    holes: [polygon(0.95, 6, -2.6)],
  },
  selfTapping: {
    domain: 'fastener',
    outline: `M -5 2.9 L -3.1 1.15${ridges(1.15, 1.9, 6, -3.1, 2.2, true)} L 5 0${ridges(-1.9, -1.15, 6, 2.2, -3.1)} L -5 -2.9 Z`,
  },
  threadedRod: {
    domain: 'fastener',
    outline: `M -5 1.15${ridges(1.15, 1.95, 10, -5, 5, true)} L 5 -1.15${ridges(-1.95, -1.15, 10, 5, -5)} Z`,
  },
  splitPin: {
    domain: 'fastener',
    outline:
      'M -2.4 -2.6 A 2.6 2.6 0 0 0 -2.4 2.6 L 5 1.5 L 5 0.55 L -1.1 0.3 L -1.1 -0.3 L 5 -0.55 L 5 -1.5 Z',
    holes: [circle(1.15, -2.6)],
  },
  lockWasher: {
    domain: 'fastener',
    // Split ring, one end stepped past the other — the spring offset.
    outline: 'M 0.9 -4.9 A 5 5 0 1 1 0.9 4.9 L 0.9 2.55 A 2.6 2.6 0 1 0 0.9 -2.55 Z',
  },
  wingNut: {
    domain: 'fastener',
    outline:
      'M -2.2 -2.3 L -4.4 -3.9 A 1.5 1.5 0 0 0 -5 -2.6 L -3.6 -0.9 L -3.6 0.9 L -5 2.6 A 1.5 1.5 0 0 0 -4.4 3.9 L -2.2 2.3 L 2.2 2.3 L 4.4 3.9 A 1.5 1.5 0 0 0 5 2.6 L 3.6 0.9 L 3.6 -0.9 L 5 -2.6 A 1.5 1.5 0 0 0 4.4 -3.9 L 2.2 -2.3 Z',
    holes: [circle(1.5)],
  },
  squareNut: {
    domain: 'fastener',
    outline: 'M -4.6 -4.6 L 4.6 -4.6 L 4.6 4.6 L -4.6 4.6 Z',
    holes: [circle(2.5)],
  },
  threadedInsert: {
    domain: 'fastener',
    outline: `M -5 2.6${ridges(2.6, 3.3, 8, -5, 5, true)} L 5 -2.6${ridges(-3.3, -2.6, 8, 5, -5)} Z`,
    holes: ['M -3.4 1.5 L 3.4 1.5 L 3.4 -1.5 L -3.4 -1.5 Z'],
  },
  eyeBolt: {
    domain: 'fastener',
    outline: 'M -1.6 -3.4 A 3.4 3.4 0 0 0 -1.6 3.4 L -1.6 1.2 L 5 1.2 L 5 -1.2 L -1.6 -1.2 Z',
    holes: [circle(1.6, -1.9)],
  },
  thumbScrew: {
    domain: 'fastener',
    outline: `M -4.9 4.2${ridgesV(-4.9, -4.1, 10, 4.2, -4.2, true)} L -2.2 -4.2 L -2.2 -1.2 L 5 -1.2 L 5 1.2 L -2.2 1.2 L -2.2 4.2 Z`,
  },
  standoff: {
    domain: 'fastener',
    outline: 'M -5 2.4 L -3.6 3.1 L 3.6 3.1 L 5 2.4 L 5 -2.4 L 3.6 -3.1 L -3.6 -3.1 L -5 -2.4 Z',
    holes: ['M -3.2 1.3 L 3.2 1.3 L 3.2 -1.3 L -3.2 -1.3 Z'],
  },
  drillBit: {
    domain: 'tooling',
    outline:
      'M -5 1.5 L -1.6 1.5 L -1.6 1.9 L 3.4 1.9 L 5 0 L 3.4 -1.9 L -1.6 -1.9 L -1.6 -1.5 L -5 -1.5 Z',
    holes: [
      'M -0.8 1.2 L 0.4 1.2 L -0.2 -1.2 L -1.4 -1.2 Z',
      'M 1.4 1.2 L 2.6 1.2 L 2 -1.2 L 0.8 -1.2 Z',
    ],
  },
  hexKey: {
    domain: 'tooling',
    outline: 'M -5 -4.6 L -1.6 -4.6 L -1.6 1.4 L 5 1.4 L 5 4.6 L -5 4.6 Z',
  },
  tap: {
    domain: 'tooling',
    outline: `M -5 2.3 L -3.2 2.3 L -3.2 1.4 L -1.6 1.4${ridges(1.4, 2.1, 6, -1.6, 3.6, true)} L 5 0.5 L 5 -0.5${ridges(-2.1, -1.4, 6, 3.6, -1.6)} L -1.6 -1.4 L -3.2 -1.4 L -3.2 -2.3 L -5 -2.3 Z`,
  },
  countersink: {
    domain: 'tooling',
    // Blunt pilot tip and a cross-flute; a bare cone reads as an arrowhead.
    outline:
      'M -5 1.2 L -1.4 1.2 L -1.4 3.5 L 4.1 0.6 L 5 0.6 L 5 -0.6 L 4.1 -0.6 L -1.4 -3.5 L -1.4 -1.2 L -5 -1.2 Z',
    holes: ['M -0.6 2.2 L 2.2 1.1 L 2.2 -1.1 L -0.6 -2.2 Z'],
  },
  utilityBlade: {
    domain: 'tooling',
    outline: 'M -5 -2.6 L 5 -2.6 L 3.2 2.6 L -3.2 2.6 Z',
    holes: [
      'M -2.2 -1.5 L -0.6 -1.5 L -0.6 0.2 L -2.2 0.2 Z',
      'M 0.6 -1.5 L 2.2 -1.5 L 2.2 0.2 L 0.6 0.2 Z',
    ],
  },
  spring: {
    domain: 'tooling',
    outline:
      'M -4.8 1.1 L -3.2 3.7 L -1.6 -1.5 L 0 3.7 L 1.6 -1.5 L 3.2 3.7 L 4.8 1.1 L 4.8 -1.1 L 3.2 1.5 L 1.6 -3.7 L 0 1.5 L -1.6 -3.7 L -3.2 1.5 L -4.8 -1.1 Z',
  },
  oRing: {
    domain: 'tooling',
    outline: circle(5),
    holes: [circle(3.6)],
  },
  bearing: {
    domain: 'tooling',
    // Races plus a ring of balls — without the balls this is another annulus
    // and reads identically to washer and oRing at plate size.
    outline: circle(5),
    holes: [
      circle(1.9),
      ...Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * 2 * Math.PI + Math.PI / 8;
        return circle(0.78, 3.35 * Math.cos(a), 3.35 * Math.sin(a));
      }),
    ],
  },
  magnet: {
    domain: 'tooling',
    // Banded pole faces at the leg ends; without them a horseshoe reads as an
    // arch rather than hardware.
    outline: `M -4.4 3.9 L -4.4 0${arcPoints(4.4, Math.PI, 2 * Math.PI, 48)} L 4.4 3.9 L 1.8 3.9 L 1.8 0${arcPoints(1.8, 0, -Math.PI, 48)} L -1.8 3.9 Z`,
    holes: [
      'M -4 2.15 L -2.2 2.15 L -2.2 3.15 L -4 3.15 Z',
      'M 2.2 2.15 L 4 2.15 L 4 3.15 L 2.2 3.15 Z',
    ],
  },
  zipTie: {
    domain: 'tooling',
    outline: `M -5 -2.8 L -1.4 -2.8 L -1.4 -1.1${ridges(-1.1, -0.4, 8, -1.4, 5, true)} L 5 0.4${ridges(0.4, 1.1, 8, 5, -1.4, true)} L -1.4 1.1 L -1.4 2.8 L -5 2.8 Z`,
    holes: ['M -4.1 1.6 L -2.3 1.6 L -2.3 -1.6 L -4.1 -1.6 Z'],
  },
  sawBlade: {
    domain: 'tooling',
    outline: toothedCircle(5, 3.9, 14),
    holes: [circle(1.5)],
  },
  file: {
    domain: 'tooling',
    outline: 'M -5 2.2 L -2.4 2.2 L -2 1.3 L 5 0.6 L 5 -0.6 L -2 -1.3 L -2.4 -2.2 L -5 -2.2 Z',
  },
  endMill: {
    domain: 'tooling',
    outline: 'M -5 1.8 L -0.4 1.8 L -0.4 2.3 L 5 2.3 L 5 -2.3 L -0.4 -2.3 L -0.4 -1.8 L -5 -1.8 Z',
    holes: [
      'M 0.4 1.9 L 1.6 1.9 L 1 -1.9 L -0.2 -1.9 Z',
      'M 2.6 1.9 L 3.8 1.9 L 3.2 -1.9 L 2 -1.9 Z',
    ],
  },
  clip: {
    domain: 'tooling',
    // Circlip: C-body with a gap on the right and a lug hole either side of it.
    outline: 'M 4.698 1.71 A 5 5 0 1 1 4.698 -1.71 L 2.913 -1.06 A 3.1 3.1 0 1 0 2.913 1.06 Z',
    holes: [circle(0.55, 3.507, 2.025), circle(0.55, 3.507, -2.025)],
  },
};

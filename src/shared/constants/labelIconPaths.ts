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

export const LABEL_ICON_DOMAINS = ['fastener', 'tooling', 'kitchen'] as const;

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
    // Split ring: a 20-degree gap on the right is the whole of what separates
    // it from `washer` at this size, so the ends are radial and nothing else
    // competes with them.
    outline: 'M 4.924 0.868 A 5 5 0 1 1 4.924 -0.868 L 2.561 -0.451 A 2.6 2.6 0 1 0 2.561 0.451 Z',
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
  screwdriverBit: {
    domain: 'tooling',
    // Hex shank with its retaining groove, then the driver taper. Without the
    // groove and the chamfered butt this is a plain cone and reads as a
    // countersink.
    outline:
      'M -4.8 -1.25 L -4.35 -1.9 -3.55 -1.9 -3.55 -1.35 -2.75 -1.35 -2.75 -1.9 0.5 -1.9 C 1.4 -1.9 2 -1.2 2.9 -0.85 L 4.8 -0.45 4.8 0.45 2.9 0.85 C 2 1.2 1.4 1.9 0.5 1.9 L -2.75 1.9 -2.75 1.35 -3.55 1.35 -3.55 1.9 -4.35 1.9 -4.8 1.25 Z',
  },
  teaspoon: {
    domain: 'kitchen',
    // Cutlery is drawn handle-left, like the fasteners are head-left. Both spoons
    // fill the frame, so the bowl carries the size difference: a deeper bowl is a
    // squarer silhouette, which the band fit then renders LARGER.
    outline:
      'M -4.8 0 C -4.8 -0.38 -4.5 -0.55 -4.1 -0.55 -3.3 -0.55 -2.4 -0.46 -1.7 -0.4 -0.9 -0.34 -0.35 -0.42 0.3 -0.66 1.1 -0.96 1.5 -1.66 2.5 -1.66 3.5 -1.66 4.8 -1.35 4.8 0 4.8 1.35 3.5 1.66 2.5 1.66 1.5 1.66 1.1 0.96 0.3 0.66 -0.35 0.42 -0.9 0.34 -1.7 0.4 -2.4 0.46 -3.3 0.55 -4.1 0.55 -4.5 0.55 -4.8 0.38 -4.8 0 Z',
  },
  tablespoon: {
    domain: 'kitchen',
    outline:
      'M -4.8 0 C -4.8 -0.45 -4.48 -0.66 -4.05 -0.66 -3.35 -0.66 -2.7 -0.56 -2.1 -0.5 -1.35 -0.42 -0.95 -0.55 -0.5 -0.85 0.35 -1.45 0.75 -2.1 1.95 -2.1 3.3 -2.1 4.8 -1.72 4.8 0 4.8 1.72 3.3 2.1 1.95 2.1 0.75 2.1 0.35 1.45 -0.5 0.85 -0.95 0.55 -1.35 0.42 -2.1 0.5 -2.7 0.56 -3.35 0.66 -4.05 0.66 -4.48 0.66 -4.8 0.45 -4.8 0 Z',
  },
  fork: {
    domain: 'kitchen',
    // Four tines, rounded at the tips and at the slot roots. Three reads as a
    // trident; five puts the slots under 0.8mm at plate scale.
    outline:
      'M -4.8 0 C -4.8 -0.42 -4.48 -0.6 -4.05 -0.6 -3.3 -0.6 -2.5 -0.5 -1.8 -0.44 -1.05 -0.38 -0.55 -0.48 -0.05 -0.72 0.55 -1 0.9 -2.1 1.75 -2.35 1.9 -2.4 2.05 -2.4 2.2 -2.4 L 4.42 -2.4 C 4.63 -2.4 4.79 -2.23 4.79 -2.02 4.79 -1.82 4.63 -1.65 4.42 -1.65 L 2 -1.65 C 1.83 -1.65 1.7 -1.52 1.7 -1.35 1.7 -1.18 1.83 -1.05 2 -1.05 L 4.42 -1.05 C 4.63 -1.05 4.79 -0.88 4.79 -0.68 4.79 -0.47 4.63 -0.3 4.42 -0.3 L 2 -0.3 C 1.83 -0.3 1.7 -0.17 1.7 0 1.7 0.17 1.83 0.3 2 0.3 L 4.42 0.3 C 4.63 0.3 4.79 0.47 4.79 0.68 4.79 0.88 4.63 1.05 4.42 1.05 L 2 1.05 C 1.83 1.05 1.7 1.18 1.7 1.35 1.7 1.52 1.83 1.65 2 1.65 L 4.42 1.65 C 4.63 1.65 4.79 1.82 4.79 2.02 4.79 2.23 4.63 2.4 4.42 2.4 L 2.2 2.4 C 2.05 2.4 1.9 2.4 1.75 2.35 0.9 2.1 0.55 1 -0.05 0.72 -0.55 0.48 -1.05 0.38 -1.8 0.44 -2.5 0.5 -3.3 0.6 -4.05 0.6 -4.48 0.6 -4.8 0.42 -4.8 0 Z',
  },
  knife: {
    domain: 'kitchen',
    // Table knife: a slim handle against a near-parallel blade, tip turned up at
    // the far end. A blade that tapers to the tip from the bolster reads as a
    // trowel, and one no deeper than its handle reads as a bar.
    outline:
      'M -4 -0.8 L -0.6 -0.8 -0.25 -2 3.7 -2 C 4.35 -2 4.8 -1.6 4.8 -1 4.8 -0.2 4 1.05 2.6 1.35 1.8 1.5 0.6 1.5 -0.25 1.5 L -0.6 0.8 -4 0.8 C -4.44 0.8 -4.8 0.44 -4.8 0 -4.8 -0.44 -4.44 -0.8 -4 -0.8 Z',
  },
  spatula: {
    domain: 'kitchen',
    outline:
      'M -4.8 0 C -4.8 -0.42 -4.46 -0.62 -4.05 -0.62 -3.3 -0.62 -2.4 -0.52 -1.7 -0.46 -1 -0.4 -0.4 -0.5 0.1 -0.66 0.75 -0.88 1.15 -1.5 1.5 -2.15 1.62 -2.42 1.85 -2.6 2.2 -2.6 L 4.35 -2.6 C 4.6 -2.6 4.8 -2.4 4.8 -2.15 L 4.8 2.15 C 4.8 2.4 4.6 2.6 4.35 2.6 L 2.2 2.6 C 1.85 2.6 1.62 2.42 1.5 2.15 1.15 1.5 0.75 0.88 0.1 0.66 -0.4 0.5 -1 0.4 -1.7 0.46 -2.4 0.52 -3.3 0.62 -4.05 0.62 -4.46 0.62 -4.8 0.42 -4.8 0 Z',
    holes: [
      'M 2.43 -1.63 L 3.82 -1.63 C 3.97 -1.63 4.1 -1.5 4.1 -1.35 4.1 -1.2 3.97 -1.07 3.82 -1.07 L 2.43 -1.07 C 2.28 -1.07 2.15 -1.2 2.15 -1.35 2.15 -1.5 2.28 -1.63 2.43 -1.63 Z',
      'M 2.43 -0.28 L 3.82 -0.28 C 3.97 -0.28 4.1 -0.15 4.1 0 4.1 0.15 3.97 0.28 3.82 0.28 L 2.43 0.28 C 2.28 0.28 2.15 0.15 2.15 0 2.15 -0.15 2.28 -0.28 2.43 -0.28 Z',
      'M 2.43 1.07 L 3.82 1.07 C 3.97 1.07 4.1 1.2 4.1 1.35 4.1 1.5 3.97 1.63 3.82 1.63 L 2.43 1.63 C 2.28 1.63 2.15 1.5 2.15 1.35 2.15 1.2 2.28 1.07 2.43 1.07 Z',
    ],
  },
  whisk: {
    domain: 'kitchen',
    // Wire loops are line art: they vanish at 0.4mm relief. The balloon is a
    // solid with two slots, so three wires survive as material.
    outline:
      'M -4.8 0 C -4.8 -0.4 -4.5 -0.58 -4.1 -0.58 -3.3 -0.58 -2.4 -0.5 -1.7 -0.46 -0.7 -0.4 0.5 -1.2 1.45 -1.98 2.25 -2.62 3 -2.5 3.65 -2.5 4.4 -2.5 4.8 -1.6 4.8 0 4.8 1.6 4.4 2.5 3.65 2.5 3 2.5 2.25 2.62 1.45 1.98 0.5 1.2 -0.7 0.4 -1.7 0.46 -2.4 0.5 -3.3 0.58 -4.1 0.58 -4.5 0.58 -4.8 0.4 -4.8 0 Z',
    holes: [
      'M 1.97 -1.3 L 3.53 -1.3 C 3.76 -1.3 3.95 -1.11 3.95 -0.88 3.95 -0.65 3.76 -0.46 3.53 -0.46 L 1.97 -0.46 C 1.74 -0.46 1.55 -0.65 1.55 -0.88 1.55 -1.11 1.74 -1.3 1.97 -1.3 Z',
      'M 1.97 0.46 L 3.53 0.46 C 3.76 0.46 3.95 0.65 3.95 0.88 3.95 1.11 3.76 1.3 3.53 1.3 L 1.97 1.3 C 1.74 1.3 1.55 1.11 1.55 0.88 1.55 0.65 1.74 0.46 1.97 0.46 Z',
    ],
  },
  tongs: {
    domain: 'kitchen',
    outline:
      'M -3.8 -1.6 C -2.1 -1.95 0.9 -2.5 4 -2.8 L 4.4 -2.8 C 4.65 -2.8 4.85 -2.6 4.85 -2.35 4.85 -2.1 4.65 -1.9 4.4 -1.9 2 -1.75 -1.2 -1 -3.1 -0.7 -4.19 -0.7 -4.5 -0.39 -4.5 0 -4.5 0.39 -4.19 0.7 -3.8 0.7 -1.2 1 2 1.75 4.4 1.9 4.65 1.9 4.85 2.1 4.85 2.35 4.85 2.6 4.65 2.8 4.4 2.8 L 4 2.8 C 0.9 2.5 -2.1 1.95 -3.8 1.6 -4.68 1.6 -5.4 0.88 -5.4 0 -5.4 -0.88 -4.68 -1.6 -3.8 -1.6 Z',
  },
  ladle: {
    domain: 'kitchen',
    // The handle rises from the END of the rim, not its middle. Centred, the
    // bowl and handle together read as an arrowhead.
    outline:
      'M 0.42 0.6 L 4.9 0.6 C 4.9 2.22 3.59 3.54 1.96 3.54 0.34 3.54 -0.97 2.22 -0.97 0.6 L -4.69 -2.56 C -4.81 -2.66 -4.87 -2.82 -4.84 -2.98 -4.81 -3.14 -4.7 -3.27 -4.55 -3.32 -4.4 -3.38 -4.23 -3.35 -4.11 -3.24 L 0.42 0.6 Z',
  },
  chopsticks: {
    domain: 'kitchen',
    // Two loose sticks cannot be one contour, so this is the wrapped pair. The
    // wrapper crosses both sticks mid-length rather than capping their butts,
    // which keeps the gap between them open at plate scale.
    outline:
      'M -4.8 -1.72 L -2.6 -1.66 -2.6 -2.35 -1 -2.35 -1 -1.62 4.55 -1.46 C 4.72 -1.46 4.85 -1.33 4.85 -1.16 4.85 -0.99 4.72 -0.86 4.55 -0.86 L -1 -0.72 -1 0.72 4.55 0.86 C 4.72 0.86 4.85 0.99 4.85 1.16 4.85 1.33 4.72 1.46 4.55 1.46 L -1 1.62 -1 2.35 -2.6 2.35 -2.6 1.66 -4.8 1.72 -4.8 0.62 -2.6 0.66 -2.6 -0.66 -4.8 -0.62 Z',
  },
  bottleOpener: {
    domain: 'kitchen',
    outline:
      'M -3.7 -1.1 L 0.9 -1.1 C 1.5 -1.1 1.6 -2.35 2.4 -2.35 L 4 -2.35 C 4.44 -2.35 4.8 -1.99 4.8 -1.55 L 4.8 1.55 C 4.8 1.99 4.44 2.35 4 2.35 L 2.4 2.35 C 1.6 2.35 1.5 1.1 0.9 1.1 L -3.7 1.1 C -4.31 1.1 -4.8 0.61 -4.8 0 -4.8 -0.61 -4.31 -1.1 -3.7 -1.1 Z',
    holes: [
      'M -3.2 0 C -3.2 0.28 -3.42 0.5 -3.7 0.5 -3.98 0.5 -4.2 0.28 -4.2 0 -4.2 -0.28 -3.98 -0.5 -3.7 -0.5 -3.42 -0.5 -3.2 -0.28 -3.2 0 Z',
      'M 1.85 -0.55 L 2.11 -0.55 C 2.35 -0.95 2.83 -1.14 3.29 -1.01 3.74 -0.88 4.05 -0.47 4.05 0 4.05 0.47 3.74 0.88 3.29 1.01 2.83 1.14 2.35 0.95 2.11 0.55 L 1.85 0.55 Z',
    ],
  },
  peeler: {
    domain: 'kitchen',
    // Y-peeler: the blade bar closes the fork, so the opening is a true hole.
    // The bar stands proud of the arms at both ends -- flush, the silhouette is a
    // cone with a wedge cut out, which is the countersink mirrored.
    outline:
      'M -3.95 -0.85 L -0.6 -0.85 C 0.9 -0.85 2.3 -1.9 3.5 -2.9 L 4.35 -2.9 C 4.6 -2.9 4.8 -2.7 4.8 -2.45 L 4.8 2.45 C 4.8 2.7 4.6 2.9 4.35 2.9 L 3.5 2.9 C 2.3 1.9 0.9 0.85 -0.6 0.85 L -3.95 0.85 C -4.42 0.85 -4.8 0.47 -4.8 0 -4.8 -0.47 -4.42 -0.85 -3.95 -0.85 Z',
    holes: ['M 0.55 0 C 1.35 -0.75 2.1 -1.3 2.8 -1.75 L 2.8 1.75 C 2.1 1.3 1.35 0.75 0.55 0 Z'],
  },
  rollingPin: {
    domain: 'kitchen',
    outline:
      'M -4.25 -0.55 L -2.5 -0.6 C -2.5 -1.2 -2.5 -1.55 -1.9 -2.2 L 1.9 -2.2 C 2.5 -1.55 2.5 -1.2 2.5 -0.6 L 4.25 -0.55 C 4.55 -0.55 4.8 -0.3 4.8 0 4.8 0.3 4.55 0.55 4.25 0.55 L 2.5 0.6 C 2.5 1.2 2.5 1.55 1.9 2.2 L -1.9 2.2 C -2.5 1.55 -2.5 1.2 -2.5 0.6 L -4.25 0.55 C -4.55 0.55 -4.8 0.3 -4.8 0 -4.8 -0.3 -4.55 -0.55 -4.25 -0.55 Z',
  },
};

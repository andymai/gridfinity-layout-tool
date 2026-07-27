/**
 * SVG silhouettes for the label-plate hardware icons (discussion #2877).
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
 * every check except enclosed area. Cutting holes explicitly is deterministic
 * and matches the drawCircle/drawingCut construction these icons were ported
 * from.
 *
 * Coordinates are SVG convention (Y down); the importer flips to brepjs' Y-up.
 * The frame is arbitrary — `fitIcon` scales each silhouette from its own
 * bounding box, so a ±5 box and a 24×24 viewBox render identically.
 */

import type { LabelPlateIconId } from './labelPlates';

export interface LabelIconDef {
  /** Outer boundary — a single closed subpath. */
  readonly outline: string;
  /** Fully-interior closed subpaths cut from the outline. */
  readonly holes?: readonly string[];
}

/** Hexagon circumradius 5, pointy-top — matches the former `drawPolysides(5, 6)`. */
const HEX_HALF_WIDTH = 4.330127018922193;

/** Closed circle of radius `r` centered on the origin, as two 180° arcs. */
const circle = (r: number): string =>
  `M 0 -${r} A ${r} ${r} 0 0 1 0 ${r} A ${r} ${r} 0 0 1 0 -${r} Z`;

export const LABEL_ICON_PATHS: Readonly<Record<LabelPlateIconId, LabelIconDef>> = {
  bolt: {
    outline:
      'M -5 3.4 L -2.8 3.4 L -2.8 1.5 L 4.2 1.5 L 5 0.9 L 5 -0.9 L 4.2 -1.5 L -2.8 -1.5 L -2.8 -3.4 L -5 -3.4 Z',
  },
  screw: {
    outline: 'M -5 3.2 L -3.6 1.4 L 3.4 1.4 L 5 0 L 3.4 -1.4 L -3.6 -1.4 L -5 -3.2 Z',
  },
  woodScrew: {
    outline:
      'M -5 2.6 L -3.4 2.6 L -3.4 1.3 L 1 1.3 L 5 0 L 1 -1.3 L -3.4 -1.3 L -3.4 -2.6 L -5 -2.6 Z',
  },
  nut: {
    outline: `M 0 -5 L ${HEX_HALF_WIDTH} -2.5 L ${HEX_HALF_WIDTH} 2.5 L 0 5 L -${HEX_HALF_WIDTH} 2.5 L -${HEX_HALF_WIDTH} -2.5 Z`,
    holes: [circle(2.4)],
  },
  washer: {
    outline: circle(5),
    holes: [circle(2.6)],
  },
  nail: {
    outline: 'M -5 3 L -4.3 3 L -4.3 0.8 L 4 0.8 L 5 0 L 4 -0.8 L -4.3 -0.8 L -4.3 -3 L -5 -3 Z',
  },
};

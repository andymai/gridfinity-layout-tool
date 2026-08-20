/**
 * The interior panel's cards are not the same set as {@link BinStyle}.
 *
 * Bento and Grid Dividers are two ways of authoring ONE style: compartment
 * walls. Grid Dividers keeps every wall on a cell boundary; Bento moves them
 * off it via `compartments.dividerOverrides`. They generate identical geometry,
 * so bento is deliberately NOT a `BinStyle` member — a style the generator
 * cannot act on would be a distinction that rots, and it would have to clear
 * the server's `VALID_BIN_STYLES` before any design saved with it could sync.
 */

import type { BinStyle } from './base';
import type { CompartmentConfig } from './compartments';

/** Interior authoring surfaces offered in the panel — single source of truth. */
export const INTERIOR_CARDS = ['standard', 'bento', 'slotted', 'solid'] as const;

export type InteriorCard = (typeof INTERIOR_CARDS)[number];

export function cardToStyle(card: InteriorCard): BinStyle {
  return card === 'bento' ? 'standard' : card;
}

/** True when any wall has been moved or tilted off its grid boundary. */
export function hasMovedWalls(compartments: CompartmentConfig): boolean {
  return (compartments.dividerOverrides?.length ?? 0) > 0;
}

/**
 * Which card a freshly-loaded design should open on.
 *
 * Only ever used to SEED the panel's selection, never to drive it continuously:
 * `remapDividerOverrides` drops every override when a cell mutation renumbers
 * compartment IDs, so a bento whose walls were reset by a merge would otherwise
 * flip its own card back to Grid Dividers mid-edit.
 */
export function deriveInteriorCard(style: BinStyle, compartments: CompartmentConfig): InteriorCard {
  if (style !== 'standard') return style;
  return hasMovedWalls(compartments) ? 'bento' : 'standard';
}

/**
 * The card the panel actually shows as selected: the design's own style, with
 * the stored preference consulted ONLY where the style cannot answer.
 *
 * `ui.interiorCard` has to be sticky (see above) but it is not free-floating —
 * stickiness is owed entirely to the Bento/Grid Dividers ambiguity, where two
 * cards share `style: 'standard'`. Slotted and Solid each ARE a style, so
 * reading the preference for them lets the panel claim a mode the params are
 * not in: `loadDesign` normalizes the field, but undo and reset-to-defaults
 * restore params without it, and the constraint engine can refuse a style
 * change after the card has already been recorded. Every one of those left the
 * Cutout editor open over a `standard` bin — a hollow body with no fill for a
 * pocket to sink into, whose cutouts the generator never builds, because they
 * are gated on `base.solid`.
 *
 * Resolving here rather than patching each write path means a path added later
 * cannot reintroduce the desync.
 */
export function resolveInteriorCard(style: BinStyle, preferred: InteriorCard): InteriorCard {
  if (style !== 'standard') return style;
  return preferred === 'bento' ? 'bento' : 'standard';
}

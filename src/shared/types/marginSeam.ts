import type { BaseplateConnectorStyle, ResolvedBaseplateParams } from './bin';

/**
 * Whether the margin-seam connector engages for a given connector
 * style. Scoped to the integral tongue/groove families — dovetail and puzzle —
 * because snapClip/dovetailKey would need a separate printed part the seam must
 * not emit. `undefined` is the stored default for dovetail (the ConnectorPicker
 * persists dovetail as absent), so it counts as a tongue/groove style.
 */
export function isSeamConnectorStyle(style: BaseplateConnectorStyle | undefined): boolean {
  return style === undefined || style === 'dovetail' || style === 'puzzle';
}

/**
 * Whether the margin-seam connector can be built for a given style at
 * all: the integral tongue/groove families, plus `dovetailKey`, which
 * makes both sides of the body↔rail seam female and seats the same separate key
 * the split seams use. `snapClip` stays friction-fit — its top-insert clip has no
 * seated form at a body↔rail seam.
 *
 * `undefined` counts, as in {@link isSeamConnectorStyle}: it's the stored default
 * for dovetail (the ConnectorPicker persists dovetail as absent).
 */
export function isMarginSeamStyle(style: BaseplateConnectorStyle | undefined): boolean {
  return isSeamConnectorStyle(style) || style === 'dovetailKey';
}

/**
 * Whether the detached-margin seam is keyed rather than tongued: both the body
 * wall and the rail get a female groove and a separate key spans them.
 * Shared so the body geometry, the rail geometry, and the key
 * count/placement can't disagree about where those grooves go.
 */
export function hasMarginSeamKeys(params: ResolvedBaseplateParams): boolean {
  return (
    params.detachMargins === true &&
    params.detachMarginConnector === true &&
    params.connectorStyle === 'dovetailKey'
  );
}

/**
 * Whether the integral margin seam swaps sides: the rail grows the tongue and
 * the body wall takes the groove. It reads the split seams' invert toggle under
 * the gate the panel shows that toggle behind on a split plate (split connectors
 * on, pieces not paired), so a flag left over from another mode does not flip
 * the rails.
 */
export function marginSeamInverted(params: ResolvedBaseplateParams): boolean {
  return (
    params.invertDovetails === true &&
    params.connectorNubs === true &&
    params.preferIdenticalPieces !== true &&
    isSeamConnectorStyle(params.connectorStyle)
  );
}

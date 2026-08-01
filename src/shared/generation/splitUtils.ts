/** Evenly-distributed pin positions along a split edge (offsets from edge center, in mm). */
export function computePinPositions(edgeLengthMm: number, spacingMm: number): number[] {
  if (edgeLengthMm <= 0 || spacingMm <= 0) return [];
  const count = Math.max(2, Math.round(edgeLengthMm / spacingMm));
  const step = edgeLengthMm / (count + 1);
  const halfEdge = edgeLengthMm / 2;
  return Array.from({ length: count }, (_, i) => step * (i + 1) - halfEdge);
}

/**
 * Whether this base can host split connectors at all.
 *
 * `splitBinBuilder` forces them off on a lightweight or spacer base: neither
 * has a solid floor for the 45° floor scarf to bite into, so cut planes land
 * over hollow cup recesses and the scarf loft comes out fragmented, weak, or
 * fails outright. A flat base has a real floor and is exempt.
 *
 * Separate from the user's own on/off choice so the builder can apply just this
 * rule to whatever config it was handed, without a stale persisted flag
 * overriding an explicit caller argument.
 */
export function splitConnectorsSuppressedByBase(base: {
  readonly lightweight: boolean;
  readonly spacer: boolean;
  readonly style: string;
}): boolean {
  return (base.lightweight || base.spacer) && base.style !== 'flat';
}

/**
 * Whether a split of this bin actually ships printed alignment connectors —
 * the user asked for them AND the base can host them.
 *
 * Shared so anything that *describes* a split — the layout export manifest,
 * say — can't promise joinery the geometry never built.
 */
export function splitHasConnectors(params: {
  readonly base: {
    readonly lightweight: boolean;
    readonly spacer: boolean;
    readonly style: string;
  };
  readonly splitConnectors?: { readonly enabled: boolean };
}): boolean {
  if (params.splitConnectors?.enabled === false) return false;
  return !splitConnectorsSuppressedByBase(params.base);
}

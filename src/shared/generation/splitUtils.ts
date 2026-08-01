/** Evenly-distributed pin positions along a split edge (offsets from edge center, in mm). */
export function computePinPositions(edgeLengthMm: number, spacingMm: number): number[] {
  if (edgeLengthMm <= 0 || spacingMm <= 0) return [];
  const count = Math.max(2, Math.round(edgeLengthMm / spacingMm));
  const step = edgeLengthMm / (count + 1);
  const halfEdge = edgeLengthMm / 2;
  return Array.from({ length: count }, (_, i) => step * (i + 1) - halfEdge);
}

/**
 * Whether a split of this bin actually gets printed alignment connectors.
 *
 * `splitBinBuilder` forces them off on a lightweight or spacer base: neither
 * has a solid floor for the 45° floor scarf to bite into, so cut planes land
 * over hollow cup recesses and the scarf loft comes out fragmented, weak, or
 * fails outright. A flat base has a real floor and is exempt.
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
  const liteBase = (params.base.lightweight || params.base.spacer) && params.base.style !== 'flat';
  return !liteBase;
}

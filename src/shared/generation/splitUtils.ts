/** Evenly-distributed pin positions along a split edge (offsets from edge center, in mm). */
export function computePinPositions(edgeLengthMm: number, spacingMm: number): number[] {
  if (edgeLengthMm <= 0 || spacingMm <= 0) return [];
  const count = Math.max(2, Math.round(edgeLengthMm / spacingMm));
  const step = edgeLengthMm / (count + 1);
  const halfEdge = edgeLengthMm / 2;
  return Array.from({ length: count }, (_, i) => step * (i + 1) - halfEdge);
}

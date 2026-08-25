/**
 * The surface colour handed to a shape that lies outside the group the editor
 * has been drilled into.
 *
 * Every shape renderer derives its fill and stroke from `binColor` by fixed
 * multipliers below 1 (`CutoutShapeMesh`: 0.7 fill, 0.5 stroke), so a cutout
 * reads as a darker patch on a board of that same colour. Handing those
 * renderers a BRIGHTER colour pushes the products back toward the board and the
 * shape fades, keeping just enough stroke to stay locatable.
 *
 * Doing it through the existing colour input rather than a new `dimmed` prop is
 * deliberate: the four shape renderers use three different material systems
 * (SDF shader, triangulated mesh, stencil passes), and an opacity flag would
 * have to be honoured correctly in each. This needs no material change at all,
 * so a shape kind added later cannot forget to dim.
 */

/**
 * How far to push the colour up. Chosen so the 0.7 fill multiplier lands just
 * under the board colour (0.7 × 1.35 ≈ 0.95) while the 0.5 stroke stays
 * visibly darker than the board (≈ 0.68).
 */
const DIM_GAIN = 1.35;

/** `#rrggbb` brightened toward white by {@link DIM_GAIN}, clamped per channel. */
export function dimmedBinColor(binColor: string): string {
  const hex = binColor.trim().replace(/^#/, '');
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map((c) => c + c)
          .join('')
      : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return binColor;

  const channel = (offset: number): string => {
    const value = Number.parseInt(full.slice(offset, offset + 2), 16);
    return Math.min(255, Math.round(value * DIM_GAIN))
      .toString(16)
      .padStart(2, '0');
  };
  return `#${channel(0)}${channel(2)}${channel(4)}`;
}

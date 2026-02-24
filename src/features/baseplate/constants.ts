/** Maximum baseplate grid dimension in units */
export const MAX_BASEPLATE_DIMENSION = 16;

/** Gap in mm between pieces in exploded split preview */
export const EXPLODE_GAP_MM = 10;

/** Muted palette for split pieces. Max 9 pieces (3×3). */
export const PIECE_COLORS = [
  '#7cacf0',
  '#f0a07c',
  '#7cdba6',
  '#d49cf0',
  '#f0d77c',
  '#7ce0d6',
  '#f07ca0',
  '#a0b8f0',
  '#c4d97c',
] as const;

export function getPieceColor(index: number): string {
  return PIECE_COLORS[index % PIECE_COLORS.length];
}

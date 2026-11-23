/**
 * Pure helpers for the FootprintGrid shader. Kept out of the component file so
 * the react-refresh boundary stays "components only".
 */

/**
 * A grid pitch must be a positive, finite number of mm — it feeds a shader
 * divisor (`alignedPos / gridSize`), so a zero/negative/NaN value produces
 * divide-by-zero artifacts that corrupt or blank the preview. Fall back to a
 * sane positive pitch rather than trusting whatever reaches the leaf component.
 */
export const positivePitch = (value: number | undefined, fallback: number): number =>
  value !== undefined && Number.isFinite(value) && value > 0 ? value : fallback;

/**
 * Solid-filled schematic icons for the connector-style picker, drawn from the
 * real connector geometry in `@/shared/constants/connectors`:
 *
 * - None: two plates with a clean seam (no joiner).
 * - Dovetail: a wide-tipped trapezoidal tongue mating into its groove
 *   (TONGUE_BASE_HALF 1.0 → TONGUE_TIP_HALF 1.3), drawn slightly apart.
 * - Puzzle: a jigsaw tab (narrow neck flaring to a wider rounded head) mating into
 *   its groove — the stronger locking variant (PUZZLE_NECK_HALF → PUZZLE_HEAD_HALF).
 * - Dovetail key: the standalone double-dovetail key, a horizontal bowtie.
 * - Snap clip: the X-Z cross-section — two legs joined by a flush top bridge with
 *   a central flex slot, each leg carrying an outward barb near its tip.
 *
 * Design notes (kept as a cohesive family):
 * - Each shape is centered in the 32×32 viewBox over a y8–24 band and ±12 of
 *   center horizontally, so every icon carries the same optical weight.
 * - All shapes share one fill + round-joined hairline stroke (`solid`) so corners
 *   read as crafted radii rather than hard polygon vertices, and the set looks
 *   like one pen drew it. `currentColor` lets them inherit the card text color.
 */

const svgProps = {
  width: 20,
  height: 20,
  viewBox: '0 0 32 32',
  fill: 'none',
  'aria-hidden': true,
} as const;

/** Shared fill + soft rounded outline for every connector shape. */
const solid = {
  fill: 'currentColor',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinejoin: 'round',
  strokeLinecap: 'round',
} as const;

/** No connector: two plates with a plain straight seam. */
export function IconConnectorNone() {
  return (
    <svg {...svgProps}>
      <rect x="4" y="8" width="10.5" height="16" rx="2.5" {...solid} />
      <rect x="17.5" y="8" width="10.5" height="16" rx="2.5" {...solid} />
    </svg>
  );
}

/** Dovetail: a wide-tipped tongue on one plate and its matching groove on the
 *  other, drawn slightly apart so the trapezoidal joint reads. */
export function IconConnectorDovetail() {
  return (
    <svg {...svgProps}>
      <path d="M4 8H14V12L16 10V22L14 20V24H4Z" {...solid} />
      <path d="M28 8H18V12L20 10V22L18 20V24H28Z" {...solid} />
    </svg>
  );
}

/** Puzzle: a jigsaw tab (narrow neck → wider rounded head) on one plate and its
 *  matching groove on the other, drawn slightly apart so the locking joint reads. */
export function IconConnectorPuzzle() {
  return (
    <svg {...svgProps}>
      <path d="M4 8H12V13.5H14V10.5H15.5V21.5H14V18.5H12V24H4Z" {...solid} />
      <path d="M28 8H20V13.5H18V10.5H16.5V21.5H18V18.5H20V24H28Z" {...solid} />
    </svg>
  );
}

/** Dovetail key: the standalone double-dovetail key, drawn as a horizontal bowtie. */
export function IconConnectorDovetailKey() {
  return (
    <svg {...svgProps}>
      <path d="M4 8L16 14L28 8V24L16 18L4 24Z" {...solid} />
    </svg>
  );
}

/** Snap clip: side view — two barbed legs joined by a top bridge with a central flex slot. */
export function IconConnectorSnapClip() {
  return (
    <svg {...svgProps}>
      <path d="M6 7H26V17L28 19L26 21V24H20V11H12V24H6V21L4 19L6 17Z" {...solid} />
    </svg>
  );
}

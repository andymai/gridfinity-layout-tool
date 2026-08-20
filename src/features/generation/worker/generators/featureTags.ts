/**
 * Feature tags for face provenance tracking.
 *
 * Each tag identifies the modeling step that created a face.
 * Infrastructure for future multi-color 3MF export.
 */
export const FeatureTag = {
  BASE: 0,
  SCOOP: 1,
  LABEL_TAB: 2,
  SOCKET: 3,
  LIP: 4,
  WALL_CUTOUT: 5,
  DIVIDER: 6,
  SLOT: 7,
  INSERT: 8,
  CUTOUT: 9,
  WALL_PATTERN: 10,
  HANDLE: 11,
  LID_BODY: 12,
  LID_RAIL: 13,
  TEXT: 14,
  /**
   * The lid's own stack grid — its top-face perimeter lip, plus the interior
   * ridges unless `stackLipOnly`. Distinct from {@link LID_BODY} so the lid's
   * top can be coloured separately from its shell, and distinct from
   * {@link LIP}, which is the BIN's top-rim lip on a different object.
   */
  LID_LIP: 15,
  /** The sliding tray's track, fused onto the bin's front and back walls. */
  SLIDE_RAIL: 16,
  /**
   * Faces created by the lid's grip relief — the chamfer, groove, or
   * scallop cut at the lid/bin seam, and the matching dip in the BIN's
   * stacking lip. Tagged so the seam treatment can be highlighted on hover
   * without also lighting up the shell it was cut from.
   */
  LID_GRIP: 17,
  /**
   * Faces left by the lid's interior relief — the ring carved out of
   * the top of the cavity's perimeter so a seated lid's rails run unbroken.
   */
  LID_RELIEF: 18,
  /**
   * The sliding lid's channel on the BIN — both shelves, both retainers, the
   * detent bumps and the entry notch. One tag rather than four: the joint is a
   * single thing to a user hovering it, and a shelf on its own is not a feature
   * anyone reasons about.
   *
   * Distinct from {@link SLIDE_RAIL}, which is the sliding TRAY's track: a
   * different part, on different walls, at a different height.
   */
  SLIDE_LID_CHANNEL: 19,
  /**
   * The hinge barrel — the bin's knuckles and the pockets the lid's turn in.
   *
   * One tag for both, because they are one feature: the pockets are only there
   * to receive the other part's knuckles, and a hover that highlighted the
   * material without the void would be describing half a joint.
   */
  LID_HINGE: 20,
  UNKNOWN: 255,
} as const;

export type FeatureTag = (typeof FeatureTag)[keyof typeof FeatureTag];

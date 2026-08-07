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
  UNKNOWN: 255,
} as const;

export type FeatureTag = (typeof FeatureTag)[keyof typeof FeatureTag];

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
  UNKNOWN: 255,
} as const;

export type FeatureTag = (typeof FeatureTag)[keyof typeof FeatureTag];

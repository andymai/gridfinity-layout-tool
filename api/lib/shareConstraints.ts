/** Limits a shared layout must satisfy, and the error shape validators return when it does not. */

export const SHARE_CONSTRAINTS = {
  MAX_SIZE_BYTES: 500 * 1024, // 500KB
  MAX_BINS: 2500,
  GRID_MIN: 1,
  GRID_MAX: 50,
  LAYERS_MIN: 1,
  LAYERS_MAX: 10,
  CATEGORIES_MAX: 20,
  NAME_MAX_LENGTH: 64,
  LABEL_MAX_LENGTH: 24,
  NOTES_MAX_LENGTH: 256,
  // Mirrors client `CONSTRAINTS.MIN_BIN_HEIGHT` / `MIN_LAYER_HEIGHT` (2).
  // Server <-> client divergence would let a peer persist height=1 that the
  // recipient's CQRS schema rejects on the next mutation.
  HEIGHT_MIN: 2,
  // Mirrors client `GRID_PITCH_MM_MAX / 2` (drawerOutline.ts) — half the
  // largest settable grid pitch, i.e. the largest legal grid shift within a
  // custom perimeter. NOT `GRID_UNIT_MM_MAX / 2`: the pitch ceiling is 200mm.
  GRID_SHIFT_MM_MAX: 100,
  VALID_EXPIRATIONS: [30, 60, 90, 365] as const,
  // Custom properties constraints
  CUSTOM_PROPERTY_MAX_COUNT: 50,
  CUSTOM_PROPERTY_KEY_MAX_LENGTH: 32,
  CUSTOM_PROPERTY_VALUE_MAX_LENGTH: 256,
  CUSTOM_PROPERTY_MAX_TOTAL_SIZE: 20480, // 20KB total per bin
};

export type ValidExpiration = (typeof SHARE_CONSTRAINTS.VALID_EXPIRATIONS)[number];

export interface ValidationError {
  code: 'VALIDATION_ERROR' | 'SIZE_LIMIT' | 'BIN_LIMIT' | 'INVALID_EXPIRATION';
  message: string;
}

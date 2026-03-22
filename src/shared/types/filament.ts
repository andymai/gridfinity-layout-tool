/**
 * Filament palette types for multi-color export.
 *
 * Defined in shared/ so both core/store (settings) and features/bin-designer
 * can import without violating the dependency direction.
 */

/** Identifier for a filament slot in the user's palette (up to 4 slots) */
export type FilamentSlotId = 'slot1' | 'slot2' | 'slot3' | 'slot4';

/** A single filament slot with user-defined name and color */
export interface FilamentSlot {
  readonly id: FilamentSlotId;
  readonly name: string;
  readonly color: string; // hex, e.g. '#d4d8dc'
}

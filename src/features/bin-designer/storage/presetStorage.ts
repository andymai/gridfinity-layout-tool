/**
 * Storage for user-created design presets.
 *
 * Uses localStorage since presets are small JSON objects.
 * Key: 'gridfinity-designer-presets'
 */

import type { BinParams } from '@/features/bin-designer/types';

const STORAGE_KEY = 'gridfinity-designer-presets';

/** A user-created preset (stored in localStorage) */
export interface UserPreset {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly overrides: Partial<BinParams>;
  readonly createdAt: number;
}

/**
 * Create a unique identifier for a user preset.
 *
 * @returns A string identifier for the preset that includes a timestamp and a short random segment.
 */
function generatePresetId(): string {
  return `preset-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Retrieve the list of user-created design presets from localStorage.
 *
 * Returns an empty array if no presets are stored or if the stored data is missing or invalid.
 *
 * @returns An array of `UserPreset` objects; empty if none are available or on parse/storage errors.
 */
export function loadUserPresets(): UserPreset[] {
  try {
    const json = localStorage.getItem(STORAGE_KEY);
    if (!json) return [];
    return JSON.parse(json) as UserPreset[];
  } catch {
    return [];
  }
}

/**
 * Persist an array of user presets to browser storage, replacing any previously stored presets.
 *
 * @param presets - The list of UserPreset objects to save
 */
function saveUserPresets(presets: UserPreset[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch {
    // Quota exceeded or localStorage unavailable — silently fail
  }
}

/**
 * Create a user preset from the provided bin parameters and persist it with a generated id and timestamp.
 *
 * The saved preset contains a trimmed name and description, a timestamp, and a selective `overrides` object
 * copied from `params` (only `style`, `base`, `dividers`, `scoop`, `label`, and `walls`).
 *
 * @param name - Preset display name
 * @param description - Preset description or notes
 * @param params - Current `BinParams` used to derive the preset's portable `overrides` (only `style`, `base`, `dividers`, `scoop`, `label`, and `walls` are stored)
 * @returns The newly created `UserPreset`
 */
export function createUserPreset(
  name: string,
  description: string,
  params: BinParams
): UserPreset | null {
  const existing = loadUserPresets();
  if (existing.length >= MAX_USER_PRESETS) {
    return null;
  }

  const preset: UserPreset = {
    id: generatePresetId(),
    name: name.trim(),
    description: description.trim(),
    overrides: {
      // Save style-related params (not dimensions/inserts since those are layout-specific)
      style: params.style,
      base: { ...params.base },
      dividers: { ...params.dividers },
      scoop: params.scoop,
      label: { ...params.label },
      walls: { ...params.walls },
    },
    createdAt: Date.now(),
  };

  saveUserPresets([...existing, preset]);
  return preset;
}

/**
 * Remove the user preset with the given identifier from persistent storage.
 *
 * If no preset has the provided `id`, the stored presets remain unchanged.
 *
 * @param id - The identifier of the preset to remove
 */
export function deleteUserPreset(id: string): void {
  const existing = loadUserPresets();
  saveUserPresets(existing.filter((p) => p.id !== id));
}

/** Maximum number of user presets allowed */
export const MAX_USER_PRESETS = 20;
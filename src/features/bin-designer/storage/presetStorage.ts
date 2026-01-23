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

/** Generate a unique ID for new presets */
function generatePresetId(): string {
  return `preset-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Load all user presets from localStorage */
export function loadUserPresets(): UserPreset[] {
  try {
    const json = localStorage.getItem(STORAGE_KEY);
    if (!json) return [];
    return JSON.parse(json) as UserPreset[];
  } catch {
    return [];
  }
}

/** Save the full preset list to localStorage */
function saveUserPresets(presets: UserPreset[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}

/** Create a new user preset from the current bin params */
export function createUserPreset(
  name: string,
  description: string,
  params: BinParams
): UserPreset {
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

  const existing = loadUserPresets();
  saveUserPresets([...existing, preset]);
  return preset;
}

/** Delete a user preset by ID */
export function deleteUserPreset(id: string): void {
  const existing = loadUserPresets();
  saveUserPresets(existing.filter((p) => p.id !== id));
}

/** Maximum number of user presets allowed */
export const MAX_USER_PRESETS = 20;

/**
 * Tag appearance store — per-tag icon/color customization for design tags.
 *
 * Keyed by lowercased tag so appearance follows the tag's case-insensitive
 * identity (the same identity `normalizeTags` dedupes on). Appearance is
 * cosmetic, device-local state: it rides outside the design envelope and does
 * not cloud-sync. Entries deliberately survive the last design carrying a tag
 * being deleted — re-creating the tag later restores its look.
 */

import { create } from 'zustand';
import type { Result, StorageError } from '@/core/result';
import { isOk } from '@/core/result';
import { saveToLocalStorage, loadFromLocalStorage } from '@/core/storage/backends/localStorage';

export const TAG_APPEARANCE_STORAGE_KEY = 'gridfinity-tag-appearance-v1';

/**
 * Preset icons offered by the tag manager, stored as the emoji itself so no
 * icon-id → asset mapping can go stale.
 */
export const TAG_ICONS = [
  '🔧',
  '🔩',
  '🪛',
  '🧰',
  '⚙️',
  '🪚',
  '📏',
  '✂️',
  '📎',
  '✏️',
  '🎨',
  '🧵',
  '🔌',
  '🔋',
  '💡',
  '🎲',
  '🧩',
  '🍴',
  '☕',
  '💊',
  '🔑',
  '📦',
  '🏷️',
  '⭐',
] as const;

export interface TagAppearance {
  /** Chip tint / swatch color (6-digit hex from the shared palette). */
  readonly color?: string;
  /** Chip icon (emoji). */
  readonly icon?: string;
}

/** Canonical map key for a tag (case-insensitive identity). */
export function tagAppearanceKey(tag: string): string {
  return tag.trim().toLowerCase();
}

/**
 * Translucent background tint for a colored chip. Only 6-digit hex colors get
 * an alpha suffix; anything else passes through untouched. The alpha (~27%) is
 * tuned so the tint stays legible on a dark surface without competing with the
 * chip text.
 */
export function tagTint(color: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? `${color}45` : color;
}

/** Validate one stored entry; null drops malformed or empty records. */
function parseAppearance(raw: unknown): TagAppearance | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { color, icon } = raw as Record<string, unknown>;
  const out: { color?: string; icon?: string } = {};
  if (typeof color === 'string' && color !== '') out.color = color;
  if (typeof icon === 'string' && icon !== '') out.icon = icon;
  return out.color !== undefined || out.icon !== undefined ? out : null;
}

function loadAppearances(): Record<string, TagAppearance> {
  const result = loadFromLocalStorage<unknown>(TAG_APPEARANCE_STORAGE_KEY);
  if (!isOk(result) || typeof result.value !== 'object' || result.value === null) return {};
  const out: Record<string, TagAppearance> = {};
  for (const [key, raw] of Object.entries(result.value)) {
    const appearance = parseAppearance(raw);
    if (appearance) out[tagAppearanceKey(key)] = appearance;
  }
  return out;
}

/** Fields patched by `setTagAppearance`: `null` clears a field, `undefined` leaves it. */
export interface TagAppearancePatch {
  readonly color?: string | null;
  readonly icon?: string | null;
}

/**
 * Lowercased tag → appearance. Values are typed `| undefined` so lookups of
 * unknown tags are honest about missing entries (the repo compiles without
 * `noUncheckedIndexedAccess`).
 */
type TagAppearanceMap = Record<string, TagAppearance | undefined>;

function omitKey(map: TagAppearanceMap, key: string): TagAppearanceMap {
  return Object.fromEntries(Object.entries(map).filter(([k]) => k !== key));
}

interface TagAppearanceState {
  /** Stored entries always carry at least one field. */
  appearances: TagAppearanceMap;

  /**
   * Merge a patch into a tag's appearance. State always updates in memory;
   * Err means the change won't survive reload.
   */
  setTagAppearance: (tag: string, patch: TagAppearancePatch) => Result<void, StorageError>;
  /** Remove a tag's appearance entirely. */
  clearTagAppearance: (tag: string) => Result<void, StorageError>;
}

export const useTagAppearanceStore = create<TagAppearanceState>()((set, get) => ({
  appearances: loadAppearances(),

  setTagAppearance: (tag, patch) => {
    const key = tagAppearanceKey(tag);
    const current = get().appearances[key];
    const color = patch.color === undefined ? current?.color : (patch.color ?? undefined);
    const icon = patch.icon === undefined ? current?.icon : (patch.icon ?? undefined);

    const appearances =
      color !== undefined || icon !== undefined
        ? {
            ...get().appearances,
            [key]: {
              ...(color !== undefined ? { color } : {}),
              ...(icon !== undefined ? { icon } : {}),
            },
          }
        : omitKey(get().appearances, key);
    set({ appearances });
    return saveToLocalStorage(TAG_APPEARANCE_STORAGE_KEY, appearances);
  },

  clearTagAppearance: (tag) => {
    const appearances = omitKey(get().appearances, tagAppearanceKey(tag));
    set({ appearances });
    return saveToLocalStorage(TAG_APPEARANCE_STORAGE_KEY, appearances);
  },
}));

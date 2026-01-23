/**
 * Preset selector for quickly applying common bin configurations.
 *
 * Shows built-in presets and user-created presets in a grid.
 * Users can save the current configuration as a new preset
 * and delete their custom presets.
 */

import { useState, useCallback, type JSX } from 'react';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { BUILT_IN_PRESETS, type DesignPreset } from '@/features/bin-designer/constants/presets';
import {
  loadUserPresets,
  createUserPreset,
  deleteUserPreset,
  MAX_USER_PRESETS,
  type UserPreset,
} from '@/features/bin-designer/storage/presetStorage';
import type { BinParams } from '@/features/bin-designer/types';

/** Icon components for each preset type */
const PRESET_ICONS: Record<DesignPreset['icon'], JSX.Element> = {
  heavy: (
    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true">
      <rect x="3" y="6" width="10" height="7" strokeWidth="1.5" rx="1" />
      <circle cx="5.5" cy="13" r="1" fill="currentColor" stroke="none" />
      <circle cx="10.5" cy="13" r="1" fill="currentColor" stroke="none" />
      <path d="M5 6V4a3 3 0 016 0v2" strokeWidth="1.5" />
    </svg>
  ),
  fast: (
    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true">
      <path d="M9 2L5 9h4l-2 5 6-7H9l2-5z" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  ),
  workshop: (
    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true">
      <path d="M3 4h10v9H3z" strokeWidth="1.5" />
      <path d="M6 4V2M10 4V2" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M3 8h10" strokeWidth="1" opacity="0.5" />
    </svg>
  ),
  vase: (
    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true">
      <path d="M6 14c-1-2-2-4-1-7 .5-1.5 1-2 2-3h2c1 1 1.5 1.5 2 3 1 3 0 5-1 7H6z" strokeWidth="1.5" />
    </svg>
  ),
  divider: (
    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true">
      <rect x="3" y="4" width="10" height="8" strokeWidth="1.5" />
      <path d="M8 4v8M3 8h10" strokeWidth="1" />
    </svg>
  ),
};

/** User preset icon (bookmark) */
const USER_PRESET_ICON = (
  <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true">
    <path d="M4 2h8v12l-4-3-4 3V2z" strokeWidth="1.5" />
  </svg>
);

/**
 * Renders a preset selector UI that lets the user apply built-in presets, manage user-created presets, and save the current settings as a new preset.
 *
 * Applying a preset updates the shared designer parameters. Saving or deleting a user preset persists the change to storage and refreshes the in-memory list. The component also provides a save form for entering a preset name and optional description and enforces the maximum user preset count.
 *
 * @returns The component's JSX element.
 */
export function PresetSelector() {
  const setParams = useDesignerStore((s) => s.setParams);
  const params = useDesignerStore((s) => s.params);

  const [userPresets, setUserPresets] = useState<UserPreset[]>(() => loadUserPresets());
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [presetDescription, setPresetDescription] = useState('');

  const refreshPresets = useCallback(() => {
    setUserPresets(loadUserPresets());
  }, []);

  const handleApplyBuiltIn = (preset: DesignPreset) => {
    setParams(preset.overrides);
  };

  const handleApplyUser = (preset: UserPreset) => {
    setParams(preset.overrides as Partial<BinParams>);
  };

  const handleSave = () => {
    const trimmedName = presetName.trim();
    if (!trimmedName) return;

    const result = createUserPreset(trimmedName, presetDescription, params);
    if (!result) return; // Limit reached
    refreshPresets();
    setShowSaveForm(false);
    setPresetName('');
    setPresetDescription('');
  };

  const handleDelete = (id: string) => {
    deleteUserPreset(id);
    refreshPresets();
  };

  const canSave = userPresets.length < MAX_USER_PRESETS;

  return (
    <div className="space-y-3">
      {/* Built-in presets */}
      <div
        className="grid grid-cols-2 gap-1.5"
        role="list"
        aria-label="Design presets"
      >
        {BUILT_IN_PRESETS.map((preset) => (
          <button
            key={preset.id}
            role="listitem"
            onClick={() => handleApplyBuiltIn(preset)}
            className="flex items-center gap-2 rounded-md border border-stroke-subtle bg-surface-secondary px-2.5 py-2 text-left transition-colors hover:border-accent/50 hover:bg-surface-hover"
            title={preset.description}
            aria-label={`Apply ${preset.name} preset`}
          >
            <span className="shrink-0 text-content-secondary">
              {PRESET_ICONS[preset.icon]}
            </span>
            <div className="min-w-0">
              <span className="block truncate text-xs font-medium text-content">
                {preset.name}
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* User presets */}
      {userPresets.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[10px] font-medium uppercase tracking-wider text-content-tertiary">
            My Presets
          </span>
          <div
            className="grid grid-cols-2 gap-1.5"
            role="list"
            aria-label="User presets"
          >
            {userPresets.map((preset) => (
              <div key={preset.id} className="group relative" role="listitem">
                <button
                  onClick={() => handleApplyUser(preset)}
                  className="flex w-full items-center gap-2 rounded-md border border-stroke-subtle bg-surface-secondary px-2.5 py-2 text-left transition-colors hover:border-accent/50 hover:bg-surface-hover"
                  title={preset.description || preset.name}
                  aria-label={`Apply ${preset.name} preset`}
                >
                  <span className="shrink-0 text-content-secondary">
                    {USER_PRESET_ICON}
                  </span>
                  <div className="min-w-0">
                    <span className="block truncate text-xs font-medium text-content">
                      {preset.name}
                    </span>
                  </div>
                </button>
                <button
                  onClick={() => handleDelete(preset.id)}
                  className="absolute -right-1 -top-1 h-4 w-4 items-center justify-center rounded-full bg-surface-error text-[10px] text-content-on-error opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100 flex"
                  aria-label={`Delete ${preset.name} preset`}
                  title="Delete preset"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Save as preset */}
      {showSaveForm ? (
        <div className="space-y-2 rounded-md border border-stroke-subtle bg-surface-secondary p-2.5">
          <input
            type="text"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            placeholder="Preset name"
            className="w-full rounded border border-stroke-subtle bg-surface px-2 py-1 text-xs text-content placeholder:text-content-tertiary focus:border-accent focus:outline-none"
            aria-label="Preset name"
            maxLength={32}
            autoFocus
          />
          <input
            type="text"
            value={presetDescription}
            onChange={(e) => setPresetDescription(e.target.value)}
            placeholder="Description (optional)"
            className="w-full rounded border border-stroke-subtle bg-surface px-2 py-1 text-xs text-content placeholder:text-content-tertiary focus:border-accent focus:outline-none"
            aria-label="Preset description"
            maxLength={100}
          />
          <div className="flex gap-1.5">
            <button
              onClick={handleSave}
              disabled={!presetName.trim()}
              className="rounded bg-accent px-2 py-1 text-[10px] font-medium text-content-on-accent transition-colors hover:bg-accent-hover disabled:opacity-50"
            >
              Save
            </button>
            <button
              onClick={() => {
                setShowSaveForm(false);
                setPresetName('');
                setPresetDescription('');
              }}
              className="rounded px-2 py-1 text-[10px] text-content-secondary hover:text-content"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        canSave && (
          <button
            onClick={() => setShowSaveForm(true)}
            className="flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-stroke-subtle px-2 py-1.5 text-[11px] text-content-secondary transition-colors hover:border-accent/50 hover:text-content"
            aria-label="Save current settings as preset"
          >
            <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" aria-hidden="true">
              <path d="M6 2v8M2 6h8" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Save as Preset
          </button>
        )
      )}

      <p className="text-[10px] text-content-tertiary">
        Presets adjust style and features. Dimensions and inserts stay unchanged.
      </p>
    </div>
  );
}
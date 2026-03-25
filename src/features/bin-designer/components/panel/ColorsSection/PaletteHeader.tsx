/**
 * Palette header: row of 4 filament swatch buttons.
 *
 * Clicking a swatch opens a FilamentSlotEditor popover anchored to it.
 * Displays the global filament palette from settings store.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { useSettingsStore } from '@/core/store';
import { Popover } from '@/design-system/Popover/Popover';
import { useTranslation } from '@/i18n';
import { FilamentSlotEditor } from './FilamentSlotEditor';
import type { FilamentSlotId } from '@/features/bin-designer/types/featureColors';

export function PaletteHeader() {
  const t = useTranslation();
  const palette = useSettingsStore((s) => s.settings.filamentPalette);
  const [editingSlotId, setEditingSlotId] = useState<FilamentSlotId | null>(null);
  const buttonElements = useRef(new Map());

  const handleClose = useCallback(() => setEditingSlotId(null), []);

  const editingSlot = editingSlotId ? palette.find((s) => s.id === editingSlotId) : null;

  // Stable ref for the Popover anchor — updated in effect, not during render
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    anchorRef.current = editingSlotId ? (buttonElements.current.get(editingSlotId) ?? null) : null;
  }, [editingSlotId]);

  return (
    <div>
      <p className="text-[10px] font-medium text-content-tertiary mb-2">
        {t('binDesigner.colors.palette')}
      </p>
      <div className="flex items-center gap-2">
        {palette.map((slot) => (
          <button
            key={slot.id}
            ref={(el) => {
              if (el) buttonElements.current.set(slot.id, el);
            }}
            type="button"
            onClick={() => setEditingSlotId(editingSlotId === slot.id ? null : slot.id)}
            className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] transition-colors hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none ${
              editingSlotId === slot.id ? 'bg-surface-hover ring-1 ring-accent' : ''
            }`}
            aria-label={t('binDesigner.colors.editSlot', { name: slot.name })}
            aria-expanded={editingSlotId === slot.id}
          >
            <span
              className="w-4 h-4 rounded-full border border-stroke-subtle/50 shrink-0"
              style={{ backgroundColor: slot.color }}
            />
            <span className="text-content-secondary truncate max-w-[48px]">{slot.name}</span>
          </button>
        ))}
      </div>

      {editingSlot && (
        <Popover anchorRef={anchorRef} isOpen onClose={handleClose} placement="bottom-start">
          <FilamentSlotEditor slot={editingSlot} />
        </Popover>
      )}
    </div>
  );
}

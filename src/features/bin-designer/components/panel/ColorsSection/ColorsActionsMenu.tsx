/**
 * Overflow menu next to the Colors section header. Houses bulk actions
 * (Match all to body) and the palette CRUD surface (save current,
 * apply saved, delete saved).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Popover } from '@/design-system/Popover/Popover';
import {
  CheckIcon,
  MoreHorizontalIcon,
  PlusIcon,
  RotateCcwIcon,
  TrashIcon,
  XIcon,
} from '@/design-system/Icon';
import { Input } from '@/design-system/Input/Input';
import { useSettingsStore, useToastStore } from '@/core/store';
import { COLOR_PALETTE_CONSTRAINTS } from '@/core/store/settings.types';
import type { SavedColorPalette } from '@/core/store/settings.types';
import { useTranslation } from '@/i18n';
import type { FeatureColorConfig } from '@/features/bin-designer/types/featureColors';

interface ColorsActionsMenuProps {
  featureColors: FeatureColorConfig;
  onMatchAllToBody: () => void;
  onApplyPalette: (palette: SavedColorPalette) => void;
}

function uuid(): string {
  return globalThis.crypto.randomUUID();
}

export function ColorsActionsMenu({
  featureColors,
  onMatchAllToBody,
  onApplyPalette,
}: ColorsActionsMenuProps) {
  const t = useTranslation();
  const [open, setOpen] = useState(false);
  const [saveMode, setSaveMode] = useState(false);
  const [draftName, setDraftName] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { palettes, updateSettings } = useSettingsStore(
    useShallow((s) => ({
      palettes: s.settings.savedColorPalettes,
      updateSettings: s.updateSettings,
    }))
  );
  const addToast = useToastStore((s) => s.addToast);

  useEffect(() => {
    if (saveMode) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [saveMode]);

  const closeMenu = useCallback(() => {
    setOpen(false);
    setSaveMode(false);
    setDraftName('');
  }, []);

  const commitSave = useCallback(() => {
    const name = draftName.trim().slice(0, COLOR_PALETTE_CONSTRAINTS.NAME_MAX_LENGTH);
    if (!name) return;

    const palette: SavedColorPalette = {
      id: uuid(),
      name,
      createdAt: new Date().toISOString(),
      colors: {
        body: featureColors.body,
        lip: {
          frontLeft: featureColors.lip.frontLeft,
          frontRight: featureColors.lip.frontRight,
          backRight: featureColors.lip.backRight,
          backLeft: featureColors.lip.backLeft,
        },
        labelTab: featureColors.labelTab,
        base: featureColors.base,
        scoop: featureColors.scoop,
        dividers: featureColors.dividers,
      },
    };

    const next = [...palettes, palette].slice(-COLOR_PALETTE_CONSTRAINTS.MAX_PALETTES);
    updateSettings({ savedColorPalettes: next });
    addToast({
      message: t('binDesigner.colors.savePalette.toast', { name }),
      type: 'success',
      duration: 2500,
    });
    closeMenu();
  }, [draftName, featureColors, palettes, updateSettings, addToast, t, closeMenu]);

  const handleDelete = useCallback(
    (id: string) => {
      updateSettings({ savedColorPalettes: palettes.filter((p) => p.id !== id) });
    },
    [palettes, updateSettings]
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-6 w-6 items-center justify-center rounded text-content-tertiary hover:bg-surface-hover hover:text-content-secondary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
        aria-label={t('binDesigner.colors.actions')}
        aria-haspopup="menu"
        aria-expanded={open}
        title={t('binDesigner.colors.actions')}
      >
        <MoreHorizontalIcon size="sm" />
      </button>

      {open && (
        <Popover anchorRef={triggerRef} isOpen onClose={closeMenu} placement="bottom-end">
          <div role="menu" className="w-56 p-1 text-xs">
            <MenuButton
              icon={<RotateCcwIcon size="sm" />}
              onClick={() => {
                onMatchAllToBody();
                closeMenu();
              }}
            >
              {t('binDesigner.colors.matchAllToBody')}
            </MenuButton>

            <div className="my-1 h-px bg-stroke-subtle/60" role="separator" />

            {saveMode ? (
              <div className="flex items-center gap-1 px-1">
                <Input
                  ref={inputRef}
                  size="sm"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitSave();
                    else if (e.key === 'Escape') setSaveMode(false);
                  }}
                  placeholder={t('binDesigner.colors.savePalette.prompt')}
                  aria-label={t('binDesigner.colors.savePalette.prompt')}
                  maxLength={COLOR_PALETTE_CONSTRAINTS.NAME_MAX_LENGTH}
                />
                <button
                  type="button"
                  onClick={commitSave}
                  disabled={draftName.trim() === ''}
                  className="flex h-7 w-7 items-center justify-center rounded text-accent hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                  aria-label={t('binDesigner.colors.savePalette')}
                  title={t('binDesigner.colors.savePalette')}
                >
                  <CheckIcon size="sm" />
                </button>
                <button
                  type="button"
                  onClick={() => setSaveMode(false)}
                  className="flex h-7 w-7 items-center justify-center rounded text-content-tertiary hover:bg-surface-hover hover:text-content-secondary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                  aria-label={t('binDesigner.colors.firstTimeHint.dismiss')}
                >
                  <XIcon size="sm" />
                </button>
              </div>
            ) : (
              <MenuButton
                icon={<PlusIcon size="sm" />}
                onClick={() => setSaveMode(true)}
                disabled={palettes.length >= COLOR_PALETTE_CONSTRAINTS.MAX_PALETTES}
              >
                {t('binDesigner.colors.savePalette')}
              </MenuButton>
            )}

            <div className="my-1 h-px bg-stroke-subtle/60" role="separator" />

            <p className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-content-tertiary">
              {t('binDesigner.colors.palettes')}
            </p>
            {palettes.length === 0 ? (
              <p className="px-2 py-1 text-[11px] italic text-content-tertiary">
                {t('binDesigner.colors.noPalettes')}
              </p>
            ) : (
              <ul className="max-h-40 overflow-y-auto">
                {palettes.map((palette) => (
                  <li key={palette.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        onApplyPalette(palette);
                        closeMenu();
                      }}
                      className="group flex flex-1 items-center gap-2 rounded px-2 py-1 text-left hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none"
                      role="menuitem"
                      title={t('binDesigner.colors.applyPalette')}
                    >
                      <PaletteSwatch palette={palette} />
                      <span className="flex-1 truncate text-content-secondary group-hover:text-content">
                        {palette.name}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(palette.id)}
                      className="flex h-7 w-7 items-center justify-center rounded text-content-tertiary hover:bg-surface-hover hover:text-error focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                      aria-label={t('binDesigner.colors.deletePalette')}
                      title={t('binDesigner.colors.deletePalette')}
                    >
                      <TrashIcon size="sm" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Popover>
      )}
    </>
  );
}

function MenuButton({
  icon,
  onClick,
  disabled,
  children,
}: {
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      role="menuitem"
      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-content-secondary hover:bg-surface-hover hover:text-content focus-visible:bg-surface-hover focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="text-content-tertiary">{icon}</span>
      <span className="flex-1">{children}</span>
    </button>
  );
}

function PaletteSwatch({ palette }: { palette: SavedColorPalette }) {
  // 5-stripe summary: body / lip-fL / lip-fR / labelTab / base. Compact
  // enough to scan a list, distinctive enough to remember the palette.
  const stripes: string[] = [
    palette.colors.body,
    palette.colors.lip.frontLeft,
    palette.colors.lip.frontRight,
    palette.colors.labelTab,
    palette.colors.base,
  ];
  return (
    <span
      className="flex h-4 w-6 shrink-0 overflow-hidden rounded border border-stroke-subtle/60"
      aria-hidden="true"
    >
      {stripes.map((c, i) => (
        <span key={i} className="flex-1" style={{ backgroundColor: c }} />
      ))}
    </span>
  );
}

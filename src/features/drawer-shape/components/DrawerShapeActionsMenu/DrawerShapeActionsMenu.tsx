/**
 * Overflow menu for the "Custom drawer shape" row. The three authoring routes
 * (corner presets, freehand pen, cell paint) all produce the same outline, so
 * they collapse into one trigger rather than competing for sidebar width.
 *
 * Mirrors ColorsActionsMenu: ghost IconButton + Popover of role="menuitem"
 * buttons.
 */

import { useCallback, useRef, useState, type ReactNode } from 'react';
import { Button, IconButton } from '@/design-system';
import { Popover } from '@/design-system/Popover/Popover';
import { Grid3x3Icon, MoreHorizontalIcon, PencilIcon } from '@/design-system/Icon';
import { useTranslation } from '@/i18n';

interface DrawerShapeActionsMenuProps {
  /** Whether an outline exists — gates the cell-paint editor entry. */
  hasOutline: boolean;
  onOpenCorners: () => void;
  onOpenPen: () => void;
  onOpenEditor: () => void;
}

export function DrawerShapeActionsMenu({
  hasOutline,
  onOpenCorners,
  onOpenPen,
  onOpenEditor,
}: DrawerShapeActionsMenuProps) {
  const t = useTranslation();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const closeMenu = useCallback(() => setOpen(false), []);

  const run = useCallback(
    (action: () => void) => () => {
      closeMenu();
      action();
    },
    [closeMenu]
  );

  const label = t('drawerShape.actions');

  return (
    <>
      <IconButton
        ref={triggerRef}
        variant="ghost"
        size="sm"
        touchTarget={false}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-6 w-6 items-center justify-center rounded text-content-tertiary hover:bg-surface-hover hover:text-content-secondary"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        title={label}
      >
        <MoreHorizontalIcon size="sm" />
      </IconButton>

      {open && (
        <Popover
          anchorRef={triggerRef}
          isOpen
          onClose={closeMenu}
          placement="bottom-start"
          aria-label={label}
        >
          <div role="menu" className="w-48 p-1 text-xs">
            <MenuButton icon={<CornerCutIcon />} onClick={run(onOpenCorners)}>
              {t('drawerShape.corners.open')}
            </MenuButton>
            <MenuButton icon={<PencilIcon size="sm" />} onClick={run(onOpenPen)}>
              {t('drawerShape.penOpen')}
            </MenuButton>
            {hasOutline && (
              <MenuButton icon={<Grid3x3Icon size="sm" />} onClick={run(onOpenEditor)}>
                {t('drawerShape.edit')}
              </MenuButton>
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
  children,
}: {
  icon: ReactNode;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      type="button"
      onClick={onClick}
      role="menuitem"
      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-content-secondary hover:bg-surface-hover hover:text-content focus-visible:bg-surface-hover focus-visible:outline-none"
    >
      <span className="text-content-tertiary">{icon}</span>
      <span className="flex-1 font-normal">{children}</span>
    </Button>
  );
}

function CornerCutIcon() {
  return (
    <svg
      className="w-4 h-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 4h10l6 6v10H4z" />
      <path d="M14 4v6h6" strokeDasharray="2 2" />
    </svg>
  );
}

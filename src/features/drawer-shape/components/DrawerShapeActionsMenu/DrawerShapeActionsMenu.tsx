/**
 * Overflow menu for the "Custom drawer shape" row. The three authoring routes
 * (corner presets, freehand pen, cell paint) all produce the same outline, so
 * they collapse into one trigger rather than competing for sidebar width.
 *
 * Built on `Menu` rather than a bare `Popover` of buttons: the menu/menuitem
 * roles promise arrow-key traversal and focus moving into the list on open,
 * and the primitive is what implements that contract.
 */

import { useCallback, useRef, useState } from 'react';
import { IconButton, Menu } from '@/design-system';
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [menu, setMenu] = useState({ open: false, position: { x: 0, y: 0 } });

  const closeMenu = useCallback(() => setMenu((m) => ({ ...m, open: false })), []);

  const toggleMenu = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    setMenu((m) => ({
      open: !m.open,
      position: { x: rect?.left ?? 0, y: (rect?.bottom ?? 0) + 4 },
    }));
  }, []);

  const label = t('drawerShape.actions');

  return (
    <>
      <IconButton
        ref={triggerRef}
        variant="ghost"
        size="sm"
        touchTarget={false}
        type="button"
        onClick={toggleMenu}
        className="flex h-6 w-6 items-center justify-center rounded text-content-tertiary hover:bg-surface-hover hover:text-content-secondary"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={menu.open}
        title={label}
      >
        <MoreHorizontalIcon size="sm" />
      </IconButton>

      <Menu.Root
        open={menu.open}
        onClose={closeMenu}
        position={menu.position}
        className="min-w-[12rem]"
      >
        <Menu.Item icon={<CornerCutIcon />} onClick={onOpenCorners}>
          {t('drawerShape.corners.open')}
        </Menu.Item>
        <Menu.Item icon={<PencilIcon />} onClick={onOpenPen}>
          {t('drawerShape.penOpen')}
        </Menu.Item>
        {hasOutline && (
          <Menu.Item icon={<Grid3x3Icon />} onClick={onOpenEditor}>
            {t('drawerShape.edit')}
          </Menu.Item>
        )}
      </Menu.Root>
    </>
  );
}

function CornerCutIcon() {
  return (
    <svg
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

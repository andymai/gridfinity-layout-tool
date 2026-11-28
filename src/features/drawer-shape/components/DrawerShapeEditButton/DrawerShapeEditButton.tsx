import { useCallback, useId, useRef, useState } from 'react';
import { Button, Menu } from '@/design-system';
import { ChevronDownIcon, PencilIcon } from '@/design-system/Icon';
import { useTranslation } from '@/i18n';
import { trackDrawerShapeEditorOpened } from '@/shared/analytics/posthog';
import { CornerCutsDialog } from '../CornerCutsDialog/CornerCutsDialog';
import { PenShapeDialog } from '../PenShapeDialog/PenShapeDialog';
import { CornerCutIcon } from '../DrawerShapeActionsMenu/DrawerShapeActionsMenu';

interface DrawerShapeEditButtonProps {
  /** Disables the button and shows this line under it. */
  disabledReason?: string;
}

/**
 * "Edit shape" for a surface outside the Layout tab. It opens the same dialogs
 * as the sidebar menu, so an apply stashes and toasts the same way.
 *
 * The cell editor stays off this menu: its own entry is labelled "Edit shape"
 * too, and an item that repeats its trigger reads as a loop.
 */
export function DrawerShapeEditButton({ disabledReason }: DrawerShapeEditButtonProps = {}) {
  const t = useTranslation();
  const reasonId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [menu, setMenu] = useState({ open: false, position: { x: 0, y: 0 } });
  const [cornersOpen, setCornersOpen] = useState(false);
  const [penOpen, setPenOpen] = useState(false);
  const disabled = disabledReason !== undefined;

  const closeMenu = useCallback(() => setMenu((m) => ({ ...m, open: false })), []);

  const toggleMenu = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    setMenu((m) => ({
      open: !m.open,
      position: { x: rect?.left ?? 0, y: (rect?.bottom ?? 0) + 4 },
    }));
  }, []);

  const openCorners = useCallback(() => {
    trackDrawerShapeEditorOpened('corners');
    setCornersOpen(true);
  }, []);

  const openPen = useCallback(() => {
    trackDrawerShapeEditorOpened('pen');
    setPenOpen(true);
  }, []);

  return (
    <div>
      <Button
        ref={triggerRef}
        variant="secondary"
        fullWidth
        type="button"
        className="h-7 text-xs"
        onClick={toggleMenu}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={menu.open}
        aria-describedby={disabled ? reasonId : undefined}
        rightIcon={<ChevronDownIcon size="sm" />}
      >
        {t('drawerShape.edit')}
      </Button>
      {disabled && (
        <p id={reasonId} className="mt-0.5 text-label text-content-tertiary">
          {disabledReason}
        </p>
      )}

      <Menu.Root
        open={menu.open}
        onClose={closeMenu}
        position={menu.position}
        className="min-w-[12rem]"
      >
        <Menu.Item icon={<CornerCutIcon />} onClick={openCorners}>
          {t('drawerShape.corners.open')}
        </Menu.Item>
        <Menu.Item icon={<PencilIcon />} onClick={openPen}>
          {t('drawerShape.penOpen')}
        </Menu.Item>
      </Menu.Root>

      <CornerCutsDialog open={cornersOpen} onClose={() => setCornersOpen(false)} />
      <PenShapeDialog open={penOpen} onClose={() => setPenOpen(false)} />
    </div>
  );
}

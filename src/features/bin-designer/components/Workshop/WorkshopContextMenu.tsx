/**
 * Right-click actions for a Workshop part, on the shared context-menu shell.
 * With a multi-selection the menu operates on the whole group — the canvas
 * folds the clicked part into the selection before opening it.
 */
import { useRef } from 'react';
import { ContextMenuContainer, ContextMenuDivider, ContextMenuItem } from '@/shared/components';
import { ICON_PATHS } from '@/shared/constants/iconPaths';
import { useTranslation } from '@/i18n';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { findAssemblyPart } from '@/features/bin-designer/utils/assemblyTree';

export interface WorkshopMenuState {
  readonly partId: string;
  readonly x: number;
  readonly y: number;
}

function PathIcon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true">
      <path d={d} stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const ROTATE_PATH = 'M20 11A8 8 0 1 0 12 20M20 11V5M20 11h-6';
const MIRROR_PATH = 'M12 3v18M7 8l-4 4 4 4M17 8l4 4-4 4';
const COPY_PATH = 'M8 8h12v12H8zM16 8V4H4v12h4';
const ALIGN_X_PATH = 'M12 3v18M7 8h10M4 16h16';
const ALIGN_Y_PATH = 'M3 12h18M8 7v10M16 4v16';
const DISTRIBUTE_X_PATH = 'M4 5v14M12 5v14M20 5v14';
const DISTRIBUTE_Y_PATH = 'M5 4h14M5 12h14M5 20h14';

interface WorkshopContextMenuProps {
  readonly menu: WorkshopMenuState;
  readonly onClose: () => void;
}

export function WorkshopContextMenu({ menu, onClose }: WorkshopContextMenuProps) {
  const t = useTranslation();
  const menuRef = useRef<HTMLDivElement>(null);
  // Subscribed, not a snapshot: an undo while the menu is open must not leave
  // Rotate/Mirror acting on stale transform values.
  const node = useDesignerStore((s) =>
    s.structure?.kind === 'assembly' ? findAssemblyPart(s.structure.parts, menu.partId) : null
  );
  const { selection } = useDesignerStore(
    useShallow((s) => ({ selection: s.ui.selectedAssemblyPartIds }))
  );

  if (!node) return null;
  const run = (action: () => void) => () => {
    action();
    onClose();
  };
  const store = useDesignerStore.getState();
  const group = selection.length > 1 && selection.includes(menu.partId);

  if (group) {
    const count = selection.length;
    return (
      <ContextMenuContainer
        isOpen
        position={{ x: menu.x, y: menu.y }}
        onClose={onClose}
        menuRef={menuRef}
      >
        <ContextMenuItem
          icon={<PathIcon d={ICON_PATHS.duplicate[0]} />}
          label={t('workshop.menu.duplicateCount', { count })}
          onClick={run(() => store.duplicateAssemblyParts(selection))}
        />
        <ContextMenuItem
          icon={<PathIcon d={ROTATE_PATH} />}
          label={t('workshop.menu.rotate90')}
          onClick={run(() => store.rotateAssemblyPartsWorld(selection, 90))}
        />
        <ContextMenuItem
          icon={<PathIcon d={COPY_PATH} />}
          label={t('workshop.selection.copy')}
          onClick={run(() => store.copyAssemblyParts(selection))}
        />
        <ContextMenuDivider />
        <ContextMenuItem
          icon={<PathIcon d={ALIGN_X_PATH} />}
          label={t('workshop.selection.alignX')}
          onClick={run(() => store.alignAssemblyPartsWorld(selection, 'x'))}
        />
        <ContextMenuItem
          icon={<PathIcon d={ALIGN_Y_PATH} />}
          label={t('workshop.selection.alignY')}
          onClick={run(() => store.alignAssemblyPartsWorld(selection, 'y'))}
        />
        <ContextMenuItem
          icon={<PathIcon d={DISTRIBUTE_X_PATH} />}
          label={t('workshop.selection.distributeX')}
          disabled={count < 3}
          onClick={run(() => store.distributeAssemblyPartsWorld(selection, 'x'))}
        />
        <ContextMenuItem
          icon={<PathIcon d={DISTRIBUTE_Y_PATH} />}
          label={t('workshop.selection.distributeY')}
          disabled={count < 3}
          onClick={run(() => store.distributeAssemblyPartsWorld(selection, 'y'))}
        />
        <ContextMenuDivider />
        <ContextMenuItem
          icon={<PathIcon d={ICON_PATHS.trash[0]} />}
          label={t('workshop.menu.deleteCount', { count })}
          destructive
          onClick={run(() => store.removeAssemblyParts(selection))}
        />
      </ContextMenuContainer>
    );
  }

  return (
    <ContextMenuContainer
      isOpen
      position={{ x: menu.x, y: menu.y }}
      onClose={onClose}
      menuRef={menuRef}
    >
      <ContextMenuItem
        icon={<PathIcon d={ICON_PATHS.duplicate[0]} />}
        label={t('workshop.menu.duplicate')}
        onClick={run(() => store.duplicateAssemblyPart(menu.partId))}
      />
      <ContextMenuItem
        icon={<PathIcon d={ROTATE_PATH} />}
        label={t('workshop.menu.rotate90')}
        onClick={run(() =>
          store.moveAssemblyPart(menu.partId, {
            rotZDeg: ((node.transform.rotZDeg + 90 + 540) % 360) - 180,
          })
        )}
      />
      <ContextMenuItem
        icon={<PathIcon d={MIRROR_PATH} />}
        label={t('workshop.menu.mirror')}
        onClick={run(() => store.setAssemblyPartMirror(menu.partId, node.mirror !== true))}
      />
      <ContextMenuItem
        icon={<PathIcon d={COPY_PATH} />}
        label={t('workshop.selection.copy')}
        onClick={run(() => store.copyAssemblyParts([menu.partId]))}
      />
      <ContextMenuDivider />
      <ContextMenuItem
        icon={<PathIcon d={ICON_PATHS.trash[0]} />}
        label={t('workshop.menu.delete')}
        destructive
        onClick={run(() => store.removeAssemblyPart(menu.partId))}
      />
    </ContextMenuContainer>
  );
}

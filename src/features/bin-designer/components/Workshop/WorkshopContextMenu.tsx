/** Right-click actions for a Workshop part, on the shared context-menu shell. */
import { useRef } from 'react';
import { ContextMenuContainer, ContextMenuDivider, ContextMenuItem } from '@/shared/components';
import { ICON_PATHS } from '@/shared/constants/iconPaths';
import { useTranslation } from '@/i18n';
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

interface WorkshopContextMenuProps {
  readonly menu: WorkshopMenuState;
  readonly onClose: () => void;
}

export function WorkshopContextMenu({ menu, onClose }: WorkshopContextMenuProps) {
  const t = useTranslation();
  const menuRef = useRef<HTMLDivElement>(null);
  const store = useDesignerStore.getState();
  const node =
    store.structure?.kind === 'assembly'
      ? findAssemblyPart(store.structure.parts, menu.partId)
      : null;

  if (!node) return null;
  const run = (action: () => void) => () => {
    action();
    onClose();
  };
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

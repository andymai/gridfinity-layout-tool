/**
 * Floating group-operations toolbar, shown while two or more parts are
 * selected. Echoes the cutout editor's multi-select toolbar: compact chrome
 * at the canvas top with align/distribute/rotate/duplicate/delete, acting
 * on the store selection so undo captures one step per action.
 */
import { Button } from '@/design-system';
import { useTranslation } from '@/i18n';
import { useShallow } from 'zustand/react/shallow';
import { ICON_PATHS } from '@/shared/constants/iconPaths';
import { useDesignerStore } from '@/features/bin-designer/store/designer';

function PathsIcon({ paths }: { paths: readonly string[] }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true">
      {paths.map((d) => (
        <path key={d} d={d} stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      ))}
    </svg>
  );
}

const ALIGN_X_PATHS = ['M12 3v18', 'M7 8h10', 'M4 16h16'];
const ALIGN_Y_PATHS = ['M3 12h18', 'M8 7v10', 'M16 4v16'];
const DISTRIBUTE_X_PATHS = ['M4 5v14', 'M12 5v14', 'M20 5v14'];
const DISTRIBUTE_Y_PATHS = ['M5 4h14', 'M5 12h14', 'M5 20h14'];
const ROTATE_PATHS = ['M20 11A8 8 0 1 0 12 20M20 11V5M20 11h-6'];
const COPY_PATHS = ['M8 8h12v12H8z', 'M16 8V4H4v12h4'];

export function WorkshopSelectionToolbar() {
  const t = useTranslation();
  const { count } = useDesignerStore(
    useShallow((s) => ({ count: s.ui.selectedAssemblyPartIds.length }))
  );
  if (count < 2) return null;
  const run = (action: (ids: readonly string[]) => void): void => {
    action(useDesignerStore.getState().ui.selectedAssemblyPartIds);
  };
  const store = () => useDesignerStore.getState();
  return (
    <div
      data-testid="workshop-selection-toolbar"
      className="absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-1 rounded-lg border border-stroke-subtle bg-surface-elevated/90 p-1 shadow-sm backdrop-blur"
    >
      <span className="px-2 text-label font-medium text-content-secondary">
        {t('workshop.selection.count', { count })}
      </span>
      <div className="h-4 w-px bg-stroke-subtle" />
      <Button
        variant="ghost"
        size="sm"
        className="px-1.5"
        title={t('workshop.selection.alignX')}
        onClick={() => run((ids) => store().alignAssemblyPartsWorld(ids, 'x'))}
      >
        <PathsIcon paths={ALIGN_X_PATHS} />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="px-1.5"
        title={t('workshop.selection.alignY')}
        onClick={() => run((ids) => store().alignAssemblyPartsWorld(ids, 'y'))}
      >
        <PathsIcon paths={ALIGN_Y_PATHS} />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="px-1.5"
        title={t('workshop.selection.distributeX')}
        disabled={count < 3}
        onClick={() => run((ids) => store().distributeAssemblyPartsWorld(ids, 'x'))}
      >
        <PathsIcon paths={DISTRIBUTE_X_PATHS} />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="px-1.5"
        title={t('workshop.selection.distributeY')}
        disabled={count < 3}
        onClick={() => run((ids) => store().distributeAssemblyPartsWorld(ids, 'y'))}
      >
        <PathsIcon paths={DISTRIBUTE_Y_PATHS} />
      </Button>
      <div className="h-4 w-px bg-stroke-subtle" />
      <Button
        variant="ghost"
        size="sm"
        className="px-1.5"
        title={t('workshop.menu.rotate90')}
        onClick={() => run((ids) => store().rotateAssemblyPartsWorld(ids, 90))}
      >
        <PathsIcon paths={ROTATE_PATHS} />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="px-1.5"
        title={t('workshop.selection.copy')}
        onClick={() => run((ids) => store().copyAssemblyParts(ids))}
      >
        <PathsIcon paths={COPY_PATHS} />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="px-1.5"
        title={t('workshop.menu.duplicate')}
        onClick={() => run((ids) => store().duplicateAssemblyParts(ids))}
      >
        <PathsIcon paths={ICON_PATHS.duplicate} />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="px-1.5 text-error"
        title={t('workshop.menu.delete')}
        onClick={() => run((ids) => store().removeAssemblyParts(ids))}
      >
        <PathsIcon paths={ICON_PATHS.trash} />
      </Button>
      <div className="h-4 w-px bg-stroke-subtle" />
      <Button
        variant="ghost"
        size="sm"
        className="px-1.5"
        title={t('workshop.selection.clear')}
        onClick={() => store().setSelectedAssemblyPartId(null)}
      >
        <PathsIcon paths={ICON_PATHS.close} />
      </Button>
    </div>
  );
}

import { useCallback, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { ConfirmDialog, ToggleRow } from '@/shared/components';
import { useLayoutStore } from '@/core/store';
import { useTranslation } from '@/i18n';
import { useMutations } from '@/shared/contexts/MutationsContext';
import { trackDrawerShapeEditorOpened, trackDrawerShapeReset } from '@/shared/analytics/posthog';
import { GridAlignmentControls } from '@/shared/components/GridAlignmentControls';
import { ShapeEditorDialog } from '../ShapeEditorDialog/ShapeEditorDialog';
import { CornerCutsDialog } from '../CornerCutsDialog/CornerCutsDialog';
import { PenShapeDialog } from '../PenShapeDialog/PenShapeDialog';
import { DrawerShapeActionsMenu } from '../DrawerShapeActionsMenu/DrawerShapeActionsMenu';

interface DrawerShapeSectionProps {
  /** Platform variant, forwarded to the toggle row's sizing. */
  variant?: 'desktop' | 'mobile';
}

/**
 * Sidebar entry for non-rectangular drawers. The toggle reflects
 * whether an outline exists; enabling opens the cell-paint editor, disabling
 * clears the shape (with a confirm — clearing displaces nothing but discards
 * drawn geometry).
 *
 * Corner cuts stay reachable whether or not a custom shape exists: they're a
 * shortcut that *creates* an outline from the plain rectangle.
 */
export function DrawerShapeSection({ variant = 'desktop' }: DrawerShapeSectionProps = {}) {
  const t = useTranslation();
  const mutations = useMutations();
  const { hasOutline } = useLayoutStore(
    useShallow((s) => ({ hasOutline: s.layout.drawer.outline !== undefined }))
  );
  const [editorOpen, setEditorOpen] = useState(false);
  const [cornersOpen, setCornersOpen] = useState(false);
  const [penOpen, setPenOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const handleToggle = useCallback(() => {
    if (hasOutline) {
      setConfirmReset(true);
    } else {
      trackDrawerShapeEditorOpened('cells');
      setEditorOpen(true);
    }
  }, [hasOutline]);

  const handleOpenPen = useCallback(() => {
    trackDrawerShapeEditorOpened('pen');
    setPenOpen(true);
  }, []);

  const handleOpenCorners = useCallback(() => {
    trackDrawerShapeEditorOpened('corners');
    setCornersOpen(true);
  }, []);

  const handleOpenEditor = useCallback(() => {
    trackDrawerShapeEditorOpened('cells');
    setEditorOpen(true);
  }, []);

  const handleReset = useCallback(() => {
    trackDrawerShapeReset();
    mutations.setDrawerOutline(null);
  }, [mutations]);

  return (
    <>
      <ToggleRow
        label={t('drawerShape.toggle')}
        checked={hasOutline}
        onChange={handleToggle}
        helpTarget="drawer-shape"
        variant={variant}
        trailing={
          <DrawerShapeActionsMenu
            hasOutline={hasOutline}
            onOpenCorners={handleOpenCorners}
            onOpenPen={handleOpenPen}
            onOpenEditor={handleOpenEditor}
          />
        }
      />
      {hasOutline && <GridAlignmentControls variant={variant} />}
      <ShapeEditorDialog open={editorOpen} onClose={() => setEditorOpen(false)} />
      <CornerCutsDialog open={cornersOpen} onClose={() => setCornersOpen(false)} />
      <PenShapeDialog open={penOpen} onClose={() => setPenOpen(false)} />
      <ConfirmDialog
        isOpen={confirmReset}
        title={t('drawerShape.resetConfirmTitle')}
        message={t('drawerShape.resetConfirmBody')}
        confirmText={t('drawerShape.resetConfirm')}
        destructive
        onConfirm={handleReset}
        onCancel={() => setConfirmReset(false)}
      />
    </>
  );
}

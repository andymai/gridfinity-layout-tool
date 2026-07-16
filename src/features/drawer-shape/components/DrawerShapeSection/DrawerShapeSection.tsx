import { useCallback, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Button } from '@/design-system';
import { ConfirmDialog, ToggleRow } from '@/shared/components';
import { useLayoutStore } from '@/core/store';
import { useTranslation } from '@/i18n';
import { useMutations } from '@/shared/contexts/MutationsContext';
import { trackDrawerShapeEditorOpened, trackDrawerShapeReset } from '@/shared/analytics/posthog';
import { ShapeEditorDialog } from '../ShapeEditorDialog/ShapeEditorDialog';
import { CornerCutsDialog } from '../CornerCutsDialog/CornerCutsDialog';

interface DrawerShapeSectionProps {
  /** Platform variant, forwarded to the toggle row's sizing. */
  variant?: 'desktop' | 'mobile';
}

/**
 * Sidebar entry for non-rectangular drawers (issue #2528). The toggle reflects
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
  const [confirmReset, setConfirmReset] = useState(false);

  const handleToggle = useCallback(() => {
    if (hasOutline) {
      setConfirmReset(true);
    } else {
      trackDrawerShapeEditorOpened('cells');
      setEditorOpen(true);
    }
  }, [hasOutline]);

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

  // 44px on mobile to match the touch target the rest of the settings sheet uses.
  const actionClass = variant === 'mobile' ? 'text-sm h-11' : 'text-xs h-8';

  return (
    <>
      <ToggleRow
        label={t('drawerShape.toggle')}
        checked={hasOutline}
        onChange={handleToggle}
        helpTarget="drawer-shape"
        variant={variant}
      />
      {/* Full-width action buttons, matching the ActiveLayerPanel toolbar rather
          than floating a lone ghost link. Corner cuts stay available with no
          outline — they build one from the plain rectangle. */}
      <div className="flex gap-1.5 pt-2">
        <Button
          variant="secondary"
          fullWidth
          type="button"
          onClick={handleOpenCorners}
          className={actionClass}
        >
          {t('drawerShape.corners.open')}
        </Button>
        {hasOutline && (
          <Button
            variant="secondary"
            fullWidth
            type="button"
            onClick={handleOpenEditor}
            className={actionClass}
          >
            {t('drawerShape.edit')}
          </Button>
        )}
      </div>
      <ShapeEditorDialog open={editorOpen} onClose={() => setEditorOpen(false)} />
      <CornerCutsDialog open={cornersOpen} onClose={() => setCornersOpen(false)} />
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

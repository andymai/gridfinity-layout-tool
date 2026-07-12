import { useCallback, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Button } from '@/design-system';
import { ConfirmDialog } from '@/shared/components';
import { FeatureToggle } from '@/shared/components/FeatureToggle/FeatureToggle';
import { useLayoutStore } from '@/core/store';
import { useTranslation } from '@/i18n';
import { useMutations } from '@/shared/contexts/MutationsContext';
import { useFeatureFlag } from '@/shared/hooks/useFeatureFlag';
import { ShapeEditorDialog } from '../ShapeEditorDialog/ShapeEditorDialog';

/**
 * Sidebar entry for non-rectangular drawers (issue #2528), behind the
 * `drawer_shapes` labs flag. The toggle reflects whether an outline exists;
 * enabling opens the cell-paint editor, disabling clears the shape (with a
 * confirm — clearing displaces nothing but discards drawn geometry).
 */
export function DrawerShapeSection() {
  const t = useTranslation();
  const enabled = useFeatureFlag('drawer_shapes');
  const mutations = useMutations();
  const { hasOutline } = useLayoutStore(
    useShallow((s) => ({ hasOutline: s.layout.drawer.outline !== undefined }))
  );
  const [editorOpen, setEditorOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const handleToggle = useCallback(() => {
    if (hasOutline) {
      setConfirmReset(true);
    } else {
      setEditorOpen(true);
    }
  }, [hasOutline]);

  const handleReset = useCallback(() => {
    mutations.setDrawerOutline(null);
  }, [mutations]);

  if (!enabled) return null;

  return (
    <div className="border-t border-stroke-subtle pt-2" data-help-target="drawer-shape">
      <FeatureToggle
        label={t('drawerShape.toggle')}
        checked={hasOutline}
        onChange={handleToggle}
        primaryControls={
          hasOutline ? (
            <Button variant="secondary" size="sm" type="button" onClick={() => setEditorOpen(true)}>
              {t('drawerShape.edit')}
            </Button>
          ) : undefined
        }
      />
      <ShapeEditorDialog open={editorOpen} onClose={() => setEditorOpen(false)} />
      <ConfirmDialog
        isOpen={confirmReset}
        title={t('drawerShape.resetConfirmTitle')}
        message={t('drawerShape.resetConfirmBody')}
        confirmText={t('drawerShape.resetConfirm')}
        destructive
        onConfirm={handleReset}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  );
}

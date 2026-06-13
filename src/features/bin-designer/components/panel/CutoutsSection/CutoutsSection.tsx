/**
 * Cutouts section container.
 *
 * Only renders when `base.solid === true`. Contains the cutout editor
 * with shape toolbar, SVG canvas, property panel, and alignment tools.
 */

import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { Button } from '@/design-system';
import { useTranslation } from '@/i18n';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog/ConfirmDialog';
import { CutoutEditor } from './CutoutEditor';

export function CutoutsSection() {
  const t = useTranslation();
  const { cutoutCount, clearCutouts } = useDesignerStore(
    useShallow((s) => ({
      cutoutCount: s.params.cutouts.length,
      clearCutouts: s.clearCutouts,
    }))
  );
  const [clearConfirm, setClearConfirm] = useState(false);

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-[11px] text-content-tertiary leading-relaxed">
          {t('binDesigner.cutouts.instructions')}
        </p>
        <p className="text-[10px] text-content-disabled leading-relaxed">
          {t('binDesigner.cutouts.instructionsWorkspaceHint')}
        </p>
      </div>

      <CutoutEditor />

      {cutoutCount > 0 && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          fullWidth
          touchTarget={false}
          className="rounded border border-stroke-subtle bg-surface-elevated px-2 py-1 text-xs text-content-tertiary hover:bg-surface-hover hover:text-content"
          onClick={() => setClearConfirm(true)}
        >
          {t('binDesigner.cutouts.clearAll')}
        </Button>
      )}

      <ConfirmDialog
        isOpen={clearConfirm}
        title={t('binDesigner.cutouts.clearAllConfirmTitle')}
        message={t('binDesigner.cutouts.clearAllConfirmMessage', { count: cutoutCount })}
        confirmText={t('binDesigner.cutouts.clearAll')}
        destructive
        onConfirm={clearCutouts}
        onCancel={() => setClearConfirm(false)}
      />
    </div>
  );
}

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
import { Hint } from '../shared';
import { CutoutEditor } from './CutoutEditor';
import { cutoutTaperBand } from '@/features/bin-designer/utils/binDimensions';

export function CutoutsSection() {
  const t = useTranslation();
  const { cutoutCount, clearCutouts, overhang, cellMask } = useDesignerStore(
    useShallow((s) => ({
      cutoutCount: s.params.cutouts.length,
      clearCutouts: s.clearCutouts,
      overhang: s.params.overhang,
      cellMask: s.params.cellMask,
    }))
  );
  const taperBand = cutoutTaperBand({ overhang, cellMask });
  const [clearConfirm, setClearConfirm] = useState(false);

  return (
    <div className="space-y-3">
      <Hint info={t('binDesigner.cutouts.instructions')}>
        {t('binDesigner.cutouts.instructionsWorkspaceHint')}
      </Hint>

      <CutoutEditor />

      {taperBand && (
        <Hint info={t('binDesigner.cutouts.taperBandHint')}>
          {t('binDesigner.cutouts.taperBandHintShort')}
        </Hint>
      )}

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

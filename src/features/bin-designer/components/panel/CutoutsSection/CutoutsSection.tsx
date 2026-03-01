/**
 * Cutouts section container.
 *
 * Only renders when `base.solid === true`. Contains the cutout editor
 * with shape toolbar, SVG canvas, property panel, and alignment tools.
 */

import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useTranslation } from '@/i18n';
import { CutoutEditor } from './CutoutEditor';

export function CutoutsSection() {
  const t = useTranslation();
  const { cutoutCount, clearCutouts } = useDesignerStore(
    useShallow((s) => ({
      cutoutCount: s.params.cutouts.length,
      clearCutouts: s.clearCutouts,
    }))
  );

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
        <button
          type="button"
          className="w-full rounded border border-stroke-subtle bg-surface-elevated px-2 py-1 text-xs text-content-tertiary hover:bg-surface-hover hover:text-content transition-colors"
          onClick={clearCutouts}
        >
          {t('binDesigner.cutouts.clearAll')}
        </button>
      )}
    </div>
  );
}

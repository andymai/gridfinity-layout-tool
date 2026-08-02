/**
 * Cutouts section container.
 *
 * Only renders when `base.solid === true`. Contains the cutout editor
 * with shape toolbar, SVG canvas, property panel, and alignment tools.
 */

import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { Alert, Button } from '@/design-system';
import { useTranslation } from '@/i18n';
import { useFeatureFlag } from '@/shared/hooks/useFeatureFlag';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog/ConfirmDialog';
import { CutoutEditor } from './CutoutEditor';
import { cutoutTaperBand } from '@/features/bin-designer/utils/binDimensions';

const COMMUNITY_CUTOUT_HINT_DISMISSED_KEY = 'gridfinity-community-cutout-hint-dismissed-v1';

function isCommunityCutoutHintDismissed(): boolean {
  try {
    return localStorage.getItem(COMMUNITY_CUTOUT_HINT_DISMISSED_KEY) !== null;
  } catch {
    return false;
  }
}

export function CutoutsSection() {
  const t = useTranslation();
  const communityShowcaseEnabled = useFeatureFlag('community_showcase');
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
  const [cutoutHintDismissed, setCutoutHintDismissed] = useState(isCommunityCutoutHintDismissed);

  const dismissCutoutHint = () => {
    setCutoutHintDismissed(true);
    try {
      localStorage.setItem(COMMUNITY_CUTOUT_HINT_DISMISSED_KEY, '1');
    } catch {
      // Session-only dismissal when storage is unavailable.
    }
  };

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

      {communityShowcaseEnabled && !cutoutHintDismissed && (
        <Alert
          intent="info"
          size="sm"
          onDismiss={dismissCutoutHint}
          dismissAriaLabel={t('common.dismiss')}
          data-testid="community-cutout-hint"
        >
          {t('community.publish.needsCutout.hint')}
        </Alert>
      )}

      <CutoutEditor />

      {taperBand && (
        <p className="text-[10px] text-content-disabled leading-relaxed">
          {t('binDesigner.cutouts.taperBandHint')}
        </p>
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

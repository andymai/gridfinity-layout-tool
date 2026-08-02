import { useShallow } from 'zustand/react/shallow';
import { Button, IconButton } from '@/design-system';
import { InfoIcon, XIcon } from '@/design-system/Icon';
import { useSettingsStore } from '@/core/store';
import { useTranslation } from '@/i18n';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { openCommunityPublish } from '@/features/bin-designer/hooks/useCommunityPublish';
import { remixHintId } from '@/features/bin-designer/utils/remixHintId';

export function RemixBanner() {
  const t = useTranslation();
  const { lineage, currentDesignId } = useDesignerStore(
    useShallow((s) => ({ lineage: s.lineage, currentDesignId: s.currentDesignId }))
  );
  const hintId = currentDesignId === null ? null : remixHintId(currentDesignId);
  const { dismissed, dismissedHints, updateSettings } = useSettingsStore(
    useShallow((s) => ({
      dismissed: hintId !== null && s.settings.dismissedHints.includes(hintId),
      dismissedHints: s.settings.dismissedHints,
      updateSettings: s.updateSettings,
    }))
  );

  if (lineage === null || hintId === null || dismissed) return null;

  return (
    <div
      role="status"
      className="flex items-center gap-2 border-b border-info/20 bg-info-muted/40 px-4 py-2 text-xs text-content-secondary"
    >
      <InfoIcon size="sm" className="shrink-0 text-info" />
      <span className="min-w-0 flex-1">
        {t('binDesigner.remixBanner.text', {
          name: lineage.parentName,
          author: lineage.parentAuthorName,
        })}
      </span>
      <Button
        variant="ghost"
        size="sm"
        touchTarget={false}
        className="shrink-0 text-accent"
        onClick={() => void openCommunityPublish(null)}
      >
        {t('binDesigner.remixBanner.publish')}
      </Button>
      <IconButton
        variant="ghost"
        size="sm"
        touchTarget={false}
        className="shrink-0"
        onClick={() => updateSettings({ dismissedHints: [...dismissedHints, hintId] })}
        aria-label={t('binDesigner.remixBanner.dismiss')}
        title={t('binDesigner.remixBanner.dismiss')}
      >
        <XIcon size="sm" />
      </IconButton>
    </div>
  );
}

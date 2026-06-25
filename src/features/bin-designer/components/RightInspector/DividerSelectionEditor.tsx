/**
 * Context card for a selected (angled) divider. The per-divider tilt editor is
 * a specialized left-panel surface (DividerTiltSubsection, which also hosts the
 * angled-dividers enable toggle), so rather than duplicate it the inspector
 * surfaces the selection and a jump to that editor.
 */

import { Button } from '@/design-system';
import { useTranslation } from '@/i18n';
import { jumpToHelpTarget } from '@/shared/help/helpJumpDispatcher';

export function DividerSelectionEditor() {
  const t = useTranslation();
  return (
    <div className="space-y-3">
      <p className="text-xs text-content-secondary">{t('binDesigner.inspector.divider.title')}</p>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => {
          void jumpToHelpTarget({ surface: 'binDesigner:interior', controlId: 'bd-interior' });
        }}
      >
        {t('binDesigner.inspector.divider.editTilt')}
      </Button>
    </div>
  );
}

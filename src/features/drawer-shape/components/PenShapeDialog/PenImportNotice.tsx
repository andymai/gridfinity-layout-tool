/**
 * The choice an imported perimeter forces when it is larger than the drawer.
 *
 * Inline rather than a nested modal: the pen dialog already owns a focus trap,
 * and keeping the shape on screen is what makes the choice answerable.
 */

import { Button } from '@/design-system';
import { useTranslation } from '@/i18n';
import type { OversizePrompt } from './useOutlineImport';

interface PenImportNoticeProps {
  readonly prompt: OversizePrompt;
  readonly onResolve: (choice: 'scale' | 'grow' | 'cancel') => void;
}

export function PenImportNotice({ prompt, onResolve }: PenImportNoticeProps) {
  const t = useTranslation();

  return (
    <div
      role="alert"
      className="space-y-2 rounded-md border border-stroke-subtle bg-surface-secondary p-3"
    >
      <p className="text-xs leading-relaxed text-content-secondary">
        {t('drawerShape.penImportOversize', {
          width: Math.round(prompt.sourceWidthMm),
          depth: Math.round(prompt.sourceDepthMm),
        })}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {/* Growing is only offered when the drawer could actually hold the
            shape; past the grid maximum, scaling is the only way in. */}
        {prompt.canGrow && (
          <Button type="button" variant="primary" size="sm" onClick={() => onResolve('grow')}>
            {t('drawerShape.penImportGrow', {
              width: prompt.requiredWidthUnits,
              depth: prompt.requiredDepthUnits,
            })}
          </Button>
        )}
        <Button type="button" variant="secondary" size="sm" onClick={() => onResolve('scale')}>
          {t('drawerShape.penImportScale')}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => onResolve('cancel')}>
          {t('common.cancel')}
        </Button>
      </div>
    </div>
  );
}

import { Button } from '@/design-system';
import { useTranslation } from '@/i18n';
import { jumpToHelpTarget } from '@/shared/help/helpJumpDispatcher';
import type { DesignWarning } from './useDesignWarnings';

export function WarningsSection({ warnings }: { readonly warnings: readonly DesignWarning[] }) {
  const t = useTranslation();

  if (warnings.length === 0) {
    return (
      <p className="text-xs text-content-tertiary">{t('binDesigner.inspector.warnings.none')}</p>
    );
  }

  return (
    <ul className="space-y-2">
      {warnings.map((w) => {
        const target = w.jumpTarget;
        return (
          <li key={w.id} className="flex items-start gap-2 text-xs">
            <span
              className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${
                w.severity === 'blocker' ? 'bg-danger' : 'bg-warning'
              }`}
            />
            <span className="flex-1 text-content-secondary">{w.message}</span>
            {target && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void jumpToHelpTarget(target)}
                className="shrink-0 px-0 py-0 font-medium text-accent hover:bg-transparent hover:text-accent/80"
              >
                {t('binDesigner.inspector.warnings.fix')}
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

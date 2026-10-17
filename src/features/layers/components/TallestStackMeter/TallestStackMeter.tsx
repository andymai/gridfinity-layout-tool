import { useTranslation } from '@/i18n';
import { formatHeightUnits } from '@/shared/utils/heightUnits';

interface TallestStackMeterProps {
  /** Highest point any stack reaches, in height units. */
  tallest: number;
  drawerHeight: number;
}

/**
 * The tallest stack against the drawer. This is the drawer limit that
 * matters: layers no longer share out the drawer height between them.
 */
export function TallestStackMeter({ tallest, drawerHeight }: TallestStackMeterProps) {
  const t = useTranslation();
  const over = tallest > drawerHeight + 1e-9;
  const fill = drawerHeight > 0 ? Math.min(100, (tallest / drawerHeight) * 100) : 0;
  const summary = t('layers.heightTotal', {
    used: formatHeightUnits(tallest),
    total: formatHeightUnits(drawerHeight),
  });

  return (
    <div data-testid="tallest-stack-meter">
      <div className="flex items-center justify-between mb-1 text-micro tabular-nums">
        <span className="text-content-disabled">{t('layers.tallestStack')}</span>
        <span className={over ? 'text-warning' : 'text-content-tertiary'}>{summary}</span>
      </div>
      <div
        role="progressbar"
        aria-label={t('layers.tallestStack')}
        aria-valuemin={0}
        aria-valuemax={drawerHeight}
        aria-valuenow={tallest}
        aria-valuetext={summary}
        className="h-1 rounded-full overflow-hidden bg-surface-elevated"
      >
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${fill}%`,
            backgroundColor: over ? 'var(--color-warning)' : 'var(--color-info)',
          }}
        />
      </div>
      {over && (
        <p className="mt-1 text-micro text-warning tabular-nums">
          {t('layers.stackOverDrawer', { over: formatHeightUnits(tallest - drawerHeight) })}
        </p>
      )}
    </div>
  );
}

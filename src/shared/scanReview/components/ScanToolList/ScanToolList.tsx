import { Button } from '@/design-system';
import { useTranslation } from '@/i18n';
import type { SceneShape } from '@/shared/scanTrace';
import { bounds } from '../../scanFlow';

interface ScanToolListProps {
  readonly shapes: readonly SceneShape[];
  readonly units: 'mm' | 'px';
  readonly disabled?: boolean;
  readonly onRemove: (index: number) => void;
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

export function ScanToolList({ shapes, units, disabled = false, onRemove }: ScanToolListProps) {
  const t = useTranslation();
  return (
    <ol className="flex w-full flex-col divide-y divide-stroke-subtle rounded-lg border border-stroke">
      {shapes.map((shape, i) => {
        const size = units === 'mm' ? bounds(shape.outputPoints) : null;
        const index = i + 1;
        return (
          <li key={i} className="flex items-center gap-3 py-1 pl-3 pr-1">
            <span
              aria-hidden="true"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-on-accent"
            >
              {index}
            </span>
            <span className="flex flex-1 flex-col text-sm text-content-primary">
              {t('scan.review.toolLabel', { index })}
              {shape.underStrip && (
                <span className="text-xs text-warning">{t('scan.review.underStrip')}</span>
              )}
            </span>
            {size && (
              <span className="text-xs text-content-secondary">
                {t('binDesigner.cutouts.scanImport.resultSize', {
                  width: round1(size.w),
                  depth: round1(size.h),
                })}
              </span>
            )}
            <Button
              type="button"
              variant="ghost"
              size="md"
              disabled={disabled}
              onClick={() => onRemove(i)}
              aria-label={t('scan.review.removeTool', { index })}
            >
              {t('scan.review.remove')}
            </Button>
          </li>
        );
      })}
    </ol>
  );
}

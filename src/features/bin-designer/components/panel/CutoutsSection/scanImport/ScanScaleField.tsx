import { useEffect, useId, useMemo } from 'react';
import { Input } from '@/design-system';
import { useTranslation } from '@/i18n';
import { scaleTargetMm, type ParsedScan } from './scanIngest';

const round1 = (n: number): number => Math.round(n * 10) / 10;

interface ScanScaleFieldProps {
  readonly svg: string;
  readonly parsed: ParsedScan;
  readonly targetText: string;
  readonly onChange: (text: string) => void;
}

/**
 * A pixel scan's outline with the one real measurement it needs before it can
 * become a cutout, and the size that measurement gives.
 */
export function ScanScaleField({ svg, parsed, targetText, onChange }: ScanScaleFieldProps) {
  const t = useTranslation();
  const fieldId = useId();
  // A Blob URL rather than a data: URL, which would re-encode a possibly
  // multi-MB SVG into a string on every render.
  const previewUrl = useMemo(
    () => URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })),
    [svg]
  );
  useEffect(() => () => URL.revokeObjectURL(previewUrl), [previewUrl]);

  const targetMm = scaleTargetMm(targetText);
  const factor = targetMm === null ? 1 : targetMm / parsed.sized.longest;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-center rounded-md border border-stroke-subtle bg-surface-elevated p-3">
        <img
          src={previewUrl}
          alt={t('binDesigner.cutouts.scanImport.previewAlt')}
          className="max-h-48 w-auto"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={fieldId} className="text-sm font-medium text-content-primary">
          {t(
            parsed.sizedByLongest
              ? 'binDesigner.cutouts.scanImport.scaleLabelLongest'
              : 'binDesigner.cutouts.scanImport.scaleLabel'
          )}
        </label>
        <Input
          id={fieldId}
          type="number"
          min={0}
          step={0.5}
          value={targetText}
          error={targetText !== '' && targetMm === null}
          onChange={(e) => onChange(e.target.value)}
        />
        <p className="text-xs text-content-tertiary">
          {t('binDesigner.cutouts.scanImport.scaleHelp')}
        </p>
        {targetMm !== null && (
          <p className="text-xs text-content-secondary">
            {t('binDesigner.cutouts.scanImport.resultSize', {
              width: round1(parsed.sized.width * factor),
              depth: round1(parsed.sized.depth * factor),
            })}
          </p>
        )}
      </div>
    </div>
  );
}

import { Badge, Button, cn } from '@/design-system';
import { useTranslation } from '@/i18n';
import type { CommunityPrint } from '@/shared/types/communityPrint';
import { printerLabel } from '@/shared/types/communityPrinters';
import { formatGrams, formatMillimetres, formatPrintDuration } from '../../utils/printFormat';

export interface PrintCardProps {
  print: CommunityPrint;
  /** True when this is the viewer's own record; suppresses the report action. */
  isMine: boolean;
  onReport?: (print: CommunityPrint) => void;
}

const VERDICT_KEYS: Record<CommunityPrint['fitVerdict'], string> = {
  'as-designed': 'community.print.fit.asDesigned',
  adjusted: 'community.print.fit.adjusted',
  'did-not-fit': 'community.print.fit.didNotFit',
};

const VERDICT_TONES: Record<CommunityPrint['fitVerdict'], 'success' | 'warning' | 'error'> = {
  'as-designed': 'success',
  adjusted: 'warning',
  'did-not-fit': 'error',
};

export function PrintCard({ print, isMine, onReport }: PrintCardProps) {
  const t = useTranslation();
  const { settings } = print;
  const { hours, minutes } = formatPrintDuration(settings.printMinutes);

  const duration =
    hours === 0
      ? t('community.prints.durationMinutes', { minutes })
      : minutes === 0
        ? t('community.prints.durationHoursExact', { hours })
        : t('community.prints.durationHours', { hours, minutes });

  // A retired printer id still renders as itself, so an old record stays
  // readable rather than losing its machine.
  const printer =
    settings.printer === 'other' && settings.printerOther !== undefined
      ? settings.printerOther
      : printerLabel(settings.printer);

  return (
    <li
      className="rounded-lg border border-stroke-subtle p-3"
      data-testid={`print-card-${print.authorPublicId}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm text-content">
            <span className="truncate">
              {t('community.prints.byAuthor', { author: print.authorName })}
            </span>
            {isMine && (
              <Badge size="sm" tone="neutral">
                {t('community.prints.yours')}
              </Badge>
            )}
          </p>
          <p className="mt-0.5 truncate text-xs text-content-secondary">{printer}</p>
        </div>

        <Badge
          size="sm"
          tone={VERDICT_TONES[print.fitVerdict]}
          data-testid={`print-verdict-${print.fitVerdict}`}
        >
          {t(VERDICT_KEYS[print.fitVerdict])}
        </Badge>
      </div>

      {print.photos.length > 0 && (
        <ul className="mt-2 flex gap-2 overflow-x-auto scrollbar-thin">
          {print.photos.map((photo, index) => (
            <li key={photo}>
              <img
                src={photo}
                alt={t('community.prints.photoAlt', {
                  index: index + 1,
                  author: print.authorName,
                })}
                loading="lazy"
                className="h-24 w-24 shrink-0 rounded-lg border border-stroke-subtle object-cover"
              />
            </li>
          ))}
        </ul>
      )}

      <p className="mt-2 text-xs text-content-secondary">
        {t('community.prints.settingsLine', {
          material:
            settings.material === 'other'
              ? t('community.print.otherOption')
              : settings.material.toUpperCase(),
          nozzle: formatMillimetres(settings.nozzleMm),
          layer: formatMillimetres(settings.layerHeightMm),
        })}
        {' · '}
        {duration}
        {settings.filamentGrams !== undefined && (
          <>
            {' · '}
            {t('community.prints.filament', { grams: formatGrams(settings.filamentGrams) })}
          </>
        )}
      </p>

      {print.note !== '' && (
        <p className={cn('mt-2 whitespace-pre-line break-words text-sm text-content-secondary')}>
          {print.note}
        </p>
      )}

      {!isMine && onReport !== undefined && (
        <Button
          variant="ghost"
          onClick={() => onReport(print)}
          className="mt-2 h-auto p-0 text-xs font-normal text-content-tertiary underline-offset-2 hover:underline"
          data-testid={`print-report-${print.authorPublicId}`}
        >
          {t('community.prints.report')}
        </Button>
      )}
    </li>
  );
}

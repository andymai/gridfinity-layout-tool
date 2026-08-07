import { useCallback, useState } from 'react';
import { Badge, Button, cn } from '@/design-system';
import { useTranslation } from '@/i18n';
import type { CommunityPrint } from '@/shared/types/communityPrint';
import { printerLabel } from '@/shared/types/communityPrinters';
import { formatGrams, formatMillimetres, formatPrintDuration } from '../../utils/printFormat';
import { PRINT_VERDICT_LABEL_KEYS, PRINT_VERDICT_TONES } from '../../utils/printVerdict';

export interface PrintCardProps {
  print: CommunityPrint;
  /** True when this is the viewer's own record; suppresses the report action. */
  isMine: boolean;
  onReport?: (print: CommunityPrint) => void;
  /**
   * Present only for the design's owner. Promotion is owner opt-in because the
   * gallery grid is the most public surface in the app, and this is the one
   * place a user-supplied image can reach it.
   */
  onPromoteCover?: (photoUrl: string) => void;
  /** The design's current cover, so the promoted photo can label itself. */
  coverPhotoUrl?: string;
  /** Opens the enlarged view on this print's nth photo; absent leaves tiles inert. */
  onOpenPhoto?: (printId: string, photoIndex: number) => void;
}

interface PrintPhotoTileProps {
  url: string;
  alt: string;
  isCover: boolean;
  onOpen?: () => void;
  /** Reported up so the owner cannot promote a dead photo to the gallery cover. */
  onFailed: () => void;
}

function PrintPhotoTile({ url, alt, isCover, onOpen, onFailed }: PrintPhotoTileProps) {
  const t = useTranslation();
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        className="flex aspect-square items-center justify-center rounded-lg border border-stroke-subtle px-2 text-center text-xs text-content-tertiary"
        data-testid="print-photo-missing"
      >
        {t('community.prints.photoMissing')}
      </span>
    );
  }

  const image = (
    <img
      src={url}
      // The wrapping button already carries `alt` as its accessible name, so
      // repeating it here reads the photo out twice.
      alt={onOpen === undefined ? alt : ''}
      loading="lazy"
      decoding="async"
      // Squared up front so a photo arriving mid-scroll cannot shove the rest
      // of the grid down as it loads.
      width={300}
      height={300}
      onError={() => {
        setFailed(true);
        onFailed();
      }}
      className="h-full w-full object-cover"
    />
  );

  if (onOpen === undefined) {
    return (
      <span
        className={cn(
          'block aspect-square overflow-hidden rounded-lg border',
          isCover ? 'border-accent' : 'border-stroke-subtle'
        )}
      >
        {image}
      </span>
    );
  }

  return (
    <Button
      variant="ghost"
      touchTarget={false}
      onClick={onOpen}
      aria-label={alt}
      className={cn(
        'aspect-square h-auto w-full overflow-hidden rounded-lg border p-0',
        isCover ? 'border-accent' : 'border-stroke-subtle'
      )}
    >
      {image}
    </Button>
  );
}

export function PrintCard({
  print,
  isMine,
  onReport,
  onPromoteCover,
  coverPhotoUrl,
  onOpenPhoto,
}: PrintCardProps) {
  const t = useTranslation();
  const { settings } = print;
  const { hours, minutes } = formatPrintDuration(settings.printMinutes);

  // Promotion puts a photo on the gallery grid, the most public surface in the
  // app, and the server only checks that the URL belongs to a live print of
  // this design. A photo whose blob is gone passes that check, so the button
  // has to withdraw itself once the image is known to be dead.
  // Keyed by url rather than by slot, so it agrees with the tile's own failure
  // flag: the tile remounts when the url at a slot changes, and an index-keyed
  // entry would outlive it and suppress promotion of the healthy replacement.
  const [deadPhotos, setDeadPhotos] = useState<ReadonlySet<string>>(() => new Set());
  const markPhotoDead = useCallback((url: string) => {
    setDeadPhotos((current) => new Set(current).add(url));
  }, []);

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
          tone={PRINT_VERDICT_TONES[print.fitVerdict]}
          data-testid={`print-verdict-${print.fitVerdict}`}
        >
          {t(PRINT_VERDICT_LABEL_KEYS[print.fitVerdict])}
        </Badge>
      </div>

      {print.photos.length > 0 && (
        // A grid rather than the old 96px scrolling row: a drawer shot cropped
        // to a thumbnail shows a patch of filament, and half the photos sat
        // off the edge of a 320px rail.
        <ul className="mt-2 grid grid-cols-2 gap-2">
          {print.photos.map((photo, index) =>
            // Dropped rather than rendered as an inert tile: the flat media
            // sequence skips empty slots too, so a tile here would open nothing.
            photo === '' ? null : (
              // Index-qualified: the server does not dedupe the photo array, so
              // two identical URLs would otherwise collide as keys.
              <li key={`${index}-${photo}`}>
                <PrintPhotoTile
                  url={photo}
                  alt={t('community.prints.photoAlt', {
                    index: index + 1,
                    author: print.authorName,
                  })}
                  isCover={photo === coverPhotoUrl}
                  onOpen={
                    onOpenPhoto === undefined ? undefined : () => onOpenPhoto(print.id, index)
                  }
                  onFailed={() => markPhotoDead(photo)}
                />
                {onPromoteCover !== undefined &&
                  !deadPhotos.has(photo) &&
                  (photo === coverPhotoUrl ? (
                    <p className="mt-1 text-center text-[11px] text-accent">
                      {t('community.prints.coverCurrent')}
                    </p>
                  ) : (
                    <Button
                      variant="ghost"
                      onClick={() => onPromoteCover(photo)}
                      className="mt-1 h-auto w-full justify-center p-0 text-[11px] font-normal text-content-tertiary underline-offset-2 hover:underline"
                      data-testid={`print-promote-${index}`}
                    >
                      {t('community.prints.useAsCover')}
                    </Button>
                  ))}
              </li>
            )
          )}
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

import { useCallback, useState } from 'react';
import { Badge, Button, cn } from '@/design-system';
import { useTranslation } from '@/i18n';
import type { CommunityPrint, CommunityPrintSettings } from '@/shared/types/communityPrint';
import { COMMUNITY_PRINTER_OTHER, printerLabel } from '@/shared/types/communityPrinters';
import { SupporterBadge } from '@/shared/components/SupporterBadge';
import { formatGrams, formatMillimetres, formatPrintDuration } from '../../utils/printFormat';
import { PRINT_VERDICT_LABEL_KEYS, PRINT_VERDICT_TONES } from '../../utils/printVerdict';

type Translate = ReturnType<typeof useTranslation>;

export interface PrintCardProps {
  print: CommunityPrint;
  /** True when this is the viewer's own record; suppresses the report action. */
  isMine: boolean;
  /** Whether this printer is a badged Ko-fi supporter. */
  authorIsSupporter?: boolean;
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

/**
 * Only the settings that were reported, so a photo-and-verdict record has no
 * settings line at all rather than a row of dashes. Every field stands on its
 * own: the material/nozzle/layer sentence is one interpolated string and needs
 * all three, but its parts still show individually rather than a reported
 * nozzle vanishing because nobody named the filament.
 */
function settingsFacts(settings: CommunityPrintSettings, t: Translate): string[] {
  const facts: string[] = [];
  const material =
    settings.material === undefined
      ? null
      : settings.material === 'other'
        ? t('community.print.otherOption')
        : settings.material.toUpperCase();

  if (
    material !== null &&
    settings.nozzleMm !== undefined &&
    settings.layerHeightMm !== undefined
  ) {
    facts.push(
      t('community.prints.settingsLine', {
        material,
        nozzle: formatMillimetres(settings.nozzleMm),
        layer: formatMillimetres(settings.layerHeightMm),
      })
    );
  } else {
    if (material !== null) facts.push(material);
    if (settings.nozzleMm !== undefined) {
      facts.push(
        t('community.prints.nozzleOnly', { nozzle: formatMillimetres(settings.nozzleMm) })
      );
    }
    if (settings.layerHeightMm !== undefined) {
      facts.push(
        t('community.prints.layerOnly', { layer: formatMillimetres(settings.layerHeightMm) })
      );
    }
  }

  if (settings.printMinutes !== undefined) {
    const { hours, minutes } = formatPrintDuration(settings.printMinutes);
    if (hours === 0) {
      facts.push(t('community.prints.durationMinutes', { minutes }));
    } else if (minutes === 0) {
      facts.push(t('community.prints.durationHoursExact', { hours }));
    } else {
      facts.push(t('community.prints.durationHours', { hours, minutes }));
    }
  }

  if (settings.filamentGrams !== undefined) {
    facts.push(t('community.prints.filament', { grams: formatGrams(settings.filamentGrams) }));
  }

  return facts;
}

/** A retired printer id still renders as itself, so an old record keeps its machine. */
function printerText(settings: CommunityPrintSettings): string | null {
  if (settings.printer === undefined) return null;
  if (settings.printer === COMMUNITY_PRINTER_OTHER && settings.printerOther !== undefined) {
    return settings.printerOther;
  }
  return printerLabel(settings.printer);
}

export function PrintCard({
  print,
  isMine,
  authorIsSupporter,
  onReport,
  onPromoteCover,
  coverPhotoUrl,
  onOpenPhoto,
}: PrintCardProps) {
  const t = useTranslation();
  const { settings } = print;

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

  const facts = settingsFacts(settings, t);
  const printer = printerText(settings);

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
            {authorIsSupporter === true && <SupporterBadge source="community_print" />}
            {isMine && (
              <Badge size="sm" tone="neutral">
                {t('community.prints.yours')}
              </Badge>
            )}
          </p>
          {printer !== null && (
            <p className="mt-0.5 truncate text-xs text-content-secondary">{printer}</p>
          )}
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
                  // The browsing copy: these tiles are ~117px and the photo
                  // behind them is 1200px. Falls back to the full one for a
                  // photo uploaded before the smaller copy existed.
                  url={print.photoThumbs?.[index] || photo}
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
                    <p className="mt-1 text-center text-label text-accent">
                      {t('community.prints.coverCurrent')}
                    </p>
                  ) : (
                    <Button
                      variant="ghost"
                      onClick={() => onPromoteCover(photo)}
                      className="mt-1 h-auto w-full justify-center p-0 text-label font-normal text-content-tertiary underline-offset-2 hover:underline"
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

      {facts.length > 0 && (
        <p className="mt-2 text-xs text-content-secondary" data-testid="print-card-settings">
          {facts.join(' · ')}
        </p>
      )}

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

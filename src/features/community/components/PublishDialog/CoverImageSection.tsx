/**
 * The only path by which a real photo reaches a design's gallery card is:
 * publish it, print it, post a print report with photos, then promote one of
 * those photos to the cover. That path is deliberate (the server validates the
 * URL belongs to a live print of this design, which is what keeps the most
 * public surface in the app bounded) but nothing in the publish flow ever
 * mentioned it, so owners had no way to discover it existed.
 *
 * Update mode only: there is nothing to promote onto a design that is not
 * published yet.
 */

import { useEffect, useState } from 'react';
import { Alert, Button, Spinner, cn } from '@/design-system';
import { useTranslation } from '@/i18n';
import { isOk } from '@/core/result';
import { fetchPrints, setCoverPhoto } from '../../api/printsClient';

export interface CoverImageSectionProps {
  designId: string;
  /** '' means the card shows the render. */
  currentCoverUrl: string;
}

export function CoverImageSection({ designId, currentCoverUrl }: CoverImageSectionProps) {
  const t = useTranslation();
  const [photos, setPhotos] = useState<readonly string[] | null>(null);
  const [cover, setCover] = useState(currentCoverUrl);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchPrints(designId).then((result) => {
      if (cancelled) return;
      // A prints fetch that fails is not worth an error state here: the
      // section is an enhancement, and the design updates fine without it.
      setPhotos(isOk(result) ? (result.value.mine?.photos ?? []) : []);
    });
    return () => {
      cancelled = true;
    };
  }, [designId]);

  const choose = (photoUrl: string | null) => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    void setCoverPhoto(designId, photoUrl).then((result) => {
      setBusy(false);
      if (isOk(result)) {
        setCover(result.value.coverPhotoUrl);
        return;
      }
      setFailed(true);
    });
  };

  if (photos === null) {
    return (
      <div className="flex items-center gap-3">
        <Spinner />
        <span className="text-sm text-content-secondary">
          {t('community.publish.cover.loading')}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-content-tertiary">
        {t('community.publish.cover.label')}
      </p>
      {photos.length === 0 ? (
        <p className="text-sm text-content-secondary">{t('community.publish.cover.noPrints')}</p>
      ) : (
        <>
          <div
            role="radiogroup"
            aria-label={t('community.publish.cover.label')}
            className="flex flex-wrap items-center gap-2"
          >
            <Button
              role="radio"
              aria-checked={cover === ''}
              variant={cover === '' ? 'primary' : 'secondary'}
              disabled={busy}
              className="min-h-11 md:min-h-9"
              onClick={() => choose(null)}
            >
              {t('community.publish.cover.useRender')}
            </Button>
            {photos.map((photoUrl) => (
              <Button
                key={photoUrl}
                role="radio"
                aria-checked={cover === photoUrl}
                aria-label={t('community.publish.cover.usePhoto')}
                variant="ghost"
                disabled={busy}
                className={cn(
                  'h-14 w-14 overflow-hidden rounded-md border !px-0 py-0',
                  cover === photoUrl
                    ? 'border-accent ring-1 ring-accent'
                    : 'border-stroke-subtle opacity-70 hover:opacity-100'
                )}
                onClick={() => choose(photoUrl)}
              >
                <img src={photoUrl} alt="" className="h-full w-full object-cover" />
              </Button>
            ))}
          </div>
          <p className="text-xs text-content-tertiary">{t('community.publish.cover.hint')}</p>
        </>
      )}
      {failed && (
        <Alert intent="error" size="sm">
          {t('community.publish.cover.failed')}
        </Alert>
      )}
    </div>
  );
}

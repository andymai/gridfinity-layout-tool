/**
 * Enlarged view of one design's images, opened from the filmstrip or from a
 * print's photo grid and stepping through the whole flat sequence either way.
 *
 * A photo carries its attribution and fit verdict into the enlarged view. The
 * verdict is the field that decides whether you print the thing, so a photo
 * shown without it is decoration rather than evidence.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { TouchEvent, TouchList as ReactTouchList } from 'react';
import { Badge, Dialog, IconButton } from '@/design-system';
import { ChevronDownIcon } from '@/design-system/Icon';
import { useTranslation } from '@/i18n';
import type { DesignImage } from '../../utils/designMedia';
import { PRINT_VERDICT_LABEL_KEYS, PRINT_VERDICT_TONES } from '../../utils/printVerdict';

/** Below this a swipe is indistinguishable from a tap that drifted. */
const SWIPE_THRESHOLD_PX = 48;

function firstTouchX(touches: ReactTouchList): number | null {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- TouchList's index signature is typed non-nullable, but an empty list is reachable at runtime
  return touches[0]?.clientX ?? null;
}

export interface MediaLightboxProps {
  images: readonly DesignImage[];
  /** Which image the opening gesture pointed at. */
  startIndex: number;
  designName: string;
  onClose: () => void;
}

export function MediaLightbox({ images, startIndex, designName, onClose }: MediaLightboxProps) {
  const t = useTranslation();
  const total = images.length;
  const [index, setIndex] = useState(startIndex);
  const touchStartX = useRef<number | null>(null);

  const step = useCallback(
    (delta: number) => {
      // Wraps rather than clamps: a gallery that dead-ends at the last photo
      // makes you reverse all the way back to see the first one.
      setIndex((current) => (total === 0 ? 0 : (current + delta + total) % total));
    },
    [total]
  );

  // Capture phase on document: Dialog.Root's containKeyboard stops keydown
  // propagation at the content boundary, so a bubble-phase listener would
  // never see an arrow pressed inside the dialog.
  useEffect(() => {
    if (total < 2) return;
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        step(-1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        step(1);
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [step, total]);

  const handleTouchStart = useCallback((event: TouchEvent<HTMLDivElement>) => {
    touchStartX.current = firstTouchX(event.changedTouches);
  }, []);

  const handleTouchEnd = useCallback(
    (event: TouchEvent<HTMLDivElement>) => {
      const start = touchStartX.current;
      touchStartX.current = null;
      if (start === null || total < 2) return;
      const end = firstTouchX(event.changedTouches);
      if (end === null) return;
      const travel = end - start;
      if (Math.abs(travel) < SWIPE_THRESHOLD_PX) return;
      step(travel < 0 ? 1 : -1);
    },
    [step, total]
  );

  const image = images.at(index);
  if (image === undefined) return null;

  const alt =
    image.kind === 'render'
      ? t('community.media.renderAlt', { name: designName, angle: image.angle })
      : t('community.media.photoAlt', { author: image.authorName });

  return (
    <Dialog.Root
      open
      onClose={onClose}
      size="5xl"
      height="fixed"
      fullScreen="mobile"
      closeOnOverlayClick
    >
      <Dialog.Header title={designName} bordered closeAriaLabel={t('common.close')}>
        {total > 1 && (
          <span
            className="text-sm tabular-nums text-content-secondary"
            data-testid="lightbox-counter"
          >
            {t('community.media.counter', { index: index + 1, total })}
          </span>
        )}
      </Dialog.Header>

      <Dialog.Body padding="none" scroll={false}>
        <div
          className="relative flex min-h-0 flex-1 items-center justify-center bg-surface-secondary p-3"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          data-testid="lightbox-stage"
        >
          <img
            src={image.url}
            alt={alt}
            // Fit-to-screen: the upload pipeline caps photos at 1200px, so on a
            // typical window this is already near 1:1 and a zoom control would
            // magnify WebP artefacts rather than reveal detail.
            className="max-h-full max-w-full object-contain"
            data-testid="lightbox-image"
          />

          {total > 1 && (
            <>
              <IconButton
                aria-label={t('community.media.previous')}
                onClick={() => step(-1)}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-surface/80"
                data-testid="lightbox-previous"
              >
                <ChevronDownIcon size="sm" className="rotate-90" />
              </IconButton>
              <IconButton
                aria-label={t('community.media.next')}
                onClick={() => step(1)}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-surface/80"
                data-testid="lightbox-next"
              >
                <ChevronDownIcon size="sm" className="-rotate-90" />
              </IconButton>
            </>
          )}
        </div>
      </Dialog.Body>

      <Dialog.Footer bordered justify="between" className="max-md:flex-col max-md:items-start">
        {image.kind === 'render' ? (
          <p className="text-sm text-content-secondary" data-testid="lightbox-caption">
            {t('community.media.renderCaption', { angle: image.angle })}
          </p>
        ) : (
          <div className="min-w-0 space-y-1" data-testid="lightbox-caption">
            <p className="flex flex-wrap items-center gap-2 text-sm text-content">
              <span className="truncate">
                {t('community.media.photoBy', { author: image.authorName })}
              </span>
              <Badge size="sm" tone={PRINT_VERDICT_TONES[image.fitVerdict]}>
                {t(PRINT_VERDICT_LABEL_KEYS[image.fitVerdict])}
              </Badge>
            </p>
            {image.note !== '' && (
              <p className="whitespace-pre-line break-words text-sm text-content-secondary">
                {image.note}
              </p>
            )}
          </div>
        )}
      </Dialog.Footer>
    </Dialog.Root>
  );
}

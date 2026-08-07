/**
 * The detail view's media column: one hero panel showing whichever medium is
 * selected, over a filmstrip that mixes the live 3D model, the generated angle
 * renders and every photo of the thing actually printed.
 *
 * The strip is permanent. It used to be an angle picker that unmounted once the
 * model went live, which left the renders unreachable and gave the photos
 * nowhere to appear except the bottom of the details rail.
 */

import { useCallback, useState } from 'react';
import { Button, cn } from '@/design-system';
import { useTranslation } from '@/i18n';
import { GlbViewer } from '@/shared/components/GlbViewer';
import { GradientBackground } from '@/shared/components/preview/GradientBackground';
import type { CommunityDesign } from '@/shared/types/community';
import type { DesignImage } from '../../utils/designMedia';
import { FILMSTRIP_MAX_TILES } from '../../utils/designMedia';

type Selection =
  | { readonly kind: 'model' }
  // The url rides along so a shifted list can be detected: prints are listed
  // newest-first, so posting one PREPENDS it and slides every photo's index.
  // Without this the hero would silently swap to a different picture.
  | { readonly kind: 'image'; readonly index: number; readonly url: string };

export interface DesignMediaPanelProps {
  design: CommunityDesign;
  images: readonly DesignImage[];
  isMobile: boolean;
  /** Opens the enlarged view on the given index of `images`. */
  onOpenLightbox: (index: number) => void;
}

function imageLabel(image: DesignImage, t: ReturnType<typeof useTranslation>): string {
  return image.kind === 'render'
    ? t('community.detail.angleAria', { index: image.angle })
    : t('community.media.selectPhoto', { author: image.authorName });
}

export function DesignMediaPanel({
  design,
  images,
  isMobile,
  onOpenLightbox,
}: DesignMediaPanelProps) {
  const t = useTranslation();
  const [selection, setSelection] = useState<Selection>({ kind: 'model' });

  const poster = images.find((image) => image.kind === 'render')?.url ?? '';
  const candidate = selection.kind === 'image' ? images.at(selection.index) : undefined;
  // Falls back to the model rather than showing whatever slid into the slot.
  const selected =
    candidate?.url === (selection.kind === 'image' ? selection.url : undefined)
      ? candidate
      : undefined;

  const handleEnlarge = useCallback(() => {
    if (selected !== undefined && selection.kind === 'image') onOpenLightbox(selection.index);
  }, [onOpenLightbox, selected, selection]);

  // The 3D tile occupies one slot, so the strip shows one fewer image than the
  // tile budget before it collapses the remainder.
  const visibleCount = Math.min(images.length, FILMSTRIP_MAX_TILES - 1);
  const hiddenCount = images.length - visibleCount;

  return (
    <div className="flex flex-col items-center gap-3 bg-surface p-4 md:flex-1 md:justify-center md:overflow-y-auto">
      <div
        className="relative w-full max-w-xl"
        style={{ aspectRatio: '1 / 1', maxHeight: isMobile ? '45vh' : '55vh' }}
      >
        {/* The viewer stays mounted under the image rather than being swapped
            out for it. It owns the tap-to-load flag and the orbit camera, so
            unmounting it sent a mobile visitor back to "Show 3D" and a fresh
            GLB download every time they looked at a photo. */}
        <GlbViewer
          meshUrl={design.meshUrl}
          posterUrl={poster}
          alt={design.name}
          loadBehavior={isMobile ? 'tap' : 'auto'}
          autoRotate={selected === undefined}
          className="h-full w-full"
        >
          <GradientBackground />
        </GlbViewer>
        {selected !== undefined && (
          <Button
            variant="ghost"
            touchTarget={false}
            onClick={handleEnlarge}
            aria-label={t('community.media.enlarge')}
            className="absolute inset-0 h-full w-full overflow-hidden rounded-lg border border-stroke-subtle bg-surface p-0"
            data-testid="design-media-hero"
          >
            <img
              src={selected.url}
              alt={
                selected.kind === 'render'
                  ? t('community.media.renderAlt', { name: design.name, angle: selected.angle })
                  : t('community.media.photoAlt', { author: selected.authorName })
              }
              className="h-full w-full object-contain"
            />
          </Button>
        )}
      </div>

      {images.length > 0 && (
        <div
          role="group"
          aria-label={t('community.media.filmstripLabel')}
          className="flex w-full max-w-xl items-center gap-2 overflow-x-auto scrollbar-thin"
          data-testid="design-media-filmstrip"
        >
          <Button
            variant="ghost"
            touchTarget={false}
            onClick={() => setSelection({ kind: 'model' })}
            aria-label={t('community.media.model')}
            aria-pressed={selection.kind === 'model'}
            className={cn(
              'relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border p-0',
              selection.kind === 'model' ? 'border-accent' : 'border-stroke-subtle'
            )}
            data-testid="design-media-tile-model"
          >
            {poster !== '' && <img src={poster} alt="" className="h-full w-full object-cover" />}
            <span className="absolute inset-x-0 bottom-0 bg-overlay-dark py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">
              {t('community.media.modelBadge')}
            </span>
          </Button>

          {images.slice(0, visibleCount).map((image, index) => (
            <Button
              // Index-qualified: the server does not dedupe photos, so two
              // prints can carry the same URL and collide as keys.
              key={`${index}-${image.url}`}
              variant="ghost"
              touchTarget={false}
              onClick={() => setSelection({ kind: 'image', index, url: image.url })}
              aria-label={imageLabel(image, t)}
              aria-pressed={
                selected !== undefined && selection.kind === 'image' && selection.index === index
              }
              className={cn(
                'h-20 w-20 shrink-0 overflow-hidden rounded-lg border p-0',
                selection.kind === 'image' && selection.index === index
                  ? 'border-accent'
                  : 'border-stroke-subtle'
              )}
              data-testid={`design-media-tile-${index}`}
            >
              <img src={image.url} alt="" loading="lazy" className="h-full w-full object-cover" />
            </Button>
          ))}

          {hiddenCount > 0 && (
            <Button
              variant="ghost"
              touchTarget={false}
              // Opens on the first image the strip could not show, so nothing
              // is unreachable just because the strip is capped.
              onClick={() => onOpenLightbox(visibleCount)}
              aria-label={t('community.media.moreAria', { count: images.length })}
              className="h-20 w-20 shrink-0 rounded-lg border border-stroke-subtle text-sm font-medium text-content-secondary"
              data-testid="design-media-tile-more"
            >
              {t('community.media.more', { count: hiddenCount })}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

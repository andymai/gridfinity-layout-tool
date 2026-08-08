import { useState } from 'react';
import type { MouseEvent } from 'react';
import { Badge, Button, IconButton, cn } from '@/design-system';
import { useTranslation } from '@/i18n';
import { communityDesignPath } from '@/shared/hooks/useCommunityRouting';
import { useResponsive } from '@/shared/hooks/useResponsive';
import type { CommunityCard as CommunityCardData } from '@/shared/types/community';
import { savePendingLikeAction } from '@/shared/utils/communityPendingLikeAction';
import { useLikeToggle } from '../../hooks/useLikeToggle';
import { CommunitySignInPrompt } from '../SignInPrompt';
import { FEATURE_REASON_KEYS } from '../../utils/featureReasonLabels';
import { formatCardDims } from './cardDims';

export interface CommunityCardProps {
  card: CommunityCardData;
  onSelect: (card: CommunityCardData) => void;
  /** Filters the gallery to this card's author (the author-view entry point). */
  onSelectAuthor?: (card: CommunityCardData) => void;
  index: number;
}

export function HeartGlyph({
  filled = false,
  className = 'h-3 w-3',
}: {
  filled?: boolean;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
      />
    </svg>
  );
}

export function PrintGlyph() {
  return (
    <svg
      aria-hidden="true"
      className="h-3 w-3"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        // A nozzle over a build plate, not a paper printer with a tray and a
        // sheet: this counts 3D prints.
        d="M8.5 3h7l-1.5 6.5h-4Z M12 9.5v4 M4.5 19.5h15"
      />
    </svg>
  );
}

export function RemixGlyph() {
  return (
    <svg
      aria-hidden="true"
      className="h-3 w-3"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 4v5h5M20 20v-5h-5M4 9a8 8 0 0114-3M20 15a8 8 0 01-14 3"
      />
    </svg>
  );
}

function PlaceholderGlyph() {
  return (
    <svg
      aria-hidden="true"
      className="h-8 w-8 text-content-disabled"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-14L4 7m8 4v10M4 7v10l8 4"
      />
    </svg>
  );
}

export function CommunityCard({ card, onSelect, onSelectAuthor, index }: CommunityCardProps) {
  const t = useTranslation();
  const { isMobile } = useResponsive();
  const toggleLike = useLikeToggle();
  const [signInOpen, setSignInOpen] = useState(false);

  const [imageState, setImageState] = useState<'loading' | 'loaded' | 'error'>(
    card.thumbnailUrl === '' ? 'error' : 'loading'
  );

  const animationDelay = `${Math.min(index * 50, 300)}ms`;
  const dims = formatCardDims(card.metrics);
  const liked = card.likedByMe === true;
  const prints = card.counts.prints ?? 0;
  // Looked up rather than indexed blind: a reason retired from the union, or
  // a corrupt stored value, would otherwise hand an undefined key to t().
  const featureReasonKey =
    card.featureReason === undefined ? undefined : FEATURE_REASON_KEYS[card.featureReason];

  const handleLike = (event: MouseEvent<HTMLButtonElement>) => {
    // The heart sits over the title's stretched hit area; without this the
    // click also reaches the link underneath and opens the detail view.
    event.stopPropagation();
    void toggleLike(card).then((outcome) => {
      if (outcome === 'signin-required') setSignInOpen(true);
    });
  };

  // A modified click is the browser's to handle: it opens the design in a new
  // tab from the real href. Only the plain click is ours, and it opens the
  // overlay in place rather than navigating.
  const handleOpen = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
    event.preventDefault();
    onSelect(card);
  };

  return (
    <>
      {/* A plain container, not role="button": the author and heart are real
          nested buttons, and a button may not contain focusable descendants
          (axe nested-interactive). The whole card is still one hit target,
          via the title link's stretched ::after. */}
      <div
        className={cn(
          'group relative flex h-full w-full min-w-0 flex-col items-stretch justify-start',
          'rounded-lg bg-surface-secondary p-2 text-left text-sm font-normal',
          'border-2 border-transparent hover:border-accent/50',
          'transition-colors motion-safe:animate-fade-in-up',
          'has-[a:focus-visible]:border-accent'
        )}
        style={{ animationDelay }}
        data-community-card
      >
        <span className="relative mb-2 flex aspect-square items-center justify-center overflow-hidden rounded bg-surface">
          {imageState !== 'loaded' && (
            <span
              aria-hidden="true"
              data-testid="community-card-placeholder"
              className="absolute inset-0 flex items-center justify-center bg-surface"
            >
              <PlaceholderGlyph />
            </span>
          )}
          {imageState !== 'error' && (
            <img
              src={card.thumbnailUrl}
              alt=""
              loading="lazy"
              draggable={false}
              onLoad={() => setImageState('loaded')}
              onError={() => setImageState('error')}
              className="h-full w-full object-cover"
            />
          )}
          {/* The stated reason replaces a bare star: a pick nobody explained
              is the least legible signal in the gallery. */}
          {card.featured && featureReasonKey !== undefined && (
            <Badge
              tone="overlay"
              size="sm"
              className="absolute left-1 top-1"
              data-testid="community-card-featured"
            >
              {t(featureReasonKey)}
            </Badge>
          )}
          {card.isRemix && (
            <Badge
              tone="overlay"
              size="sm"
              className="absolute right-1 top-1 inline-flex items-center gap-0.5"
              data-testid="community-card-remix-glyph"
            >
              <RemixGlyph />
              <span className="sr-only">{t('community.card.remixBadge')}</span>
            </Badge>
          )}
        </span>

        {/* The ::after covers the card, so the link is the card's hit area and
            its focus ring is the card's border. Everything the user can also
            click sits above it on z-10. */}
        <a
          href={communityDesignPath(card.id)}
          onClick={handleOpen}
          className={cn(
            'block min-w-0 text-sm font-medium leading-tight text-content',
            'after:absolute after:inset-0 after:rounded-md after:content-[""]',
            'focus-visible:outline-none'
          )}
          title={card.name}
          data-testid="community-card-link"
        >
          {/* Truncation lives on the inner span: overflow:hidden on the anchor
              itself would put the stretched ::after at the mercy of
              containing-block clipping. */}
          <span className="block truncate">{card.name}</span>
        </a>

        {onSelectAuthor !== undefined ? (
          <span className="relative z-10 mt-0.5 flex min-w-0">
            <Button
              variant="ghost"
              // 44px hit area on touch layouts, where a mis-tap falls through
              // to the card and opens the detail view instead. The clamp
              // lives on the inner span: line-clamp's -webkit-box would crop
              // the grown touch target.
              touchTarget={isMobile}
              aria-label={t('community.authorFilterAria', { author: card.authorName })}
              onClick={(event) => {
                // Same nested-target rule as the heart: an author tap must
                // not also open the detail view.
                event.stopPropagation();
                onSelectAuthor(card);
              }}
              className="h-auto min-w-0 justify-start p-0 text-xs font-normal text-content-secondary underline-offset-2 hover:underline"
              data-testid="community-card-author"
            >
              {/* truncate, not line-clamp-1: the clamp breaks by line, so a
                  handle with no break opportunity wraps to a line that is then
                  clamped away and the label renders as "by…", naming nobody.
                  Truncation cuts mid-handle instead. */}
              <span className="truncate">
                {t('community.card.byAuthor', { author: card.authorName })}
              </span>
            </Button>
          </span>
        ) : (
          <span className="mt-0.5 truncate text-xs text-content-secondary">
            {t('community.card.byAuthor', { author: card.authorName })}
          </span>
        )}

        {/* Wraps rather than clips. The stat groups are shrink-0 so a narrow
            column takes a second line instead of slicing a count in half; the
            dimensions yield first, being the one part that reads fine
            truncated. The touch-sized heart is what makes this tight. */}
        <span className="relative z-10 mt-1 flex flex-wrap items-center gap-x-1 gap-y-0.5 text-xs text-content-tertiary">
          <span className="min-w-0 truncate">{dims}</span>
          <span aria-hidden="true">·</span>
          <span className="inline-flex shrink-0 items-center gap-0.5">
            <IconButton
              aria-label={t(liked ? 'community.like.unlike' : 'community.like.like')}
              pressed={liked}
              size="sm"
              touchTarget={isMobile}
              onClick={handleLike}
              className={cn(liked && 'text-accent')}
              data-testid="community-card-like"
            >
              <HeartGlyph filled={liked} />
            </IconButton>
            <span aria-hidden="true">{card.counts.likes}</span>
            <span className="sr-only">
              {t('community.card.likesLabel', { count: card.counts.likes })}
            </span>
          </span>
          <span aria-hidden="true">·</span>
          <span className="inline-flex shrink-0 items-center gap-0.5">
            <RemixGlyph />
            <span aria-hidden="true">{card.counts.remixes}</span>
            <span className="sr-only">
              {t('community.card.remixesLabel', { count: card.counts.remixes })}
            </span>
          </span>
          {prints > 0 && (
            <>
              <span aria-hidden="true">·</span>
              {/* Proof-of-print outranks the engagement counts, so it renders
                  in full-strength text where likes and remixes are tertiary. */}
              <span
                className="inline-flex shrink-0 items-center gap-0.5 text-content-secondary"
                data-testid="community-card-prints"
              >
                <PrintGlyph />
                <span aria-hidden="true">{prints}</span>
                <span className="sr-only">
                  {t('community.card.printsLabel', { count: prints })}
                </span>
              </span>
            </>
          )}
        </span>
      </div>

      <CommunitySignInPrompt
        open={signInOpen}
        message={t('community.signin.likeMessage')}
        onClose={() => setSignInOpen(false)}
        onBeforeSignIn={() => savePendingLikeAction({ designId: card.id, liked: !liked })}
      />
    </>
  );
}

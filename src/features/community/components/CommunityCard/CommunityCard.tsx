import { useState } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import { Badge, Button, IconButton, cn } from '@/design-system';
import { useTranslation } from '@/i18n';
import { useResponsive } from '@/shared/hooks/useResponsive';
import type { CommunityCard as CommunityCardData } from '@/shared/types/community';
import { savePendingLikeAction } from '@/shared/utils/communityPendingLikeAction';
import { useLikeToggle } from '../../hooks/useLikeToggle';
import { CommunitySignInPrompt } from '../SignInPrompt';
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

  const handleLike = (event: MouseEvent<HTMLButtonElement>) => {
    // The card root is itself a click target; a heart tap must not also
    // open the detail view.
    event.stopPropagation();
    void toggleLike(card).then((outcome) => {
      if (outcome === 'signin-required') setSignInOpen(true);
    });
  };

  // Only activate on the card surface itself: Enter/Space on the nested
  // heart button bubbles here and must stay a like, not a select.
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(card);
    }
  };

  return (
    <>
      {/* Not a design-system Button: the footer heart is a real nested
          IconButton, and button-in-button is invalid HTML. */}
      <div
        role="button"
        tabIndex={0}
        aria-label={card.name}
        onClick={() => onSelect(card)}
        onKeyDown={handleKeyDown}
        className={cn(
          'group h-auto w-full cursor-pointer select-none flex-col items-stretch justify-start',
          'flex rounded-lg bg-surface-secondary p-2 text-left text-sm font-normal',
          'border-2 border-transparent hover:border-accent/50 hover:bg-surface-secondary',
          'transition-colors motion-safe:animate-fade-in-up',
          'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent'
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

        <span
          className="line-clamp-1 text-sm font-medium leading-tight text-content"
          title={card.name}
        >
          {card.name}
        </span>

        {onSelectAuthor !== undefined ? (
          <span className="mt-0.5 flex min-w-0">
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
              <span className="line-clamp-1">
                {t('community.card.byAuthor', { author: card.authorName })}
              </span>
            </Button>
          </span>
        ) : (
          <span className="mt-0.5 line-clamp-1 text-xs text-content-secondary">
            {t('community.card.byAuthor', { author: card.authorName })}
          </span>
        )}

        <span className="mt-1 flex items-center gap-1 text-xs text-content-tertiary">
          <span>{dims}</span>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-0.5">
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
          <span className="inline-flex items-center gap-0.5">
            <RemixGlyph />
            <span aria-hidden="true">{card.counts.remixes}</span>
            <span className="sr-only">
              {t('community.card.remixesLabel', { count: card.counts.remixes })}
            </span>
          </span>
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

import { useState } from 'react';
import { Badge, Button } from '@/design-system';
import { useTranslation } from '@/i18n';
import type { CommunityCard as CommunityCardData } from '@/shared/types/community';
import { formatCardDims } from './cardDims';

export interface CommunityCardProps {
  card: CommunityCardData;
  onSelect: (card: CommunityCardData) => void;
  index: number;
}

function HeartGlyph() {
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
        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
      />
    </svg>
  );
}

function RemixGlyph() {
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

export function CommunityCard({ card, onSelect, index }: CommunityCardProps) {
  const t = useTranslation();

  const [imageState, setImageState] = useState<'loading' | 'loaded' | 'error'>(
    card.thumbnailUrl === '' ? 'error' : 'loading'
  );

  const animationDelay = `${Math.min(index * 50, 300)}ms`;
  const dims = formatCardDims(card.metrics);

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={() => onSelect(card)}
      className="
        group h-auto w-full select-none flex-col items-stretch justify-start
        rounded-lg bg-surface-secondary p-2 text-left font-normal
        border-2 border-transparent hover:border-accent/50 hover:bg-surface-secondary
        transition-colors motion-safe:animate-fade-in-up
      "
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

      <span className="mt-0.5 line-clamp-1 text-xs text-content-secondary">
        {t('community.card.byAuthor', { author: card.authorName })}
      </span>

      <span className="mt-1 flex items-center gap-1 text-xs text-content-tertiary">
        <span>{dims}</span>
        <span aria-hidden="true">·</span>
        <span className="inline-flex items-center gap-0.5">
          <HeartGlyph />
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
    </Button>
  );
}

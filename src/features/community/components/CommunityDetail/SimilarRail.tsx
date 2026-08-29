import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Button } from '@/design-system';
import { useTranslation } from '@/i18n';
import { useCommunityDetailStore } from '@/core/store/communityDetail';
import type { CommunityCard, CommunityDesign } from '@/shared/types/community';
import { useBrowseStore } from '../../store/browseStore';
import { findSimilarDesigns } from '../../utils/similarDesigns';

interface SimilarRailProps {
  design: CommunityDesign;
}

export function CommunityDesignTile({
  card,
  ariaLabel,
  testId = 'community-similar-tile',
}: {
  card: CommunityCard;
  ariaLabel: string;
  testId?: string;
}) {
  const t = useTranslation();
  const [imageFailed, setImageFailed] = useState(card.thumbnailUrl === '');
  return (
    <Button
      variant="ghost"
      touchTarget={false}
      onClick={() => useCommunityDetailStore.getState().open(card.id, card)}
      aria-label={ariaLabel}
      className="h-auto w-24 shrink-0 flex-col items-stretch gap-1 p-1 text-left font-normal"
      data-testid={testId}
    >
      <span className="block aspect-square w-full overflow-hidden rounded bg-surface-secondary">
        {!imageFailed && (
          <img
            src={card.thumbnailUrl}
            alt=""
            loading="lazy"
            draggable={false}
            onError={() => setImageFailed(true)}
            className="h-full w-full object-cover"
          />
        )}
      </span>
      <span className="line-clamp-1 text-xs text-content" title={card.name}>
        {card.name}
      </span>
      <span className="line-clamp-1 text-label text-content-tertiary">
        {t('community.card.byAuthor', { author: card.authorName })}
      </span>
    </Button>
  );
}

/**
 * Similar designs computed from the already-loaded browse index; renders
 * nothing while the index loads or when no design shares a signal. A cold
 * /community/d/<id> deep link has no index yet, so the rail loads it itself
 * (ensureIndex dedupes against the gallery's own load).
 */
export function SimilarRail({ design }: SimilarRailProps) {
  const t = useTranslation();
  const { items, status } = useBrowseStore(
    useShallow((s) => ({ items: s.items, status: s.status }))
  );
  const ensureIndex = useBrowseStore((s) => s.ensureIndex);

  useEffect(() => {
    void ensureIndex();
  }, [ensureIndex]);

  const similar = useMemo(() => findSimilarDesigns(design, items), [design, items]);

  if (status !== 'ready' || similar.length === 0) return null;

  return (
    <div data-testid="community-similar-rail">
      <h3 className="mb-1 text-sm font-medium text-content">
        {t('community.detail.similarTitle')}
      </h3>
      {/* role="list" restores list semantics that Safari/iOS VoiceOver strips when list-style:none is applied. */}
      <ul
        role="list"
        aria-label={t('community.detail.similarTitle')}
        className="flex list-none gap-2 overflow-x-auto pb-2 scrollbar-thin"
      >
        {similar.map((card) => (
          <li key={card.id} className="shrink-0">
            <CommunityDesignTile
              card={card}
              ariaLabel={t('community.detail.similarItemAria', {
                name: card.name,
                author: card.authorName,
              })}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

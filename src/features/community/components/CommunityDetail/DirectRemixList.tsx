import { useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useTranslation } from '@/i18n';
import { useBrowseStore } from '../../store/browseStore';
import { CommunityDesignTile } from './SimilarRail';

interface DirectRemixListProps {
  designId: string;
  /** Card-hash remix counter, shown in the heading; the loaded index may resolve fewer tiles. */
  remixCount: number;
}

/**
 * The published designs that build directly on this one, resolved from the
 * already-loaded browse index by lineage parentId. The remix counter can
 * exceed the tiles shown: children beyond the index cap (or hidden since)
 * have no card to render, so an explicit fallback line covers the empty case.
 */
export function DirectRemixList({ designId, remixCount }: DirectRemixListProps) {
  const t = useTranslation();
  const { items, status } = useBrowseStore(
    useShallow((s) => ({ items: s.items, status: s.status }))
  );
  const ensureIndex = useBrowseStore((s) => s.ensureIndex);

  useEffect(() => {
    void ensureIndex();
  }, [ensureIndex]);

  const remixes = useMemo(
    () =>
      items
        .filter((card) => card.parentId === designId)
        .sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id)),
    [designId, items]
  );

  if (status !== 'ready') return null;

  return (
    <div data-testid="community-remix-list">
      <h3 className="mb-1 text-sm font-medium text-content">
        {t('community.detail.buildsOnThis', { count: remixCount })}
      </h3>
      {remixes.length === 0 ? (
        <p className="text-sm text-content-tertiary">{t('community.detail.buildsOnEmpty')}</p>
      ) : (
        /* role="list" restores list semantics that Safari/iOS VoiceOver strips when list-style:none is applied. */
        <ul
          role="list"
          aria-label={t('community.detail.buildsOnThis', { count: remixCount })}
          className="flex list-none gap-2 overflow-x-auto pb-2 scrollbar-thin"
        >
          {remixes.map((card) => (
            <li key={card.id} className="shrink-0">
              <CommunityDesignTile
                card={card}
                ariaLabel={t('community.detail.similarItemAria', {
                  name: card.name,
                  author: card.authorName,
                })}
                testId="community-remix-tile"
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

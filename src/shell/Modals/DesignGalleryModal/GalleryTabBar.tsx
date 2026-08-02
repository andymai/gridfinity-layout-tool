import { useRef, useCallback } from 'react';
import { Button } from '@/design-system';
import { useTranslation } from '@/i18n';
import { GALLERY_TAB_ORDER } from './useGalleryTab';
import type { GalleryTabId } from './useGalleryTab';

interface GalleryTabBarProps {
  activeTab: GalleryTabId;
  onTabChange: (tab: GalleryTabId) => void;
  showNewDot: boolean;
}

const TAB_LABEL_KEYS: Record<GalleryTabId, string> = {
  examples: 'binExamples.gallery.tabs.examples',
  community: 'binExamples.gallery.tabs.community',
};

export function GalleryTabBar({ activeTab, onTabChange, showNewDot }: GalleryTabBarProps) {
  const t = useTranslation();
  const tablistRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const currentIndex = GALLERY_TAB_ORDER.indexOf(activeTab);
      const count = GALLERY_TAB_ORDER.length;
      let nextIndex = -1;

      if (e.key === 'ArrowRight') nextIndex = (currentIndex + 1) % count;
      else if (e.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + count) % count;
      else if (e.key === 'Home') nextIndex = 0;
      else if (e.key === 'End') nextIndex = count - 1;

      if (nextIndex >= 0) {
        e.preventDefault();
        onTabChange(GALLERY_TAB_ORDER[nextIndex]);
        const buttons = tablistRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
        buttons?.[nextIndex]?.focus();
      }
    },
    [activeTab, onTabChange]
  );

  return (
    <div
      ref={tablistRef}
      role="tablist"
      aria-label={t('binExamples.gallery.tabs.label')}
      className="flex"
    >
      {GALLERY_TAB_ORDER.map((tab) => {
        const isActive = activeTab === tab;
        const hasNewDot = tab === 'community' && showNewDot;
        return (
          <Button
            key={tab}
            variant="ghost"
            role="tab"
            tabIndex={isActive ? 0 : -1}
            aria-selected={isActive}
            // The dot is visual-only; surface its "new" signal to screen
            // readers through the accessible name while it shows.
            aria-label={
              hasNewDot
                ? `${t(TAB_LABEL_KEYS[tab])} (${t('binExamples.gallery.tabs.newBadge')})`
                : undefined
            }
            aria-controls={isActive ? `gallery-tabpanel-${tab}` : undefined}
            id={`gallery-tab-${tab}`}
            onClick={() => onTabChange(tab)}
            onKeyDown={handleKeyDown}
            className={`min-h-11 rounded-none px-4 py-2.5 text-sm md:min-h-0 ${
              isActive
                ? 'border-b-2 border-accent font-medium text-accent hover:bg-transparent hover:text-accent'
                : 'text-content-tertiary hover:bg-transparent hover:text-content-secondary'
            }`}
          >
            <span>{t(TAB_LABEL_KEYS[tab])}</span>
            {hasNewDot && (
              <span
                aria-hidden="true"
                data-testid="community-new-dot"
                className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-accent"
              />
            )}
          </Button>
        );
      })}
    </div>
  );
}

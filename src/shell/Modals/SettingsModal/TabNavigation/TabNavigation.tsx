import { useRef, useCallback } from 'react';
import { useResponsive } from '@/shared/hooks';
import { useTranslation } from '@/i18n';
import { TAB_DEFINITIONS } from '../tabDefinitions';
import type { SettingsTabId } from '../types';

interface TabNavigationProps {
  activeTab: SettingsTabId;
  onTabChange: (tab: SettingsTabId) => void;
}

export function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  const { isMobile } = useResponsive();
  const t = useTranslation();
  const navRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const currentIndex = TAB_DEFINITIONS.findIndex((tab) => tab.id === activeTab);
      let nextIndex = -1;

      if (isMobile) {
        if (e.key === 'ArrowRight') nextIndex = (currentIndex + 1) % TAB_DEFINITIONS.length;
        else if (e.key === 'ArrowLeft')
          nextIndex = (currentIndex - 1 + TAB_DEFINITIONS.length) % TAB_DEFINITIONS.length;
      } else {
        if (e.key === 'ArrowDown') nextIndex = (currentIndex + 1) % TAB_DEFINITIONS.length;
        else if (e.key === 'ArrowUp')
          nextIndex = (currentIndex - 1 + TAB_DEFINITIONS.length) % TAB_DEFINITIONS.length;
      }

      if (nextIndex >= 0) {
        e.preventDefault();
        const nextTab = TAB_DEFINITIONS[nextIndex];
        onTabChange(nextTab.id);
        // Focus the next tab button
        const buttons = navRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
        buttons?.[nextIndex]?.focus();
      }
    },
    [activeTab, onTabChange, isMobile]
  );

  if (isMobile) {
    return (
      <div
        ref={navRef}
        role="tablist"
        tabIndex={0}
        aria-label={t('settings.title')}
        className="flex overflow-x-auto border-b border-stroke-subtle scrollbar-none"
        onKeyDown={handleKeyDown}
      >
        {TAB_DEFINITIONS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              tabIndex={isActive ? 0 : -1}
              role="tab"
              aria-selected={isActive}
              aria-controls={`settings-tabpanel-${tab.id}`}
              id={`settings-tab-${tab.id}`}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-sm whitespace-nowrap transition-colors flex-shrink-0 ${
                isActive
                  ? 'text-accent border-b-2 border-accent font-medium'
                  : 'text-content-tertiary hover:text-content-secondary'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{t(tab.labelKey)}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      ref={navRef}
      role="tablist"
      tabIndex={0}
      aria-label={t('settings.title')}
      aria-orientation="vertical"
      className="w-40 flex-shrink-0 border-r border-stroke-subtle py-2"
      onKeyDown={handleKeyDown}
    >
      {TAB_DEFINITIONS.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            tabIndex={isActive ? 0 : -1}
            role="tab"
            aria-selected={isActive}
            aria-controls={`settings-tabpanel-${tab.id}`}
            id={`settings-tab-${tab.id}`}
            onClick={() => onTabChange(tab.id)}
            className={`w-full flex items-center gap-2 px-4 py-2 text-sm text-left transition-colors ${
              isActive
                ? 'bg-surface-elevated text-content font-medium border-l-2 border-accent'
                : 'text-content-tertiary hover:text-content-secondary hover:bg-surface-hover'
            }`}
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            <span>{t(tab.labelKey)}</span>
          </button>
        );
      })}
    </div>
  );
}

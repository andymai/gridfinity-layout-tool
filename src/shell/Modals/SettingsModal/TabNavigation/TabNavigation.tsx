import { useRef, useCallback } from 'react';
import { Button } from '@/design-system';
import { useResponsive } from '@/shared/hooks';
import { useTranslation } from '@/i18n';
import { TAB_DEFINITIONS, TAB_GROUPS } from '../tabDefinitions';
import type { SettingsTabId, TabDefinition } from '../types';

interface TabNavigationProps {
  activeTab: SettingsTabId;
  onTabChange: (tab: SettingsTabId) => void;
}

export function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  const { isMobile } = useResponsive();
  const t = useTranslation();
  const navRef = useRef<HTMLDivElement>(null);

  // Arrow-key navigation walks the flattened tab order so it works uniformly
  // across sidebar groups (desktop) and the horizontal scroller (mobile).
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const currentIndex = TAB_DEFINITIONS.findIndex((tab) => tab.id === activeTab);
      const count = TAB_DEFINITIONS.length;
      let nextIndex = -1;

      const forward = isMobile ? 'ArrowRight' : 'ArrowDown';
      const backward = isMobile ? 'ArrowLeft' : 'ArrowUp';

      if (e.key === forward) nextIndex = (currentIndex + 1) % count;
      else if (e.key === backward) nextIndex = (currentIndex - 1 + count) % count;

      if (nextIndex >= 0) {
        e.preventDefault();
        const nextTab = TAB_DEFINITIONS[nextIndex];
        onTabChange(nextTab.id);
        const buttons = navRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
        buttons?.[nextIndex]?.focus();
      }
    },
    [activeTab, onTabChange, isMobile]
  );

  const renderTabButton = (tab: TabDefinition, variant: 'desktop' | 'mobile') => {
    const Icon = tab.icon;
    const isActive = activeTab === tab.id;
    const base = 'rounded-none text-sm';
    const styles =
      variant === 'mobile'
        ? `gap-1.5 px-3 py-2.5 whitespace-nowrap flex-shrink-0 ${
            isActive
              ? 'text-accent border-b-2 border-accent font-medium hover:bg-transparent hover:text-accent'
              : 'text-content-tertiary hover:bg-transparent hover:text-content-secondary'
          }`
        : `justify-start gap-2 px-4 py-2 font-normal ${
            isActive
              ? 'bg-surface-elevated text-content font-medium border-l-2 border-accent hover:bg-surface-elevated hover:text-content'
              : 'text-content-tertiary hover:text-content-secondary hover:bg-surface-hover'
          }`;

    return (
      <Button
        key={tab.id}
        variant="ghost"
        fullWidth={variant === 'desktop'}
        role="tab"
        tabIndex={isActive ? 0 : -1}
        aria-selected={isActive}
        aria-controls={`settings-tabpanel-${tab.id}`}
        id={`settings-tab-${tab.id}`}
        onClick={() => onTabChange(tab.id)}
        className={`${base} ${styles}`}
      >
        <Icon className="h-5 w-5 flex-shrink-0" />
        <span>{t(tab.labelKey)}</span>
      </Button>
    );
  };

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
        {TAB_DEFINITIONS.map((tab) => renderTabButton(tab, 'mobile'))}
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
      className="h-full w-44 flex-shrink-0 overflow-y-auto border-r border-stroke-subtle py-2 scrollbar-thin"
      onKeyDown={handleKeyDown}
    >
      {TAB_GROUPS.map((group) => (
        <div key={group.labelKey} className="mb-2">
          <p className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-content-disabled">
            {t(group.labelKey)}
          </p>
          {group.tabs.map((tab) => renderTabButton(tab, 'desktop'))}
        </div>
      ))}
    </div>
  );
}

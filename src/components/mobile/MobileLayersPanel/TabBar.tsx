/**
 * Reusable tab bar component for mobile panels.
 * Touch-optimized with 44px minimum touch targets.
 */

export type TabId = string;

export interface Tab {
  id: TabId;
  label: string;
}

interface TabBarProps<T extends TabId> {
  tabs: Tab[];
  activeTab: T;
  onChange: (tab: T) => void;
}

export function TabBar<T extends TabId>({ tabs, activeTab, onChange }: TabBarProps<T>) {
  return (
    <div className="flex gap-1 mb-4 bg-surface rounded-lg p-1" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          onClick={() => onChange(tab.id as T)}
          className={`flex-1 py-3 px-4 rounded-md text-sm font-medium transition-colors min-h-[44px] ${
            activeTab === tab.id
              ? 'bg-accent text-white'
              : 'text-content-secondary hover:text-content hover:bg-surface-hover'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

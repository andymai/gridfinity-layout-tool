import { createContext, useCallback, useContext, useId, useRef, type ReactNode } from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '../cn';
import { disabledStyles, focusRing, interactiveTransition } from '../variants';

interface TabsContextValue {
  idPrefix: string;
}

const TabsContext = createContext<TabsContextValue | null>(null);

export function useTabsContext(): TabsContextValue {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('Tabs.Panel must be used within Tabs.Root');
  }
  return context;
}

const tabsListVariants = cva(['flex'], {
  variants: {
    orientation: {
      horizontal: 'flex-row items-center overflow-x-auto scrollbar-none',
      vertical: 'flex-col',
    },
    visual: {
      underline: '',
      rail: '',
      pill: 'gap-1',
    },
    fullWidth: {
      true: 'w-full',
    },
  },
  compoundVariants: [
    { orientation: 'horizontal', visual: 'underline', class: 'border-b border-stroke-subtle' },
    { orientation: 'vertical', visual: 'rail', class: 'border-r border-stroke-subtle py-2' },
  ],
  defaultVariants: {
    orientation: 'horizontal',
    visual: 'underline',
  },
});

const tabVariants = cva(
  [
    'inline-flex items-center gap-1.5',
    'text-sm whitespace-nowrap flex-shrink-0',
    interactiveTransition,
    ...focusRing,
    ...disabledStyles,
  ],
  {
    variants: {
      visual: {
        underline: 'px-3 py-2.5 border-b-2 border-transparent',
        rail: 'w-full justify-start text-left px-4 py-2 border-l-2 border-transparent',
        pill: 'justify-center px-4 py-2 rounded-full min-h-[44px]',
      },
      active: {
        true: 'font-medium',
        false: 'text-content-tertiary hover:text-content-secondary',
      },
      fullWidth: {
        true: 'flex-1 justify-center',
      },
    },
    compoundVariants: [
      { visual: 'underline', active: true, class: 'text-accent border-accent' },
      { visual: 'rail', active: true, class: 'bg-surface-elevated text-content border-accent' },
      { visual: 'rail', active: false, class: 'hover:bg-surface-hover' },
      { visual: 'pill', active: true, class: 'bg-accent text-on-accent' },
      { visual: 'pill', active: false, class: 'hover:bg-surface-hover' },
    ],
    defaultVariants: {
      visual: 'underline',
      active: false,
    },
  }
);

export interface TabsRootProps {
  /**
   * Tabs content: a Tabs.List and its Tabs.Panel siblings.
   */
  children: ReactNode;
}

/**
 * Context provider that wires tab ↔ panel ids (aria-controls / aria-labelledby).
 * Wrap a Tabs.List together with its Tabs.Panel siblings.
 *
 * @example
 * <Tabs.Root>
 *   <Tabs.List tabs={tabs} activeTab={tab} onChange={setTab} aria-label="Settings" />
 *   <Tabs.Panel tabId="general" activeTab={tab}>General settings</Tabs.Panel>
 *   <Tabs.Panel tabId="display" activeTab={tab}>Display settings</Tabs.Panel>
 * </Tabs.Root>
 */
export function TabsRoot({ children }: TabsRootProps) {
  const idPrefix = useId();
  return <TabsContext.Provider value={{ idPrefix }}>{children}</TabsContext.Provider>;
}

export interface TabItem<T extends string> {
  /**
   * Stable tab identifier, passed to onChange.
   */
  id: T;

  /**
   * Tab content: text, icon + label, or icon-only.
   */
  label: ReactNode;

  /**
   * Accessible name for the tab. Required when label is icon-only.
   */
  'aria-label'?: string;

  /**
   * Trailing content such as a count badge.
   */
  badge?: ReactNode;

  /**
   * Whether the tab is disabled. Disabled tabs are skipped by keyboard navigation.
   */
  disabled?: boolean;
}

export interface TabsListProps<T extends string> {
  /**
   * Tabs to render, in order.
   */
  tabs: TabItem<T>[];

  /**
   * Id of the currently selected tab.
   */
  activeTab: T;

  /**
   * Called with the tab id when a tab is selected by click or keyboard.
   */
  onChange: (id: T) => void;

  /**
   * Accessible name for the tablist. Pass a translated string.
   */
  'aria-label': string;

  /**
   * @default 'horizontal'. 'vertical' = side rail (e.g. settings on desktop).
   */
  orientation?: 'horizontal' | 'vertical';

  /**
   * @default 'underline'. underline = border-b-2 accent active; rail = border-l-2 +
   * bg-surface-elevated active, vertical only; pill = rounded solid bg-accent active,
   * 44px-friendly.
   */
  visual?: 'underline' | 'rail' | 'pill';

  /**
   * flex-1 equal-width tabs.
   * @default false
   */
  fullWidth?: boolean;

  /**
   * Additional classes for the tablist container.
   */
  className?: string;
}

/**
 * ARIA tablist with roving tabindex and arrow-key / Home / End navigation.
 * Selection follows focus. Wrap in Tabs.Root to wire panels via aria-controls;
 * without a Root the list still works but renders no aria-controls.
 *
 * @example
 * // Underline tabs (default)
 * <Tabs.List
 *   tabs={[
 *     { id: 'layers', label: 'Layers' },
 *     { id: 'bins', label: 'Bins' },
 *   ]}
 *   activeTab={tab}
 *   onChange={setTab}
 *   aria-label="Panels"
 * />
 *
 * @example
 * // Vertical rail (settings sidebar)
 * <Tabs.List
 *   tabs={tabs}
 *   activeTab={tab}
 *   onChange={setTab}
 *   aria-label="Settings"
 *   orientation="vertical"
 *   visual="rail"
 * />
 *
 * @example
 * // Equal-width pills with a count badge
 * <Tabs.List
 *   tabs={[
 *     { id: 'all', label: 'All', badge: 12 },
 *     { id: 'mine', label: 'Mine', badge: 3 },
 *   ]}
 *   activeTab={tab}
 *   onChange={setTab}
 *   aria-label="Filter"
 *   visual="pill"
 *   fullWidth
 * />
 */
export function TabsList<T extends string>({
  tabs,
  activeTab,
  onChange,
  'aria-label': ariaLabel,
  orientation = 'horizontal',
  visual = 'underline',
  fullWidth = false,
  className,
}: TabsListProps<T>) {
  const context = useContext(TabsContext);
  const localId = useId();
  const idPrefix = context?.idPrefix ?? localId;
  const listRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const enabled = tabs.map((tab, index) => ({ tab, index })).filter(({ tab }) => !tab.disabled);
      if (enabled.length === 0) return;

      const nextKey = orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight';
      const prevKey = orientation === 'vertical' ? 'ArrowUp' : 'ArrowLeft';
      const currentPos = enabled.findIndex(({ tab }) => tab.id === activeTab);

      let nextPos = -1;
      if (e.key === nextKey) nextPos = (currentPos + 1) % enabled.length;
      else if (e.key === prevKey) nextPos = (currentPos - 1 + enabled.length) % enabled.length;
      else if (e.key === 'Home') nextPos = 0;
      else if (e.key === 'End') nextPos = enabled.length - 1;

      if (nextPos < 0) return;
      e.preventDefault();

      const next = enabled[nextPos];
      onChange(next.tab.id);
      const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
      buttons?.[next.index]?.focus();
    },
    [tabs, activeTab, onChange, orientation]
  );

  return (
    <div
      ref={listRef}
      role="tablist"
      tabIndex={-1}
      aria-label={ariaLabel}
      aria-orientation={orientation}
      onKeyDown={handleKeyDown}
      className={cn(tabsListVariants({ orientation, visual, fullWidth }), className)}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${tab.id}`}
            aria-selected={isActive}
            aria-controls={context ? `${idPrefix}-panel-${tab.id}` : undefined}
            aria-label={tab['aria-label']}
            tabIndex={isActive ? 0 : -1}
            disabled={tab.disabled}
            onClick={() => onChange(tab.id)}
            className={cn(tabVariants({ visual, active: isActive, fullWidth }))}
          >
            {tab.label}
            {tab.badge !== undefined && tab.badge !== null && (
              <span className="text-xs tabular-nums">{tab.badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

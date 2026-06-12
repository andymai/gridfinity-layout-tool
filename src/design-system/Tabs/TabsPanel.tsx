import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTabsContext } from './Tabs';

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'a[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export interface TabsPanelProps {
  /**
   * Id of the tab this panel belongs to.
   */
  tabId: string;

  /**
   * Id of the currently selected tab.
   */
  activeTab: string;

  /**
   * Panel content.
   */
  children: ReactNode;

  /**
   * Additional classes for the panel container.
   */
  className?: string;

  /**
   * Keep the panel mounted but hidden when inactive.
   * @default false
   */
  keepMounted?: boolean;
}

/**
 * Content panel wired to a Tabs.List tab. Must be used within Tabs.Root.
 * Unmounts when inactive unless keepMounted; receives tabIndex={0} only
 * when its content has no focusable element.
 *
 * @example
 * <Tabs.Panel tabId="general" activeTab={tab}>
 *   <GeneralSettings />
 * </Tabs.Panel>
 *
 * @example
 * // Preserve form state across tab switches
 * <Tabs.Panel tabId="export" activeTab={tab} keepMounted>
 *   <ExportForm />
 * </Tabs.Panel>
 */
export function TabsPanel({
  tabId,
  activeTab,
  children,
  className,
  keepMounted = false,
}: TabsPanelProps) {
  const { idPrefix } = useTabsContext();
  const panelRef = useRef<HTMLDivElement>(null);
  const [hasFocusable, setHasFocusable] = useState(false);
  const isActive = tabId === activeTab;

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    setHasFocusable(panel.querySelector(FOCUSABLE_SELECTOR) !== null);
  }, [children, isActive]);

  if (!isActive && !keepMounted) return null;

  return (
    <div
      ref={panelRef}
      role="tabpanel"
      id={`${idPrefix}-panel-${tabId}`}
      aria-labelledby={`${idPrefix}-tab-${tabId}`}
      hidden={!isActive}
      tabIndex={hasFocusable ? undefined : 0}
      className={className}
    >
      {children}
    </div>
  );
}

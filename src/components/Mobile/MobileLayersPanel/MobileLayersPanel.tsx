import { useShallow } from 'zustand/shallow';
import { useUIStore } from '@/core/store';
import { useTranslation } from '@/i18n';
import { TabBar } from './TabBar';
import { LayersTab } from './LayersTab';
import { ToolsTab } from './ToolsTab';
import type { MobileLayersTab } from '@/core/store/ui';

/**
 * Mobile-optimized layers panel with tabbed interface.
 *
 * Two tabs:
 * - Layers: Layer list with selection, height controls, reordering, deletion
 * - Tools: Bin palette for paint mode, fill operations
 */
export function MobileLayersPanel() {
  const t = useTranslation();
  const TABS: { id: MobileLayersTab; label: string }[] = [
    { id: 'layers', label: t('common.layers') },
    { id: 'tools', label: t('mobile.tabs.tools') },
  ];

  const { activeTab, setActiveTab } = useUIStore(
    useShallow((state) => ({
      activeTab: state.mobileLayersTab,
      setActiveTab: state.setMobileLayersTab,
    }))
  );

  return (
    <div className="flex flex-col">
      <TabBar tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'layers' ? <LayersTab /> : <ToolsTab />}
      </div>
    </div>
  );
}

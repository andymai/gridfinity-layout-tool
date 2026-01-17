import { useShallow } from 'zustand/shallow';
import { useUIStore } from '../../../store';
import { TabBar } from './TabBar';
import { LayersTab } from './LayersTab';
import { ToolsTab } from './ToolsTab';
import type { MobileLayersTab } from '../../../store/ui';

const TABS: { id: MobileLayersTab; label: string }[] = [
  { id: 'layers', label: 'Layers' },
  { id: 'tools', label: 'Tools' },
];

/**
 * Mobile-optimized layers panel with tabbed interface.
 *
 * Two tabs:
 * - Layers: Layer list with selection, height controls, reordering, deletion
 * - Tools: Bin palette for paint mode, fill operations
 */
export function MobileLayersPanel() {
  const { activeTab, setActiveTab } = useUIStore(
    useShallow((state) => ({
      activeTab: state.mobileLayersTab,
      setActiveTab: state.setMobileLayersTab,
    }))
  );

  return (
    <div className="flex flex-col">
      <TabBar
        tabs={TABS}
        activeTab={activeTab}
        onChange={setActiveTab}
      />
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'layers' ? <LayersTab /> : <ToolsTab />}
      </div>
    </div>
  );
}

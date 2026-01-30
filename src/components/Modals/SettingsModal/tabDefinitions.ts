import { SparklesIcon } from '@/features/labs/components/icons';
import { GlobeIcon, BoxIcon, PlugIcon, ShieldIcon } from './tabIcons';
import type { TabDefinition } from './types';

export const TAB_DEFINITIONS: TabDefinition[] = [
  { id: 'general', labelKey: 'settings.tabs.general', icon: GlobeIcon },
  { id: 'defaults', labelKey: 'settings.tabs.defaults', icon: BoxIcon },
  { id: 'integrations', labelKey: 'settings.tabs.integrations', icon: PlugIcon },
  { id: 'privacy', labelKey: 'settings.tabs.privacy', icon: ShieldIcon },
  { id: 'labs', labelKey: 'settings.tabs.labs', icon: SparklesIcon },
];

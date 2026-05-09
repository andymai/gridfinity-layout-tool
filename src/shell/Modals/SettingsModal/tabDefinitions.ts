import { SparklesIcon } from '@/features/labs/components/icons';
import {
  GlobeIcon,
  PaletteIcon,
  BoxIcon,
  PlugIcon,
  ShieldIcon,
  DatabaseIcon,
  UserIcon,
} from './tabIcons';
import type { TabDefinition } from './types';

export const TAB_DEFINITIONS: TabDefinition[] = [
  { id: 'general', labelKey: 'settings.tabs.general', icon: GlobeIcon },
  { id: 'appearance', labelKey: 'settings.tabs.appearance', icon: PaletteIcon },
  { id: 'account', labelKey: 'settings.tabs.account', icon: UserIcon },
  { id: 'defaults', labelKey: 'settings.tabs.defaults', icon: BoxIcon },
  { id: 'integrations', labelKey: 'settings.tabs.integrations', icon: PlugIcon },
  { id: 'privacy', labelKey: 'settings.tabs.privacy', icon: ShieldIcon },
  { id: 'storage', labelKey: 'settings.tabs.storage', icon: DatabaseIcon },
  { id: 'labs', labelKey: 'settings.tabs.labs', icon: SparklesIcon },
];

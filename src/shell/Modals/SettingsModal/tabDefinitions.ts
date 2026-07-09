import { SparklesIcon } from '@/features/labs/components/icons';
import {
  GlobeIcon,
  PaletteIcon,
  AccessibilityIcon,
  BoxIcon,
  LayerStackIcon,
  TagIcon,
  PlugIcon,
  ShieldIcon,
  DatabaseIcon,
  UserIcon,
} from './tabIcons';
import type { TabDefinition, TabGroup } from './types';

export const TAB_GROUPS: TabGroup[] = [
  {
    labelKey: 'settings.groups.preferences',
    tabs: [
      { id: 'general', labelKey: 'settings.tabs.general', icon: GlobeIcon },
      { id: 'appearance', labelKey: 'settings.tabs.appearance', icon: PaletteIcon },
      { id: 'accessibility', labelKey: 'settings.tabs.accessibility', icon: AccessibilityIcon },
    ],
  },
  {
    labelKey: 'settings.groups.defaults',
    tabs: [
      { id: 'defaults', labelKey: 'settings.tabs.defaults', icon: BoxIcon },
      { id: 'print', labelKey: 'settings.tabs.print', icon: LayerStackIcon },
      { id: 'categories', labelKey: 'settings.tabs.categories', icon: TagIcon },
    ],
  },
  {
    labelKey: 'settings.groups.data',
    tabs: [
      { id: 'account', labelKey: 'settings.tabs.account', icon: UserIcon },
      { id: 'privacy', labelKey: 'settings.tabs.privacy', icon: ShieldIcon },
      { id: 'storage', labelKey: 'settings.tabs.storage', icon: DatabaseIcon },
    ],
  },
  {
    labelKey: 'settings.groups.advanced',
    tabs: [
      { id: 'integrations', labelKey: 'settings.tabs.integrations', icon: PlugIcon },
      { id: 'labs', labelKey: 'settings.tabs.labs', icon: SparklesIcon },
    ],
  },
];

/** Flattened tab list, in sidebar order — the single source of truth for valid tabs. */
export const TAB_DEFINITIONS: TabDefinition[] = TAB_GROUPS.flatMap((group) => group.tabs);

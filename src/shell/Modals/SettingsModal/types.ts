export type SettingsTabId =
  | 'general'
  | 'appearance'
  | 'accessibility'
  | 'defaults'
  | 'print'
  | 'categories'
  | 'account'
  | 'privacy'
  | 'storage'
  | 'integrations'
  | 'labs';

export interface TabDefinition {
  id: SettingsTabId;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
}

export interface TabGroup {
  /** i18n key for the group header shown above its tabs in the sidebar. */
  labelKey: string;
  tabs: TabDefinition[];
}

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: SettingsTabId;
}

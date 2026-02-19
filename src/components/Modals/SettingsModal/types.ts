export type SettingsTabId =
  | 'general'
  | 'appearance'
  | 'defaults'
  | 'integrations'
  | 'privacy'
  | 'storage'
  | 'labs';

export interface TabDefinition {
  id: SettingsTabId;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
}

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: SettingsTabId;
}

export type RiskLevel = 'low' | 'medium' | 'high';

export interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  risk: RiskLevel;
  warning?: string;
}

export interface LabsPreferences {
  enabledFeatures: Record<string, boolean>;
  lastModified: string;
  version: number;
}

export function createDefaultLabsPreferences(): LabsPreferences {
  return {
    enabledFeatures: {},
    lastModified: new Date().toISOString(),
    version: 1,
  };
}

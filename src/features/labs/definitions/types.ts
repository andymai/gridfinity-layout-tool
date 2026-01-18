export type FeatureStatus =
  | 'experimental' // Active experiment, may have bugs
  | 'preview' // More stable, nearing graduation
  | 'graduated' // Now available to everyone
  | 'deprecated'; // Being phased out

export type RiskLevel = 'low' | 'medium' | 'high';

export interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  status: FeatureStatus;
  risk: RiskLevel;
  warning?: string;
  learnMoreUrl?: string;
  addedAt: string;
  graduatedAt?: string;
  requiresRefresh: boolean;
  dependencies?: string[];
  comingSoon?: boolean;
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

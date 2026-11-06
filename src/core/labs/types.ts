export type FeatureStatus =
  | 'experimental' // Active experiment, may have bugs
  | 'preview'; // More stable, nearing graduation

export type RiskLevel = 'low' | 'medium' | 'high';

export interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  status: FeatureStatus;
  risk: RiskLevel;
  warning?: string;
  /**
   * On for everyone who has not decided otherwise, while the feature stays
   * listed in Labs and stays switchable off.
   */
  defaultEnabled?: boolean;
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

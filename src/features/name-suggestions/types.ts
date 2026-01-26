/**
 * Types for intelligent layout name suggestions.
 */

// Re-export DEFAULT_LAYOUT_NAME from central constants for convenience
export { DEFAULT_LAYOUT_NAME } from '@/core/constants';

/**
 * Source of a name suggestion.
 */
export type SuggestionSource =
  | 'labels' // Derived from bin labels and their domains
  | 'categories' // Based on dominant category names
  | 'purpose' // From drawer purpose inference
  | 'dimensions' // Based on drawer size
  | 'server_ml'; // Future: server-side ML model

/**
 * A single name suggestion with metadata.
 */
export interface NameSuggestion {
  /** The suggested name */
  name: string;
  /** Source of this suggestion */
  source: SuggestionSource;
  /** Confidence score (0-1) */
  confidence: number;
}

/**
 * Result of suggestion generation.
 */
export interface SuggestionResult {
  /** Primary (highest confidence) suggestion */
  primary: NameSuggestion | null;
  /** Alternative suggestions (up to 3) */
  alternatives: NameSuggestion[];
  /** Timestamp of generation */
  timestamp: number;
}

/**
 * Current state of the suggestion system.
 */
export type SuggestionStatus =
  | 'idle' // Not enough data or already named
  | 'ready' // Suggestions available, highlight should show
  | 'dismissed' // User dismissed for this session
  | 'accepted'; // User accepted a suggestion

/**
 * Input data for suggestion generation.
 */
export interface SuggestionInput {
  /** All non-empty bin labels (from on-grid bins only) */
  labels: string[];
  /** Category names with bin counts */
  categories: CategoryCount[];
  /** Drawer dimensions */
  drawer: DrawerDimensions;
  /** Inferred drawer purpose (from purposeInference.ts) */
  purpose: string | null;
  /** User's locale for localized suggestions */
  locale: string;
  /** Existing layout names in library (to avoid duplicates) */
  existingNames?: string[];
}

export interface CategoryCount {
  name: string;
  count: number;
}

export interface DrawerDimensions {
  width: number;
  depth: number;
  height: number;
}

/**
 * Telemetry event for suggestion tracking.
 */
export interface SuggestionTelemetryEvent {
  /** User action */
  action: 'shown' | 'accepted' | 'edited' | 'dismissed';
  /** Hash of the suggested name (privacy-preserving) */
  suggestionHash: string;
  /** Source of the suggestion */
  source: SuggestionSource;
  /** Confidence of the suggestion */
  confidence: number;
  /** Hash of the final name if edited */
  finalNameHash?: string;
  /** Levenshtein distance if user edited the suggestion */
  editDistance?: number;
  /** Which suggestion (0 = primary, 1+ = alternative) */
  suggestionIndex: number;
  /** How the user triggered suggestions */
  triggerSource: 'auto' | 'command' | 'menu';
}

/**
 * Minimum labeled bins required to show suggestions.
 */
export const SUGGESTION_THRESHOLD = 5;

/**
 * Confidence threshold for showing inline ghost text.
 * Below this threshold, we show the highlight + badge instead.
 */
export const HIGH_CONFIDENCE_THRESHOLD = 0.7;

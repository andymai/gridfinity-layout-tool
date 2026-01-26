/**
 * Shared types for the name suggestion API.
 *
 * These types are used by both the client (src/core/api/suggestName.ts)
 * and server (api/suggest-name.ts, api/lib/llm.ts) to ensure consistency.
 *
 * Note: This file is the source of truth. Server code imports from here
 * via relative path, client code uses the @/ alias.
 */

/**
 * Request payload for name suggestion API.
 * POST /api/suggest-name
 */
export interface SuggestNameRequest {
  /** Bin labels (max 50, each max 100 chars) */
  labels: string[];
  /** Drawer dimensions in grid units */
  drawerSize: { w: number; d: number; h: number };
  /** User's locale (en, de, es, fr, nl, pt-BR) */
  locale: string;
  /** Optional inferred purpose (e.g., "Tools", "Electronics") */
  purpose?: string;
  /** Optional English suggestions to localize (improves quality) */
  hints?: string[];
}

/**
 * A single LLM-generated name suggestion.
 * Uses 'server_ml' to match client-side SuggestionSource type.
 */
export interface LLMSuggestion {
  /** The suggested name */
  name: string;
  /** Source identifier - matches SuggestionSource type */
  source: 'server_ml';
}

/**
 * Response from name suggestion API.
 */
export interface SuggestNameResponse {
  /** Array of name suggestions (max 5) */
  suggestions: LLMSuggestion[];
  /** Whether this was a cache hit */
  cached: boolean;
}

/**
 * Error response from name suggestion API.
 */
export interface SuggestNameErrorResponse {
  /** Error message */
  error: string;
  /** Error code from ErrorCode enum */
  code: string;
  /** Seconds until rate limit resets (if rate limited) */
  retryAfter?: number;
}

/**
 * Supported locales for name suggestions.
 */
export const SUPPORTED_LOCALES = ['en', 'de', 'es', 'fr', 'nl', 'pt-BR'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

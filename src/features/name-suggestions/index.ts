/**
 * Name Suggestions Feature
 *
 * Provides intelligent layout name suggestions based on bin labels,
 * categories, and drawer dimensions.
 *
 * @example
 * ```tsx
 * import { NameFieldHighlight } from '@/features/name-suggestions';
 *
 * // Wrap the layout name input
 * <NameFieldHighlight>
 *   <button>{layoutName}</button>
 * </NameFieldHighlight>
 * ```
 */

// Components
export { NameFieldHighlight, SuggestionPopover } from './components';

// Hooks
export { useNameSuggestions, useSuggestionTrigger } from './hooks';
export type { UseNameSuggestionsReturn } from './hooks';

// Store
export { useNameSuggestionStore } from './store';

// Utils (generateSuggestions is lazy-loaded, not exported from barrel)
export { hashName, editDistance } from './utils';

// Types
export type {
  NameSuggestion,
  SuggestionResult,
  SuggestionInput,
  SuggestionSource,
  SuggestionStatus,
  SuggestionTelemetryEvent,
} from './types';
export { SUGGESTION_THRESHOLD, DEFAULT_LAYOUT_NAME } from './types';

// API Types (shared between client and server)
export type {
  SuggestNameRequest,
  SuggestNameResponse,
  LLMSuggestion,
  SuggestNameErrorResponse,
  SupportedLocale,
} from './api-types';
export { SUPPORTED_LOCALES } from './api-types';

/**
 * LLM utilities for name suggestion generation.
 * Uses Vercel AI SDK with AI Gateway.
 *
 * Note: Types here must stay in sync with src/features/name-suggestions/api-types.ts
 * The server cannot import from src/ due to module resolution differences.
 */

import { createHash } from 'crypto';
import { generateText, Output } from 'ai';
import { gateway } from '@ai-sdk/gateway';
import { z } from 'zod';

/**
 * Request schema for name suggestion.
 * Keep in sync with SuggestNameRequest in src/features/name-suggestions/api-types.ts
 */
export interface NameSuggestionRequest {
  labels: string[];
  drawerSize: { w: number; d: number; h: number };
  locale: string;
  purpose?: string;
  /** Optional English suggestions to localize (improves quality) */
  hints?: string[];
}

/**
 * Response schema for name suggestion.
 */
export interface NameSuggestionResponse {
  names: string[];
}

/**
 * Locale display names for the prompt.
 */
const LOCALE_NAMES: Record<string, string> = {
  en: 'English',
  de: 'German',
  es: 'Spanish',
  fr: 'French',
  nl: 'Dutch',
  'pt-BR': 'Brazilian Portuguese',
};

/**
 * Get the language name for a locale code.
 */
function getLanguageName(locale: string): string {
  // Try exact match first
  if (LOCALE_NAMES[locale]) {
    return LOCALE_NAMES[locale];
  }
  // Try base language (e.g., "en-US" -> "en")
  const baseLocale = locale.split('-')[0];
  return LOCALE_NAMES[baseLocale] || 'English';
}

/**
 * Sanitize a string to prevent prompt injection.
 * Only allows alphanumeric, spaces, and common punctuation.
 */
function sanitizeForPrompt(text: string, maxLength: number): string {
  // Remove any control characters and limit to safe characters
  return text
    .replace(/[^\w\s\-.,&()#×x/]/g, '') // Allow common label chars like M3x8, #4, 1/4"
    .slice(0, maxLength)
    .trim();
}

/**
 * Sanitize purpose string to prevent prompt injection.
 */
function sanitizePurpose(purpose: string): string {
  return sanitizeForPrompt(purpose, 50);
}

/**
 * Sanitize label to prevent prompt injection.
 * Labels go directly into the prompt, so must be sanitized.
 */
function sanitizeLabel(label: string): string {
  return sanitizeForPrompt(label, 50);
}

/**
 * Sanitize hint names to prevent prompt injection.
 */
function sanitizeHint(hint: string): string {
  return sanitizeForPrompt(hint, 40);
}

/**
 * Build the LLM prompt for name generation.
 * When hints (English suggestions) are provided, focuses on localization.
 */
function buildPrompt(request: NameSuggestionRequest): string {
  const { labels, drawerSize, locale, purpose, hints } = request;
  const languageName = getLanguageName(locale);

  // Limit and sanitize labels to prevent prompt injection and reduce tokens
  const safeLabels = labels
    .slice(0, 20) // Reduced from 30 to save tokens
    .map(sanitizeLabel)
    .filter((l) => l.length > 0);

  // Sanitize purpose and hints to prevent prompt injection
  const safePurpose = purpose ? sanitizePurpose(purpose) : null;
  const safeHints = hints
    ?.slice(0, 5)
    .map(sanitizeHint)
    .filter((h) => h.length > 0);

  // If we have hints, use a localization-focused prompt (more efficient)
  if (safeHints && safeHints.length > 0) {
    return `Localize these drawer names to ${languageName}:
${safeHints.map((h, i) => `${i + 1}. ${h}`).join('\n')}

Context: ${safeLabels.slice(0, 10).join(', ')}
${safePurpose ? `Purpose: ${safePurpose}` : ''}

Create natural ${languageName} equivalents (not literal translations).
Keep the meaning and tone. Max 40 chars each.`;
  }

  // No hints - generate from scratch
  return `Name a Gridfinity drawer organizer in ${languageName}.

Contents: ${safeLabels.join(', ')}
${safePurpose ? `Purpose: ${safePurpose}` : ''}
Size: ${drawerSize.w}×${drawerSize.d} units

Generate 5 names (1-4 words, max 40 chars).
Mix practical and playful. Sound native, not translated.`;
}

/**
 * Generate name suggestions using LLM.
 * Returns an array of suggested names.
 */
export async function generateNameSuggestions(
  request: NameSuggestionRequest
): Promise<NameSuggestionResponse> {
  const prompt = buildPrompt(request);

  const result = await generateText({
    model: gateway('openai/gpt-4o-mini'),
    output: Output.object({
      schema: z.object({
        names: z.array(z.string().max(40)).min(1).max(5), // Enforce max length in schema
      }),
    }),
    prompt,
    maxOutputTokens: 100, // Reduced from 200 - 5 short names need ~50-60 tokens
    temperature: 0.7, // Some creativity but not too random
  });

  return result.output;
}

/**
 * Create a cache key for the request.
 * Uses SHA-256 to avoid hash collisions.
 */
export function createCacheKey(request: NameSuggestionRequest): string {
  // Sort labels for consistent hashing
  const sortedLabels = [...request.labels].sort().join('|');
  const size = `${request.drawerSize.w}x${request.drawerSize.d}x${request.drawerSize.h}`;

  // Create deterministic string representation
  const str = `${sortedLabels}:${size}:${request.locale}:${request.purpose || ''}`;

  // Use SHA-256 for collision-resistant hashing
  const hash = createHash('sha256').update(str).digest('hex').slice(0, 16);
  return `suggest-name:${hash}`;
}

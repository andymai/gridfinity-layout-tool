/**
 * API endpoint for LLM-powered layout name suggestions.
 *
 * POST /api/suggest-name
 * - Accepts bin labels, drawer size, locale, and optional purpose
 * - Returns culturally-appropriate name suggestions
 * - Caches results in Redis for 7 days
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { APICallError } from 'ai';
import { checkRateLimit, getClientIP, getRedis } from './lib/rateLimit.js';
import { generateNameSuggestions, createCacheKey, type NameSuggestionRequest } from './lib/llm.js';
import { ErrorCode, methodNotAllowed } from './lib/shared.js';

/** Cache TTL: 7 days in seconds */
const CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;

/** Supported locales */
const SUPPORTED_LOCALES = ['en', 'de', 'es', 'fr', 'nl', 'pt-BR'];

/**
 * Validate the request body.
 */
function validateRequest(
  body: unknown
): { valid: true; request: NameSuggestionRequest } | { valid: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body is required' };
  }

  const { labels, drawerSize, locale, purpose } = body as Record<string, unknown>;

  // Validate labels
  if (!Array.isArray(labels)) {
    return { valid: false, error: 'labels must be an array of strings' };
  }
  if (labels.length === 0) {
    return { valid: false, error: 'At least one label is required' };
  }
  if (labels.length > 50) {
    return { valid: false, error: 'Maximum 50 labels allowed' };
  }
  if (!labels.every((l) => typeof l === 'string' && l.length <= 100)) {
    return { valid: false, error: 'Each label must be a string of max 100 characters' };
  }

  // Validate drawer size
  if (!drawerSize || typeof drawerSize !== 'object') {
    return { valid: false, error: 'drawerSize is required' };
  }
  const { w, d, h } = drawerSize as Record<string, unknown>;
  if (typeof w !== 'number' || typeof d !== 'number' || typeof h !== 'number') {
    return { valid: false, error: 'drawerSize must have numeric w, d, h properties' };
  }
  if (w < 1 || w > 50 || d < 1 || d > 50 || h < 1 || h > 100) {
    return { valid: false, error: 'Invalid drawer dimensions' };
  }

  // Validate locale
  if (typeof locale !== 'string') {
    return { valid: false, error: 'locale is required' };
  }
  // Accept base locale or full locale (e.g., "en" or "en-US")
  const baseLocale = locale.split('-')[0];
  const normalizedLocale = SUPPORTED_LOCALES.includes(locale)
    ? locale
    : SUPPORTED_LOCALES.includes(baseLocale)
      ? baseLocale
      : 'en';

  // Validate purpose (optional)
  const validPurpose = typeof purpose === 'string' && purpose.length <= 100 ? purpose : undefined;

  return {
    valid: true,
    request: {
      labels: labels as string[],
      drawerSize: { w: w, d: d, h: h },
      locale: normalizedLocale,
      purpose: validPurpose,
    },
  };
}

/** Allowed origins for the API (production + preview deployments) */
const ALLOWED_ORIGINS = [
  'https://gridfinity.xyz',
  'https://www.gridfinity.xyz',
  /^https:\/\/gridfinity-layout-tool-.*\.vercel\.app$/,
];

/**
 * Check if the request origin is allowed.
 * Returns true for allowed origins, localhost (dev), or if no origin (same-origin).
 */
function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true; // Same-origin requests don't have Origin header
  if (origin.startsWith('http://localhost:')) return true; // Dev
  return ALLOWED_ORIGINS.some((allowed) =>
    typeof allowed === 'string' ? origin === allowed : allowed.test(origin)
  );
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return methodNotAllowed(res, 'POST');
  }

  // Check origin to prevent abuse from unauthorized sites
  const origin = req.headers.origin;
  if (!isAllowedOrigin(origin)) {
    return res.status(403).json({ error: 'Forbidden', code: ErrorCode.VALIDATION_ERROR });
  }

  try {
    // Rate limiting (dedicated tier for expensive LLM calls)
    const clientIP = getClientIP(req);
    const rateLimit = await checkRateLimit(clientIP, 'suggest');

    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: 'Too many requests. Try again later.',
        code: ErrorCode.RATE_LIMITED,
        retryAfter: rateLimit.retryAfterSeconds,
      });
    }

    // Validate request
    const validation = validateRequest(req.body);
    if (!validation.valid) {
      const { error } = validation;
      return res.status(400).json({
        error,
        code: ErrorCode.VALIDATION_ERROR,
      });
    }

    const request = validation.request;
    const cacheKey = createCacheKey(request);

    // Check cache first
    const redis = getRedis();
    try {
      if (redis) {
        const raw = await redis.get(cacheKey);
        if (raw) {
          const cached = JSON.parse(raw) as { names: string[] };
          if (cached.names.length > 0) {
            return res.status(200).json({
              suggestions: cached.names.map((name: string) => ({
                name,
                source: 'server_ml' as const,
              })),
              cached: true,
            });
          }
        }
      }
    } catch {
      // Cache read failed, continue without cache
    }

    // Generate suggestions via LLM
    const result = await generateNameSuggestions(request);

    // Cache the result
    try {
      if (redis) {
        await redis.set(cacheKey, JSON.stringify({ names: result.names }), 'EX', CACHE_TTL_SECONDS);
      }
    } catch {
      // Cache write failed, continue without caching
    }

    return res.status(200).json({
      suggestions: result.names.map((name: string) => ({
        name,
        source: 'server_ml' as const,
      })),
      cached: false,
    });
  } catch (error) {
    // Handle LLM-specific errors
    if (error instanceof APICallError) {
      console.error('LLM API error:', error.message, error.statusCode);

      if (error.statusCode === 429) {
        return res.status(503).json({
          error: 'AI service temporarily unavailable. Try again later.',
          code: ErrorCode.SERVICE_UNAVAILABLE,
        });
      }

      if (error.statusCode === 401 || error.statusCode === 403) {
        console.error('LLM authentication error - check OPENAI_API_KEY');
        return res.status(503).json({
          error: 'AI service configuration error.',
          code: ErrorCode.SERVICE_UNAVAILABLE,
        });
      }
    }

    // Log error for debugging (avoid logging user data)
    console.error(
      'Name suggestion error:',
      error instanceof Error ? error.message : 'Unknown error'
    );

    return res.status(500).json({
      error: 'Failed to generate name suggestions',
      code: ErrorCode.SERVER_ERROR,
    });
  }
}

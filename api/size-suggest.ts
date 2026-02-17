/**
 * API endpoint for ML-powered bin size suggestions.
 *
 * POST /api/size-suggest
 * - Accepts drawer dimensions, placed bins, and optional label
 * - Returns ranked size suggestions with optimal positions
 * - Caches results in Redis for 60 seconds
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkRateLimit, getClientIP, getRedis } from './lib/rateLimit.js';
import { ErrorCode, methodNotAllowed } from './lib/shared.js';
import { scoreSizes, rankPositions } from './lib/sizeSuggest.js';
import type { FreqMap, OccupiedRect } from './lib/sizeSuggest.js';

/** Cache TTL: 60 seconds */
const CACHE_TTL_SECONDS = 60;

/** Maximum bins we'll process */
const MAX_BINS = 500;

interface SuggestRequestBody {
  drawer: { width: number; depth: number };
  bins: Array<{ width: number; depth: number; x: number; y: number; label?: string }>;
}

function validateRequest(
  body: unknown
): { valid: true; request: SuggestRequestBody } | { valid: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body is required' };
  }

  const { drawer, bins } = body as Record<string, unknown>;

  if (!drawer || typeof drawer !== 'object') {
    return { valid: false, error: 'drawer is required' };
  }

  const { width, depth } = drawer as Record<string, unknown>;
  if (typeof width !== 'number' || typeof depth !== 'number' || width <= 0 || depth <= 0) {
    return { valid: false, error: 'drawer.width and drawer.depth must be positive numbers' };
  }

  if (!Array.isArray(bins)) {
    return { valid: false, error: 'bins must be an array' };
  }

  if (bins.length > MAX_BINS) {
    return { valid: false, error: `bins array exceeds maximum of ${MAX_BINS}` };
  }

  return {
    valid: true,
    request: {
      drawer: { width: width, depth: depth },
      bins: bins as SuggestRequestBody['bins'],
    },
  };
}

function buildCacheKey(body: SuggestRequestBody): string {
  const drawerKey = `${body.drawer.width}x${body.drawer.depth}`;
  const binSizes = body.bins
    .map((b) => `${b.width}x${b.depth}`)
    .sort()
    .join(',');
  return `size-suggest:${drawerKey}:${binSizes}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    methodNotAllowed(res, 'POST');
    return;
  }

  const ip = getClientIP(req);
  const redis = getRedis();
  const rateLimitResult = await checkRateLimit(redis, ip, 'size-suggest', 100, 60);
  if (!rateLimitResult.allowed) {
    res.status(429).json({
      error: 'Rate limit exceeded',
      code: ErrorCode.RATE_LIMITED,
      retryAfter: rateLimitResult.retryAfter,
    });
    return;
  }

  const validation = validateRequest(req.body);
  if (!validation.valid) {
    res.status(400).json({ error: validation.error, code: ErrorCode.VALIDATION_ERROR });
    return;
  }

  const { request } = validation;

  // Check cache
  const cacheKey = buildCacheKey(request);
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      res.status(200).json(typeof cached === 'string' ? JSON.parse(cached) : cached);
      return;
    }
  } catch {
    // Cache miss or error — continue to compute
  }

  // Build telemetry keys
  const drawerKey = `${request.drawer.width}x${request.drawer.depth}`;
  const lastBin = request.bins[request.bins.length - 1];
  const prevKey = lastBin ? `${lastBin.width}x${lastBin.depth}` : null;

  const labels = request.bins
    .map((b) => b.label)
    .filter((l): l is string => typeof l === 'string' && l.length > 0);
  const uniqueLabels = [...new Set(labels)];

  // Parallel Redis queries
  const [drawerFreqRaw, transitionFreqRaw, correctionFreqRaw, ...labelFreqRaws] = await Promise.all(
    [
      redis.hgetall(`ml:drawer:${drawerKey}`).catch(() => null),
      prevKey ? redis.hgetall(`ml:trans:${prevKey}`).catch(() => null) : Promise.resolve(null),
      redis.hgetall('ml:neg:corrected_sizes').catch(() => null),
      ...uniqueLabels.map((label) => redis.hgetall(`ml:label_hash:${label}`).catch(() => null)),
    ]
  );

  const toFreqMap = (raw: Record<string, string> | null): FreqMap => {
    if (!raw) return {};
    const map: FreqMap = {};
    for (const [key, val] of Object.entries(raw)) {
      const num = parseFloat(val);
      if (Number.isFinite(num)) {
        map[key] = num;
      }
    }
    return map;
  };

  // Merge label frequency maps
  const mergedLabelFreq: FreqMap = {};
  for (const rawMap of labelFreqRaws) {
    const freq = toFreqMap(rawMap);
    for (const [key, val] of Object.entries(freq)) {
      mergedLabelFreq[key] = (mergedLabelFreq[key] ?? 0) + val;
    }
  }

  const scoredSizes = scoreSizes({
    drawerFreq: toFreqMap(drawerFreqRaw),
    transitionFreq: toFreqMap(transitionFreqRaw),
    labelFreq: mergedLabelFreq,
    correctionFreq: toFreqMap(correctionFreqRaw),
  });

  // Build occupied rects from request bins
  const occupied: OccupiedRect[] = request.bins.map((b) => ({
    x: b.x,
    y: b.y,
    width: b.width,
    depth: b.depth,
  }));

  const suggestions = scoredSizes.map((scored) => {
    const position = rankPositions(scored.size, occupied, request.drawer, null);
    return {
      size: scored.size,
      score: scored.score,
      position,
      positionSource: position ? 'scan' : 'none',
    };
  });

  const response = { suggestions, source: 'telemetry' };

  try {
    await redis.set(cacheKey, JSON.stringify(response), { ex: CACHE_TTL_SECONDS });
  } catch {
    // Cache write failure is not fatal
  }

  res.status(200).json(response);
}

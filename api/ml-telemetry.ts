/**
 * ML Telemetry API Endpoint
 *
 * Receives batched telemetry events from clients and aggregates into Redis counters.
 * No raw events are stored - only aggregate counts for ML training.
 *
 * Redis Schema:
 *
 * === Bin Placement ===
 * - ml:sizes                  -> Global bin size frequency
 * - ml:trans:{prev}           -> Transition matrix (prev_size -> next_size)
 * - ml:drawer:{size}          -> Bin sizes per drawer size
 * - ml:label_hash:{hash}      -> Bin sizes per label hash (PRIMARY - any language, all events)
 * - ml:label_hash_high:{hash} -> Bin sizes per label hash, restricted to high-quality snapshots
 *                                (training source for the bin-size recommender; 90d TTL)
 * - ml:label:{normalized}     -> Bin sizes per normalized label (ENRICHMENT)
 * - ml:label_domain:{domain}  -> Bin sizes per domain category (FALLBACK)
 * - ml:cat:{category}         -> Bin sizes per category
 * - ml:gapfit:{fit}           -> Bin sizes per gap fit type
 * - ml:method:{method}        -> Bin sizes per placement method
 * - ml:unknown_hashes         -> Popular unknown label hashes (for vocab expansion)
 *
 * === Layout Snapshots ===
 * - ml:drawer_sizes:{drawer}  -> Bin size distribution by drawer size
 * - ml:domains:{drawer}       -> Domain distribution by drawer size
 * - ml:cooccur:{hash}         -> Label co-occurrence matrix
 * - ml:triggers               -> Snapshot trigger distribution
 * - ml:purpose:{purpose}      -> Drawer purpose frequency
 * - ml:purpose_sizes:{purpose} -> Bin sizes by drawer purpose
 *
 * === Quality Signals ===
 * - ml:quality:{signal}       -> Quality signal counts
 * - ml:quality_layouts        -> Layouts by quality signal type
 * - ml:quality_confidence     -> Confidence score distribution buckets
 * - ml:quality_conf_by_signal:{signal} -> Confidence by signal type
 * - ml:quality_score:{score_name} -> Individual score distributions (undo, completion, session, correction)
 * - ml:abandonment            -> Abandonment type distribution (incomplete, deleted, dormant, superseded)
 * - ml:abandonment_age:{type} -> Abandonment by layout age
 * - ml:quality_dormancy       -> Time since last edit buckets (active, recent, idle, dormant)
 *
 * === Category Changes ===
 * - ml:cat_sizes:{cat_hash}   -> Bin sizes assigned to each category (by name hash)
 * - ml:label_cat:{label_hash} -> Which categories labeled items are assigned to
 * - ml:domain_cat:{domain}    -> Category assignments by label domain
 * - ml:cat_changes            -> Total category change event count
 *
 * === Bin Resizes ===
 * - ml:resize:{old_size}      -> Resize transition matrix (old -> new size)
 * - ml:resize_dims            -> Which dimensions are resized (width/depth)
 * - ml:resizes                -> Total resize event count
 * - ml:resize_results         -> Distribution of resulting sizes after resize
 *
 * === Bin Deletions (Negative Signal) ===
 * - ml:neg:deleted_sizes      -> Size distribution of deleted bins (negative signal)
 * - ml:neg:delete_methods     -> Deletion method distribution (key/context_menu/bulk/inspector)
 * - ml:neg:delete_labeled     -> Labeled vs unlabeled deletion rate
 * - ml:neg:delete_domain:{domain} -> Deleted sizes by label domain
 * - ml:neg:deletions          -> Total deletion event count
 *
 * === Bin Moves ===
 * - ml:moved_sizes            -> Size distribution of moved bins
 * - ml:move_methods           -> Move method distribution (drag/nudge)
 * - ml:move_distances         -> Move distance buckets (micro/short/medium/long)
 * - ml:moves                  -> Total move event count
 *
 * === Placement Rejections (Negative Signal) ===
 * - ml:rejections             -> Total rejection count by reason
 * - ml:reject_modes           -> Rejection count by draw/paint mode
 * - ml:reject_sizes           -> Intended sizes that were rejected
 * - ml:neg:reject_by_drawer:{size} -> Rejected sizes by drawer size
 *
 * === Undo Events (Negative Signal) ===
 * - ml:neg:undos              -> Total undo count by action type
 * - ml:neg:undo_timing        -> Undo timing buckets (immediate/quick/delayed)
 * - ml:neg:undo_action_timing -> Action + timing combos (e.g., placement_immediate)
 * - ml:neg:undo_scale         -> Undo scale (single/few/many/bulk bins)
 *
 * === Quick Corrections (Negative Signal - STRONGEST) ===
 * - ml:neg:quick_corrections  -> Total quick correction count by type
 * - ml:neg:corrected_sizes    -> Sizes that get quickly corrected (BAD sizes)
 * - ml:neg:correct_by_method:{method} -> Corrections by placement method
 * - ml:neg:correction_timing  -> How fast corrections happen
 * - ml:neg:resize_correct:{size} -> What users resize corrected bins to
 *
 * === Session Summary ===
 * - ml:session:bins_placed    -> Histogram of bins placed per session
 * - ml:session:edit_ratio     -> Edit-to-done ratio buckets (zero/low/medium/high)
 * - ml:session:time_to_first  -> Time to first bin buckets (quick/normal/slow/very_slow)
 * - ml:session:confidence     -> Confidence score distribution
 * - ml:session:duration       -> Session duration buckets
 * - ml:size_seq:{drawer}      -> Common size sequences by drawer
 * - ml:session:undo_count     -> Undo count distribution
 * - ml:session:conf_by_drawer:{size} -> Confidence by drawer size
 * - ml:session:totals         -> Total session counts
 *
 * === Temporal Patterns ===
 * - ml:temporal:hour:{hour}   -> Activity by hour of day (0-23)
 * - ml:temporal:day:{day}     -> Activity by day of week (0-6)
 * - ml:temporal:weekday       -> Weekend vs weekday activity
 *
 * === Layout Clustering ===
 * - ml:clusters:{structure_hash} -> Size distributions per structure cluster
 * - ml:cluster_archetypes:{hash} -> Archetype correlations per cluster
 * - ml:cluster_distribution   -> How common each structure hash is
 *
 * === Metadata ===
 * - ml:meta:*                 -> Metadata counters
 * - ml:meta:validation:passed -> Total events that passed validation
 * - ml:meta:validation:failed -> Total events that failed validation
 * - ml:meta:validation:failed:{type} -> Failed events by event type
 * - ml:meta:vocab_version:{version} -> Events by vocabulary version
 * - ml:meta:client_version:{version} -> Events by client version
 */

import { createHash } from 'crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from 'ioredis';
import type { RedisOptions } from 'ioredis';
import { getClientIP } from './lib/rateLimit.js';
import { logger } from './lib/logger.js';
import type { Increments } from './lib/mlTelemetry/aggregators.js';
import {
  aggregateBinAbandonment,
  aggregateBinDeletion,
  aggregateBinMove,
  aggregateBinPlacement,
  aggregateBinResize,
  aggregateBinRotation,
  aggregateCategoryChange,
  aggregateCrossLayoutPattern,
  aggregateDrawerPurpose,
  aggregateDrawerResize,
  aggregateFillOperation,
  aggregateLabelUpdate,
  aggregateLayerMove,
  aggregateLayoutSnapshot,
  aggregatePlacementRejection,
  aggregateQuickCorrection,
  aggregateQualitySignal,
  aggregateSessionSummary,
  aggregateUndo,
} from './lib/mlTelemetry/aggregators.js';
import { validateEvent } from './lib/mlTelemetry/validators.js';

// ============================================
// REDIS CONNECTION
// ============================================

/**
 * Parse Redis URL using WHATWG URL API to avoid deprecated url.parse().
 * ioredis accepts URL strings but uses the legacy url.parse() internally.
 */
function parseRedisUrl(redisUrl: string): RedisOptions {
  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: url.port ? parseInt(url.port, 10) : 6379,
    password: url.password || undefined,
    username: url.username || undefined,
    tls: url.protocol === 'rediss:' ? {} : undefined,
    db: url.pathname ? parseInt(url.pathname.slice(1), 10) || 0 : 0,
  };
}

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (!process.env.REDIS_URL) {
    return null;
  }
  if (!redis) {
    const urlConfig = parseRedisUrl(process.env.REDIS_URL);
    redis = new Redis({
      ...urlConfig,
      maxRetriesPerRequest: 1,
      connectTimeout: 5000,
      commandTimeout: 5000,
    });
  }
  return redis;
}

// ============================================
// RATE LIMITING
// ============================================

/**
 * Internal rate limiting for ML telemetry endpoint.
 * Uses the same Redis client as aggregation operations.
 * 100 requests per minute per IP.
 */
async function checkRateLimitInternal(ip: string, client: Redis): Promise<boolean> {
  const hashedIP = hashIP(ip);
  const key = `ml_ratelimit:${hashedIP}`;
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - 60;

  try {
    const count = await client.zcount(key, windowStart, '+inf');
    if (count >= 100) {
      return false;
    }

    const pipe = client.pipeline();
    pipe.zadd(key, now, `${now}-${Math.random()}`);
    pipe.zremrangebyscore(key, '-inf', windowStart);
    pipe.expire(key, 120);
    await pipe.exec();

    return true;
  } catch {
    // On error, deny the request (fail-closed, consistent with main rate limiter)
    return false;
  }
}

function hashIP(ip: string): string {
  return createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

// ============================================
// HANDLER
/**
 * HTTP POST handler for the ML telemetry ingestion endpoint.
 *
 * Validates and aggregates a batch of telemetry events, writing aggregated counters and metadata to Redis and returning a JSON summary of processed and failed events.
 *
 * Behavior:
 * - Only accepts POST; responds 405 for other methods.
 * - Applies a per-IP rate limit; responds 429 when exceeded.
 * - Accepts a JSON event or an array of events (batch capped at 100).
 * - Validates events, accumulates per-event-type failure counts, and tallies vocab/client versions from valid events.
 * - Writes aggregated counters and metadata (with appropriate TTLs) to Redis in a single pipeline.
 * - Responds 200 with { ok: true, processed, failed } on success.
 * - On Redis/storage errors responds 200 with { ok: true, processed: 0, error: 'storage_error' }.
 * - If Redis is not configured (development), responds 200 with { ok: true, processed: 0 }.
 *
 * @param req - Incoming VercelRequest containing the telemetry event(s)
 * @param res - VercelResponse used to send the JSON response
 */

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  // Only accept POST
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Get Redis client
  const client = getRedis();
  if (!client) {
    if (process.env.VERCEL_ENV === 'production') {
      logger.warn('ml-telemetry: Redis unavailable in production, telemetry discarded');
    }
    res.status(200).json({ ok: true, processed: 0 });
    return;
  }

  // Rate limiting
  const ip = getClientIP(req);

  const allowed = await checkRateLimitInternal(ip, client);
  if (!allowed) {
    res.status(429).json({ error: 'Rate limit exceeded' });
    return;
  }

  // Parse body
  let events: unknown[];
  try {
    events = Array.isArray(req.body) ? req.body : [req.body];
  } catch {
    res.status(400).json({ error: 'Invalid JSON' });
    return;
  }

  // Limit batch size
  if (events.length > 100) {
    events = events.slice(0, 100);
  }

  // Validate and aggregate
  const increments: Increments = {};
  let validCount = 0;
  let failedCount = 0;
  const failedByType: Record<string, number> = {};
  const vocabVersions: Record<string, number> = {};
  const clientVersions: Record<string, number> = {};

  for (const event of events) {
    if (!validateEvent(event)) {
      failedCount++;
      // Track failures by event type (extract from potentially invalid event)
      const maybeType = (event as Record<string, unknown>).type;
      const eventType = typeof maybeType === 'string' ? maybeType : 'unknown';
      failedByType[eventType] = (failedByType[eventType] || 0) + 1;
      continue;
    }
    validCount++;

    // Track vocab version from events that have it
    if ('vocab_version' in event && typeof event.vocab_version === 'string') {
      vocabVersions[event.vocab_version] = (vocabVersions[event.vocab_version] || 0) + 1;
    }

    // Track client version from events
    if ('client_version' in event && typeof event.client_version === 'string') {
      clientVersions[event.client_version] = (clientVersions[event.client_version] || 0) + 1;
    }

    switch (event.type) {
      case 'bin_placed':
        aggregateBinPlacement(event, increments);
        break;
      case 'label_updated':
        aggregateLabelUpdate(event, increments);
        break;
      case 'layout_snapshot':
        aggregateLayoutSnapshot(event, increments);
        break;
      case 'layout_quality':
        aggregateQualitySignal(event, increments);
        break;
      case 'drawer_purpose':
        aggregateDrawerPurpose(event, increments);
        break;
      case 'category_changed':
        aggregateCategoryChange(event, increments);
        break;
      case 'bin_resized':
        aggregateBinResize(event, increments);
        break;
      case 'bin_deleted':
        aggregateBinDeletion(event, increments);
        break;
      case 'bin_moved':
        aggregateBinMove(event, increments);
        break;
      case 'drawer_resized':
        aggregateDrawerResize(event, increments);
        break;
      case 'fill_operation':
        aggregateFillOperation(event, increments);
        break;
      case 'layer_move':
        aggregateLayerMove(event, increments);
        break;
      case 'bin_rotated':
        aggregateBinRotation(event, increments);
        break;
      // Negative signal events
      case 'placement_rejected':
        aggregatePlacementRejection(event, increments);
        break;
      case 'undo':
        aggregateUndo(event, increments);
        break;
      case 'quick_correction':
        aggregateQuickCorrection(event, increments);
        break;
      case 'bin_abandoned':
        aggregateBinAbandonment(event, increments);
        break;
      case 'session_summary':
        aggregateSessionSummary(event, increments);
        break;
      // Cross-layout learning
      case 'cross_layout_pattern':
        aggregateCrossLayoutPattern(event, increments);
        break;
    }
  }

  // Write to Redis even if validCount is 0 (to track failures)
  // Write to Redis in single pipeline
  try {
    const pipe = client.pipeline();

    for (const [hash, fields] of Object.entries(increments)) {
      if (!fields) continue;
      for (const [field, count] of Object.entries(fields)) {
        pipe.hincrby(hash, field, count);
      }

      // Add TTLs for keys that can grow unbounded (90 days)
      // These are lower-value or temporary data
      // Use NX flag to only set TTL on first creation, not reset on every write
      if (
        hash === 'ml:unknown_hashes' ||
        hash.startsWith('ml:size_seq:') ||
        hash.startsWith('ml:cooccur:') ||
        hash.startsWith('ml:label_hash_high:')
      ) {
        pipe.expire(hash, 90 * 24 * 60 * 60, 'NX'); // 90 days, only if no TTL exists
      }
    }

    // Update metadata
    if (validCount > 0) {
      pipe.incrby('ml:meta:total_events', validCount);
    }
    pipe.set('ml:meta:last_updated', new Date().toISOString());

    // Track validation metrics
    if (validCount > 0) {
      pipe.incrby('ml:meta:validation:passed', validCount);
    }
    if (failedCount > 0) {
      pipe.incrby('ml:meta:validation:failed', failedCount);
      for (const [eventType, count] of Object.entries(failedByType)) {
        // Sanitize event type for Redis key (only allow alphanumeric and underscore)
        const safeType = eventType.replace(/[^a-z0-9_]/gi, '_').slice(0, 32) || 'unknown';
        pipe.hincrby('ml:meta:validation:failed_by_type', safeType, count);
      }
    }

    // Track vocab versions (90 day TTL for version tracking)
    for (const [version, count] of Object.entries(vocabVersions)) {
      const safeVersion = version.replace(/[^a-z0-9_.]/gi, '_').slice(0, 16) || 'unknown';
      pipe.hincrby('ml:meta:vocab_versions', safeVersion, count);
    }
    // Use NX flag to only set TTL on first creation, not reset on every write
    pipe.expire('ml:meta:vocab_versions', 90 * 24 * 60 * 60, 'NX');

    // Track client versions (90 day TTL for version tracking)
    for (const [version, count] of Object.entries(clientVersions)) {
      const safeVersion = version.replace(/[^a-z0-9_.]/gi, '_').slice(0, 16) || 'unknown';
      pipe.hincrby('ml:meta:client_versions', safeVersion, count);
    }
    // Use NX flag to only set TTL on first creation, not reset on every write
    pipe.expire('ml:meta:client_versions', 90 * 24 * 60 * 60, 'NX');

    await pipe.exec();

    res.status(200).json({ ok: true, processed: validCount, failed: failedCount });
  } catch (error) {
    logger.error('ML telemetry Redis error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    // Don't fail the request - telemetry should never break UX
    res.status(200).json({ ok: true, processed: 0, error: 'storage_error' });
  }
}

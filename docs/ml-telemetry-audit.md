# ML Telemetry Audit Guide

This guide explains how to query and audit the ML telemetry data stored in production Redis.

## Quick Start

```bash
# Query production Redis (requires .env.local with REDIS_URL)
source .env.local
redis-cli -u "$REDIS_URL" KEYS "ml:*" | wc -l
```

## Connection

The ML telemetry system uses Redis Cloud. Credentials are stored in Vercel:

```bash
# Pull production credentials
vercel env pull .env.local --environment=production

# Connect via redis-cli
source .env.local
redis-cli -u "$REDIS_URL"
```

## Key Structure Overview

All ML telemetry keys are prefixed with `ml:`. Data is stored as Redis hashes where field names are typically bin sizes (e.g., `1x1x3`) and values are counts.

### Core Metrics

| Key | Type | Description |
|-----|------|-------------|
| `ml:sizes` | hash | Global bin size frequency distribution |
| `ml:meta:total_events` | string | Total events processed |
| `ml:meta:last_updated` | string | Last update timestamp |
| `ml:meta:validation:passed` | string | Events that passed validation |
| `ml:meta:validation:failed` | string | Events that failed validation |
| `ml:meta:validation:failed_by_type` | hash | Failures grouped by event type |
| `ml:meta:vocab_versions` | hash | Events by vocabulary version |

### Positive Signals (User Intent)

| Key Pattern | Description |
|-------------|-------------|
| `ml:drawer:{size}` | Bin sizes used per drawer size (e.g., `ml:drawer:10x8x12`) |
| `ml:label_hash:{hash}` | Bin sizes associated with each label hash |
| `ml:trans:{prev_size}` | Transition matrix: what size follows what |
| `ml:embed:{bucket}` | Bin sizes by embedding bucket (semantic similarity) |
| `ml:cooccur:{hash}` | Label co-occurrence matrix (which labels appear together) |
| `ml:first_label:{hash}` | Initial size choices when user first labels an item type |
| `ml:sequences` | Placement sequence patterns (size1>size2>size3) |
| `ml:adjacent_counts` | Distribution of adjacent bin counts at placement time |
| `ml:method:{method}` | Sizes by placement method (draw/fill/duplicate/etc.) |
| `ml:cat:{category_id}` | Sizes by category |

### Layout Analysis

| Key | Description |
|-----|-------------|
| `ml:triggers` | Snapshot trigger distribution (save/idle/session_end/etc.) |
| `ml:archetype` | Layout archetypes (uniform/mixed/border_fill/etc.) |
| `ml:quality_tier` | Quality tier distribution (high/medium/low/skip) |
| `ml:patterns` | Spatial patterns (edge_aligned/corner_start/etc.) |
| `ml:uniformity` | Layout uniformity score buckets |
| `ml:edge_combo` | Edge usage combinations |
| `ml:clusters:{hash}` | Structure cluster distributions |
| `ml:resize_direction` | Resize direction distribution (grow/shrink/mixed) |
| `ml:resize_delta` | Area change magnitude buckets (+0-1, +1-4, -0-1, etc.) |

### Session Metrics

| Key | Description |
|-----|-------------|
| `ml:session:bins_placed` | Histogram of bins placed per session |
| `ml:session:edit_ratio` | Edit-to-done ratio buckets |
| `ml:session:confidence` | Session confidence score distribution |
| `ml:session:duration` | Session duration buckets |
| `ml:session:totals` | Total session count |

### Negative Signals (User Regret)

| Key | Description |
|-----|-------------|
| `ml:neg:deleted_sizes` | Sizes that get deleted (bad recommendations) |
| `ml:neg:delete_methods` | How users delete (key/context_menu/bulk) |
| `ml:neg:deletions` | Total deletion count |
| `ml:neg:undos` | Undo actions by type |
| `ml:neg:undo_timing` | How fast users undo (immediate/quick/delayed) |
| `ml:neg:quick_corrections` | Corrections within 30s of placement |
| `ml:neg:corrected_sizes` | Sizes that get quickly corrected |
| `ml:neg:correction_timing` | Correction timing distribution |
| `ml:neg:abandoned_sizes` | Sizes that get abandoned (placed but never used) |
| `ml:neg:abandoned_by_method:{method}` | Abandonment rate by creation method |
| `ml:neg:abandon_lifetime` | How long bins existed before abandonment |
| `ml:neg:abandoned_by_drawer:{size}` | Per-drawer abandonment patterns |
| `ml:neg:abandonment_total` | Total abandoned bin count |

### Temporal Data

| Key | Description |
|-----|-------------|
| `ml:temporal:hour:{0-23}` | Activity by hour of day |
| `ml:temporal:day:{0-6}` | Activity by day of week |
| `ml:temporal:weekday` | Weekend vs weekday distribution |

## Common Audit Queries

### 1. Health Check

```bash
REDIS="redis-cli -u $REDIS_URL"

echo "=== ML Telemetry Health Check ==="
echo "Total ml: keys: $($REDIS KEYS 'ml:*' 2>/dev/null | wc -l)"
echo "Validation passed: $($REDIS GET 'ml:meta:validation:passed' 2>/dev/null)"
echo "Validation failed: $($REDIS GET 'ml:meta:validation:failed' 2>/dev/null)"
echo ""
echo "Failures by type:"
$REDIS HGETALL "ml:meta:validation:failed_by_type" 2>/dev/null
```

### 2. Top Bin Sizes

```bash
# Get most popular bin sizes
redis-cli -u "$REDIS_URL" HGETALL "ml:sizes" 2>/dev/null | \
  paste - - | sort -t$'\t' -k2 -nr | head -20
```

### 3. Negative Signal Analysis

```bash
REDIS="redis-cli -u $REDIS_URL"

echo "=== Negative Signals ==="
echo "Undos:"
$REDIS HGETALL "ml:neg:undos" 2>/dev/null

echo ""
echo "Quick Corrections:"
$REDIS HGETALL "ml:neg:quick_corrections" 2>/dev/null

echo ""
echo "Most Deleted Sizes:"
$REDIS HGETALL "ml:neg:deleted_sizes" 2>/dev/null | paste - - | sort -t$'\t' -k2 -nr | head -10
```

### 4. Session Quality

```bash
REDIS="redis-cli -u $REDIS_URL"

echo "=== Session Quality ==="
echo "Total sessions: $($REDIS HGET 'ml:session:totals' 'total' 2>/dev/null)"
echo ""
echo "Bins placed distribution:"
$REDIS HGETALL "ml:session:bins_placed" 2>/dev/null

echo ""
echo "Confidence distribution:"
$REDIS HGETALL "ml:session:confidence" 2>/dev/null
```

### 5. Data Richness

```bash
REDIS="redis-cli -u $REDIS_URL"

echo "=== Data Richness ==="
for prefix in "ml:label_hash:" "ml:trans:" "ml:drawer:" "ml:embed:" "ml:cooccur:" "ml:clusters:"; do
  count=$($REDIS KEYS "${prefix}*" 2>/dev/null | wc -l)
  echo "$prefix* : $count keys"
done
```

### 6. Validation Failure Rate

```bash
REDIS="redis-cli -u $REDIS_URL"

passed=$($REDIS GET 'ml:meta:validation:passed' 2>/dev/null)
failed=$($REDIS GET 'ml:meta:validation:failed' 2>/dev/null)
total=$((passed + failed))

if [ $total -gt 0 ]; then
  rate=$(echo "scale=2; $failed * 100 / $total" | bc)
  echo "Validation failure rate: ${rate}% ($failed / $total)"
else
  echo "No events recorded"
fi
```

## Full Audit Script

Save this as `scripts/audit-ml-telemetry.sh`:

```bash
#!/bin/bash
set -e

# Load environment
if [ -f .env.local ]; then
  source .env.local
fi

if [ -z "$REDIS_URL" ]; then
  echo "Error: REDIS_URL not set. Run: vercel env pull .env.local --environment=production"
  exit 1
fi

REDIS="redis-cli -u $REDIS_URL"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║           ML TELEMETRY PRODUCTION AUDIT                      ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# 1. Overview
echo "┌─────────────────────────────────────────────────────────────┐"
echo "│ OVERVIEW                                                     │"
echo "└─────────────────────────────────────────────────────────────┘"
total_keys=$($REDIS KEYS 'ml:*' 2>/dev/null | wc -l)
passed=$($REDIS GET 'ml:meta:validation:passed' 2>/dev/null || echo "0")
failed=$($REDIS GET 'ml:meta:validation:failed' 2>/dev/null || echo "0")
total_events=$((passed + failed))

echo "Total ml: keys:      $total_keys"
echo "Events passed:       $passed"
echo "Events failed:       $failed"
if [ $total_events -gt 0 ]; then
  rate=$(echo "scale=1; $failed * 100 / $total_events" | bc)
  echo "Failure rate:        ${rate}%"
fi
echo ""

# 2. Key Distribution
echo "┌─────────────────────────────────────────────────────────────┐"
echo "│ KEY DISTRIBUTION                                            │"
echo "└─────────────────────────────────────────────────────────────┘"
for prefix in "ml:label_hash:" "ml:embed:" "ml:cooccur:" "ml:clusters:" "ml:trans:" "ml:drawer:" "ml:neg:" "ml:session:"; do
  count=$($REDIS KEYS "${prefix}*" 2>/dev/null | wc -l)
  printf "%-20s %d keys\n" "$prefix*" "$count"
done
echo ""

# 3. Validation Failures
echo "┌─────────────────────────────────────────────────────────────┐"
echo "│ VALIDATION FAILURES BY TYPE                                 │"
echo "└─────────────────────────────────────────────────────────────┘"
$REDIS HGETALL "ml:meta:validation:failed_by_type" 2>/dev/null | paste - - | while read type count; do
  printf "%-25s %s\n" "$type" "$count"
done
echo ""

# 4. Top Bin Sizes
echo "┌─────────────────────────────────────────────────────────────┐"
echo "│ TOP 10 BIN SIZES                                            │"
echo "└─────────────────────────────────────────────────────────────┘"
$REDIS HGETALL "ml:sizes" 2>/dev/null | paste - - | sort -t$'\t' -k2 -nr | head -10 | while read size count; do
  printf "%-15s %s\n" "$size" "$count"
done
echo ""

# 5. Layout Archetypes
echo "┌─────────────────────────────────────────────────────────────┐"
echo "│ LAYOUT ARCHETYPES                                           │"
echo "└─────────────────────────────────────────────────────────────┘"
$REDIS HGETALL "ml:archetype" 2>/dev/null | paste - - | sort -t$'\t' -k2 -nr | while read type count; do
  printf "%-20s %s\n" "$type" "$count"
done
echo ""

# 6. Negative Signals
echo "┌─────────────────────────────────────────────────────────────┐"
echo "│ NEGATIVE SIGNALS                                            │"
echo "└─────────────────────────────────────────────────────────────┘"
echo "Undos:"
$REDIS HGETALL "ml:neg:undos" 2>/dev/null | paste - - | while read action count; do
  printf "  %-20s %s\n" "$action" "$count"
done
echo ""
echo "Quick Corrections:"
$REDIS HGETALL "ml:neg:quick_corrections" 2>/dev/null | paste - - | while read type count; do
  printf "  %-20s %s\n" "$type" "$count"
done
echo ""

# 7. Session Summary
echo "┌─────────────────────────────────────────────────────────────┐"
echo "│ SESSION SUMMARY                                             │"
echo "└─────────────────────────────────────────────────────────────┘"
total_sessions=$($REDIS HGET 'ml:session:totals' 'total' 2>/dev/null || echo "0")
echo "Total sessions: $total_sessions"
echo ""
echo "Bins placed distribution:"
$REDIS HGETALL "ml:session:bins_placed" 2>/dev/null | paste - - | while read bucket count; do
  printf "  %-15s %s\n" "$bucket" "$count"
done
echo ""
echo "Confidence distribution:"
$REDIS HGETALL "ml:session:confidence" 2>/dev/null | paste - - | while read level count; do
  printf "  %-15s %s\n" "$level" "$count"
done
echo ""

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                    AUDIT COMPLETE                            ║"
echo "╚══════════════════════════════════════════════════════════════╝"
```

## Interpreting Results

### Validation Failure Rate

- **< 5%**: Healthy - normal edge cases
- **5-10%**: Warning - investigate specific event types
- **> 10%**: Critical - likely a client/server mismatch bug

Common causes of validation failures:
1. **Regex mismatch** - Client generates data in format server doesn't expect
2. **Range violations** - Values exceed expected bounds
3. **Missing fields** - Required fields not sent by client
4. **Type mismatches** - String vs number, null handling

### Negative Signal Interpretation

| Signal | High Count Means |
|--------|-----------------|
| `ml:neg:deleted_sizes` | These sizes are often wrong recommendations |
| `ml:neg:undo_timing.immediate` | Users instantly regret actions |
| `ml:neg:quick_corrections` | Initial placements are often adjusted |
| `ml:neg:corrected_sizes` | These sizes need correction most often |

### Data Volume Thresholds

For ML training viability:
- **Minimum**: 1,000 sessions, 10,000 events
- **Good**: 10,000 sessions, 100,000 events
- **Ideal**: 100,000+ sessions, 1M+ events

## Troubleshooting

### No Data Found

1. Check Redis connection: `redis-cli -u "$REDIS_URL" PING`
2. Verify correct environment: `vercel env ls`
3. Check if telemetry is enabled in client code

### High Failure Rate

1. Check `ml:meta:validation:failed_by_type` for specific event types
2. Compare client event schema with server validation in `api/ml-telemetry.ts`
3. Look for recent changes to event generation code

### Missing Key Types

If certain `ml:*` key patterns are missing, the corresponding events may not be firing:
- No `ml:label_hash:*` = Labels not being tracked
- No `ml:neg:*` = Negative signals not implemented
- No `ml:session:*` = Session summaries not sent

## Related Files

- `api/ml-telemetry.ts` - Server-side validation and aggregation
- `src/shared/analytics/useMLTracking.ts` - Client-side tracking hooks
- `src/shared/analytics/labelVocabulary.ts` - Label hash generation
- `src/shared/analytics/labelEmbedding.ts` - Embedding bucket computation

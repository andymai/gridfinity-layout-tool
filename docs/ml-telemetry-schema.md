# ML Telemetry Redis Schema

This document describes the Redis data schema used by the ML telemetry system for training bin size prediction models.

## Overview

The telemetry system collects user behavior data to train ML models that can:
- Predict optimal bin sizes based on labels, drawer size, and context
- Suggest layout patterns based on drawer purpose
- Identify what bin configurations users prefer

**Privacy**: No PII is stored. Labels are hashed client-side, and only aggregate counts are stored in Redis.

## Key Naming Convention

- `ml:` - Positive signals (user kept the configuration)
- `ml:neg:` - Negative signals (user rejected/corrected the configuration)
- `ml:meta:` - System metadata and health metrics

## Schema Reference

### Bin Placement (Positive Signals)

| Key | Type | Description | TTL |
|-----|------|-------------|-----|
| `ml:sizes` | Hash | Global bin size frequency | None |
| `ml:trans:{prev_size}` | Hash | Size transition matrix (prev → next) | None |
| `ml:drawer:{size}` | Hash | Bin sizes per drawer size | None |
| `ml:label_hash:{hash}` | Hash | Bin sizes per label hash | None |
| `ml:label:{normalized}` | Hash | Bin sizes per normalized label | None |
| `ml:label_domain:{domain}` | Hash | Bin sizes per domain category | None |
| `ml:cat:{category}` | Hash | Bin sizes per category | None |
| `ml:gapfit:{fit}` | Hash | Bin sizes per gap fit type | None |
| `ml:method:{method}` | Hash | Bin sizes per placement method | None |
| `ml:unknown_hashes` | Hash | Unknown label hashes for vocab expansion | 90 days |
| `ml:cooccur:{hash}` | Hash | Label co-occurrence matrix | 90 days |
| `ml:size_seq:{drawer}` | Hash | Common size sequences by drawer | 90 days |

### Layout Snapshots

| Key | Type | Description | TTL |
|-----|------|-------------|-----|
| `ml:drawer_sizes:{drawer}` | Hash | Bin size distribution by drawer size | None |
| `ml:domains:{drawer}` | Hash | Domain distribution by drawer size | None |
| `ml:triggers` | Hash | Snapshot trigger distribution | None |
| `ml:purpose:{purpose}` | Hash | Drawer purpose frequency | None |
| `ml:purpose_sizes:{purpose}` | Hash | Bin sizes by drawer purpose | None |

### Quality Signals

| Key | Type | Description | TTL |
|-----|------|-------------|-----|
| `ml:quality:{signal}` | Hash | Quality signal counts | None |
| `ml:quality_layouts` | Hash | Layouts by quality signal type | None |
| `ml:quality_confidence` | Hash | Confidence score distribution | None |
| `ml:quality_conf_by_signal:{signal}` | Hash | Confidence by signal type | None |
| `ml:quality_score:{score_name}` | Hash | Individual score distributions | None |
| `ml:abandonment` | Hash | Abandonment type distribution | None |
| `ml:abandonment_age:{type}` | Hash | Abandonment by layout age | None |
| `ml:quality_dormancy` | Hash | Time since last edit buckets | None |

### Session Summary

| Key | Type | Description | TTL |
|-----|------|-------------|-----|
| `ml:session:bins_placed` | Hash | Histogram of bins placed per session | None |
| `ml:session:edit_ratio` | Hash | Edit-to-done ratio buckets | None |
| `ml:session:time_to_first` | Hash | Time to first bin buckets | None |
| `ml:session:confidence` | Hash | Confidence score distribution | None |
| `ml:session:duration` | Hash | Session duration buckets | None |
| `ml:session:undo_count` | Hash | Undo count distribution | None |
| `ml:session:conf_by_drawer:{size}` | Hash | Confidence by drawer size | None |
| `ml:session:totals` | Hash | Total session counts | None |

### Temporal Patterns

| Key | Type | Description | TTL |
|-----|------|-------------|-----|
| `ml:temporal:hour:{hour}` | Hash | Activity by hour of day (0-23) | None |
| `ml:temporal:day:{day}` | Hash | Activity by day of week (0-6) | None |
| `ml:temporal:weekday` | Hash | Weekend vs weekday activity | None |

### Layout Clustering

| Key | Type | Description | TTL |
|-----|------|-------------|-----|
| `ml:clusters:{structure_hash}` | Hash | Size distributions per structure cluster | None |
| `ml:cluster_archetypes:{hash}` | Hash | Archetype correlations per cluster | None |
| `ml:cluster_distribution` | Hash | How common each structure hash is | None |

### Negative Signals

#### Deletions

| Key | Type | Description | TTL |
|-----|------|-------------|-----|
| `ml:neg:deleted_sizes` | Hash | Size distribution of deleted bins | None |
| `ml:neg:delete_methods` | Hash | Deletion method distribution | None |
| `ml:neg:delete_labeled` | Hash | Labeled vs unlabeled deletion rate | None |
| `ml:neg:delete_domain:{domain}` | Hash | Deleted sizes by label domain | None |
| `ml:neg:deletions` | Hash | Total deletion event count | None |

#### Undos

| Key | Type | Description | TTL |
|-----|------|-------------|-----|
| `ml:neg:undos` | Hash | Total undo count by action type | None |
| `ml:neg:undo_timing` | Hash | Undo timing buckets | None |
| `ml:neg:undo_action_timing` | Hash | Action + timing combos | None |
| `ml:neg:undo_scale` | Hash | Undo scale (bins affected) | None |

#### Placement Rejections

| Key | Type | Description | TTL |
|-----|------|-------------|-----|
| `ml:rejections` | Hash | Total rejection count by reason | None |
| `ml:reject_modes` | Hash | Rejection count by draw/paint mode | None |
| `ml:reject_sizes` | Hash | Intended sizes that were rejected | None |
| `ml:neg:reject_by_drawer:{size}` | Hash | Rejected sizes by drawer size | None |

#### Quick Corrections (Strongest Signal)

| Key | Type | Description | TTL |
|-----|------|-------------|-----|
| `ml:neg:quick_corrections` | Hash | Quick correction count by type | None |
| `ml:neg:corrected_sizes` | Hash | Sizes that get quickly corrected | None |
| `ml:neg:correct_by_method:{method}` | Hash | Corrections by placement method | None |
| `ml:neg:correction_timing` | Hash | How fast corrections happen | None |
| `ml:neg:resize_correct:{size}` | Hash | What users resize corrected bins to | None |

### System Metadata

| Key | Type | Description | TTL |
|-----|------|-------------|-----|
| `ml:meta:total_events` | Integer | Total events processed | None |
| `ml:meta:last_updated` | String | Last update timestamp | None |
| `ml:meta:validation:passed` | Integer | Events that passed validation | None |
| `ml:meta:validation:failed` | Integer | Events that failed validation | None |
| `ml:meta:validation:failed_by_type` | Hash | Failed events by event type | None |
| `ml:meta:vocab_versions` | Hash | Events by vocabulary version | 90 days |
| `ml:meta:client_versions` | Hash | Events by client version | 90 days |

## Data Extraction

### Example: Get Top Bin Sizes by Label Hash
```bash
redis-cli HGETALL "ml:label_hash:a1b2c3d4"
```

### Example: Get Size Transition Matrix
```bash
# Get what sizes follow "2x2x6"
redis-cli HGETALL "ml:trans:2x2x6"
```

### Example: Get Negative Signal Ratios
```bash
# Compare positive vs negative for a size
redis-cli HGET "ml:sizes" "2x2x6"
redis-cli HGET "ml:neg:deleted_sizes" "2x2x6"
```

### Example: Check Data Quality
```bash
# Validation pass/fail ratio
redis-cli GET "ml:meta:validation:passed"
redis-cli GET "ml:meta:validation:failed"

# Failed events by type
redis-cli HGETALL "ml:meta:validation:failed_by_type"
```

## Cardinality Estimates

| Key Pattern | Expected Cardinality | Notes |
|-------------|---------------------|-------|
| `ml:sizes` | ~100-500 sizes | Bounded by valid bin dimensions |
| `ml:label_hash:*` | Unbounded | One key per unique label hash |
| `ml:drawer:*` | ~50-200 | Bounded by common drawer sizes |
| `ml:clusters:*` | ~1000-10000 | Structure hashes, self-limiting |
| `ml:cooccur:*` | Unbounded | Grows with label variety, has TTL |

## Retention Policy

Keys with 90-day TTL are automatically pruned:
- `ml:unknown_hashes` - Vocabulary expansion candidates
- `ml:cooccur:*` - Label co-occurrence (high cardinality)
- `ml:size_seq:*` - Size sequences (high cardinality)
- `ml:meta:vocab_versions` - Version tracking

All other keys are retained indefinitely for historical analysis.

## Client Configuration

### Sampling
After 50 bins in a session, placement events are sampled at 25% rate (except labeled bins).

### Circuit Breaker
After 5 consecutive send failures, the client stops sending for 5 minutes.

### Batching
Events are batched and sent every 30 seconds or when 20 events accumulate.

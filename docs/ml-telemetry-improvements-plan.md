# ML Telemetry Improvements Plan

This document outlines the implementation plan for improving the ML telemetry system to better support training a Gridfinity bin size recommendation model.

## Executive Summary

Based on the ML systems review, we've identified 5 priority improvements that can be implemented incrementally. The improvements are ordered by impact-to-effort ratio, with quick wins first.

**Total Estimated Effort**: 3-4 weeks for all improvements

---

## Priority 1: Add Resize Direction (Quick Win)

### Problem
The `bin_resized` event tracks old/new sizes but doesn't indicate whether the user made the bin **larger** or **smaller**. This distinction is critical for understanding if initial suggestions are too small or too large.

### Current State
```typescript
// src/shared/analytics/mlTelemetry.ts:314-331
interface BinResizeEvent {
  type: 'bin_resized';
  old_size: string;        // e.g., "2x2x3"
  new_size: string;        // e.g., "3x3x3"
  dimensions_changed: ('width' | 'depth')[];
  batch_size: number;
  fill_pct: number;
}
```

### Proposed Changes

#### Client (`src/shared/analytics/mlTelemetry.ts`)

```typescript
// Add to BinResizeEvent interface
interface BinResizeEvent {
  // ... existing fields

  /** Direction of resize: 'grow' | 'shrink' | 'mixed' */
  resize_direction: 'grow' | 'shrink' | 'mixed';

  /** Area change: positive = grew, negative = shrank */
  area_delta: number;
}

// In trackBinResize function
export function trackBinResize(
  oldRect: { width: number; depth: number },
  newRect: { width: number; depth: number },
  height: number,
  layout: Layout,
  batchSize: number = 1
): void {
  // ... existing code ...

  // Compute resize direction
  const oldArea = oldRect.width * oldRect.depth;
  const newArea = newRect.width * newRect.depth;
  const areaDelta = newArea - oldArea;

  let resizeDirection: 'grow' | 'shrink' | 'mixed';
  const widthGrew = newRect.width > oldRect.width;
  const depthGrew = newRect.depth > oldRect.depth;
  const widthShrank = newRect.width < oldRect.width;
  const depthShrank = newRect.depth < oldRect.depth;

  if ((widthGrew || depthGrew) && !widthShrank && !depthShrank) {
    resizeDirection = 'grow';
  } else if ((widthShrank || depthShrank) && !widthGrew && !depthGrew) {
    resizeDirection = 'shrink';
  } else {
    resizeDirection = 'mixed'; // One dimension grew, other shrank
  }

  const event: BinResizeEvent = {
    // ... existing fields
    resize_direction: resizeDirection,
    area_delta: areaDelta,
  };
}
```

#### Server (`api/ml-telemetry.ts`)

```typescript
// Add validation
const VALID_RESIZE_DIRECTIONS = ['grow', 'shrink', 'mixed'] as const;

// In validateEvent for bin_resized
if (!VALID_RESIZE_DIRECTIONS.includes(event.resize_direction)) {
  return { valid: false, error: 'Invalid resize_direction' };
}
if (typeof event.area_delta !== 'number') {
  return { valid: false, error: 'Invalid area_delta' };
}

// In aggregateBinResize
function aggregateBinResize(event: BinResizeEvent, inc: Increments): void {
  // ... existing code ...

  // Track resize direction distribution
  inc['ml:neg:resize_direction'] = inc['ml:neg:resize_direction'] || {};
  inc['ml:neg:resize_direction'][event.resize_direction] =
    (inc['ml:neg:resize_direction'][event.resize_direction] || 0) + 1;

  // Track area delta buckets
  const deltaBucket = event.area_delta < -4 ? 'shrink_large' :
    event.area_delta < 0 ? 'shrink_small' :
    event.area_delta <= 4 ? 'grow_small' : 'grow_large';
  inc['ml:neg:resize_delta'] = inc['ml:neg:resize_delta'] || {};
  inc['ml:neg:resize_delta'][deltaBucket] =
    (inc['ml:neg:resize_delta'][deltaBucket] || 0) + 1;
}
```

### Files to Modify
- `src/shared/analytics/mlTelemetry.ts` - Add fields to interface and tracking function
- `api/ml-telemetry.ts` - Add validation and aggregation

### Effort
**1-2 hours** - Very straightforward calculation

### ML Impact
**High** - Tells us if our suggestions tend to be too small or too large

---

## Priority 2: Fix Bin Age Tracking in Deletions (Quick Win)

### Problem
The `bin_deleted` event has `age_ms: null` with a comment "We don't track bin creation time currently" - but we actually DO track it via `binCreationRecords`! This is an easy fix.

### Current State
```typescript
// src/shared/analytics/mlTelemetry.ts:1955
const event: BinDeletedEvent = {
  // ...
  age_ms: null, // We don't track bin creation time currently
};
```

But we have:
```typescript
// src/shared/analytics/mlTelemetry.ts:815-845
const binCreationRecords = new Map<string, BinCreationRecord>();

export function recordBinCreation(binId: string, method: PlacementMethod, size: string): void {
  binCreationRecords.set(binId, {
    createdAt: Date.now(),
    method,
    originalSize: size,
  });
}
```

### Proposed Changes

```typescript
// In trackBinDeletion, look up creation record
export function trackBinDeletion(
  bin: Bin,
  layout: Layout,
  method: DeleteMethod,
  batchSize: number = 1
): void {
  // ... existing code ...

  // Look up bin age from creation records
  const creationRecord = binCreationRecords.get(bin.id);
  const ageMs = creationRecord ? Date.now() - creationRecord.createdAt : null;

  const event: BinDeletedEvent = {
    // ...
    age_ms: ageMs,
  };

  // Clean up the creation record since bin is deleted
  if (creationRecord) {
    binCreationRecords.delete(bin.id);
  }
}
```

### Server Aggregation Addition

```typescript
// In aggregateBinDeletion
function aggregateBinDeletion(event: BinDeletedEvent, inc: Increments): void {
  // ... existing code ...

  // Track deletion age buckets (strong signal: immediate deletions = bad suggestions)
  if (event.age_ms !== null) {
    const ageBucket = event.age_ms < 5_000 ? 'immediate' :     // < 5s
      event.age_ms < 30_000 ? 'quick' :                         // 5-30s
      event.age_ms < 120_000 ? 'short' :                        // 30s-2min
      event.age_ms < 300_000 ? 'medium' : 'long';               // 2-5min, >5min
    inc['ml:neg:delete_age'] = inc['ml:neg:delete_age'] || {};
    inc['ml:neg:delete_age'][ageBucket] =
      (inc['ml:neg:delete_age'][ageBucket] || 0) + 1;
  }
}
```

### Files to Modify
- `src/shared/analytics/mlTelemetry.ts` - Use existing `binCreationRecords` in `trackBinDeletion`
- `api/ml-telemetry.ts` - Add age bucket aggregation

### Effort
**30 minutes** - Just connecting existing infrastructure

### ML Impact
**High** - Immediate deletions (< 5s) are strong negative signals

---

## Priority 3: Add Adjacent Labels Context

### Problem
When placing a bin, we don't track what labels are in adjacent bins. This context is valuable because:
- "screwdriver" next to "bit" suggests tool drawer
- Size consistency with neighbors indicates organization style

### Current State
The `areBinsAdjacent()` function exists in `layoutPatterns.ts` but isn't used in `trackBinPlacement`.

### Proposed Changes

#### New Helper Function

```typescript
// src/shared/analytics/mlTelemetry.ts

/**
 * Get labels and sizes of bins adjacent to the given bin
 */
function getAdjacentBinContext(
  bin: Bin,
  layout: Layout
): { labels: string[]; sizes: string[]; count: number } {
  const sameLevelBins = layout.bins.filter(
    b => b.layerId === bin.layerId && b.id !== bin.id
  );

  const adjacentLabels: string[] = [];
  const adjacentSizes: string[] = [];

  for (const other of sameLevelBins) {
    if (areBinsAdjacent(bin, other)) {
      if (other.label?.trim()) {
        const labelData = processLabel(other.label);
        if (labelData.hash) {
          adjacentLabels.push(labelData.hash);
        }
      }
      adjacentSizes.push(`${other.width}x${other.depth}x${other.height}`);
    }
  }

  return {
    labels: adjacentLabels.slice(0, 4), // Cap at 4 to limit payload size
    sizes: adjacentSizes.slice(0, 4),
    count: adjacentSizes.length, // Total adjacent bins (size is added for every adjacent bin)
  };
}
```

#### Interface Changes

```typescript
interface BinPlacementEvent {
  // ... existing fields

  /** Label hashes of adjacent bins (max 4) */
  adjacent_label_hashes: string[];

  /** Sizes of adjacent bins (max 4) */
  adjacent_sizes: string[];

  /** Number of adjacent bins */
  adjacent_count: number;
}
```

#### Tracking Changes

```typescript
// In trackBinPlacement
const adjacentContext = getAdjacentBinContext(bin, layout);

const event: BinPlacementEvent = {
  // ... existing fields
  adjacent_label_hashes: adjacentContext.labels,
  adjacent_sizes: adjacentContext.sizes,
  adjacent_count: adjacentContext.count,
};
```

#### Server Aggregation

```typescript
function aggregateBinPlacement(event: BinPlacementEvent, inc: Increments): void {
  // ... existing code ...

  // Track size by adjacent context
  if (event.adjacent_label_hashes.length > 0 && event.label_hash) {
    // Label-to-label adjacency patterns
    for (const adjHash of event.adjacent_label_hashes) {
      const adjKey = `ml:adj:${event.label_hash}`;
      inc[adjKey] = inc[adjKey] || {};
      inc[adjKey][adjHash] = (inc[adjKey][adjHash] || 0) + 1;
    }
  }

  // Track whether bins match adjacent sizes (uniformity indicator)
  const matchesAdjacent = event.adjacent_sizes.includes(event.bin_size);
  inc['ml:size_match'] = inc['ml:size_match'] || {};
  inc['ml:size_match'][matchesAdjacent ? 'matches' : 'differs'] =
    (inc['ml:size_match'][matchesAdjacent ? 'matches' : 'differs'] || 0) + 1;
}
```

### Import Required
```typescript
// In mlTelemetry.ts
import { areBinsAdjacent } from './layoutPatterns';
```

### Files to Modify
- `src/shared/analytics/mlTelemetry.ts` - Add helper and update `trackBinPlacement`
- `src/shared/analytics/layoutPatterns.ts` - Export `areBinsAdjacent`
- `api/ml-telemetry.ts` - Add validation and aggregation

### Effort
**2-3 hours**

### ML Impact
**Medium-High** - Enables learning label co-location patterns

---

## Priority 4: Add Abandoned Bin Detection

### Problem
We don't specifically track bins that are created but then deleted without ever being labeled. These represent failed attempts where the user couldn't figure out what to put there.

### Current State
No tracking of this pattern.

### Proposed Changes

#### New Event Type

```typescript
interface AbandonedBinEvent {
  type: 'bin_abandoned';

  /** Size of abandoned bin */
  bin_size: string;

  /** Position where it was placed */
  position: string;

  /** Layer index */
  layer_index: number;

  /** How long the bin existed before deletion */
  lifetime_ms: number;

  /** How the bin was created */
  creation_method: PlacementMethod;

  /** Fill percentage when abandoned */
  fill_pct: number;

  /** Drawer size for context */
  drawer_size: string;
}
```

#### Detection Logic

```typescript
// In trackBinDeletion
export function trackBinDeletion(
  bin: Bin,
  layout: Layout,
  method: DeleteMethod,
  batchSize: number = 1
): void {
  // ... existing code ...

  const creationRecord = binCreationRecords.get(bin.id);
  const ageMs = creationRecord ? Date.now() - creationRecord.createdAt : null;

  // Detect abandoned bin pattern:
  // - Bin had no label
  // - Deleted within 5 minutes of creation
  // - Not a bulk delete (single bin)
  const isAbandoned =
    !bin.label?.trim() &&
    ageMs !== null &&
    ageMs < 300_000 && // 5 minutes
    batchSize === 1;

  if (isAbandoned && creationRecord) {
    const abandonedEvent: AbandonedBinEvent = {
      type: 'bin_abandoned',
      bin_size: `${bin.width}x${bin.depth}x${bin.height}`,
      position: `${bin.x},${bin.y}`,
      layer_index: layerIndex >= 0 ? layerIndex : 0,
      lifetime_ms: ageMs,
      creation_method: creationRecord.method,
      fill_pct: fillAfter,
      drawer_size: `${layout.drawer.width}x${layout.drawer.depth}x${layout.drawer.height}`,
    };
    bufferEvent(abandonedEvent);
  }

  // Still send normal deletion event
  bufferEvent(event);
}
```

#### Server Aggregation

```typescript
function aggregateBinAbandoned(event: AbandonedBinEvent, inc: Increments): void {
  // Track abandoned sizes (bins users couldn't figure out how to use)
  inc['ml:neg:abandoned_sizes'] = inc['ml:neg:abandoned_sizes'] || {};
  inc['ml:neg:abandoned_sizes'][event.bin_size] =
    (inc['ml:neg:abandoned_sizes'][event.bin_size] || 0) + 1;

  // Track by creation method (did fill operations create more abandoned bins?)
  inc['ml:neg:abandoned_by_method'] = inc['ml:neg:abandoned_by_method'] || {};
  inc['ml:neg:abandoned_by_method'][event.creation_method] =
    (inc['ml:neg:abandoned_by_method'][event.creation_method] || 0) + 1;

  // Track lifetime buckets
  const lifetimeBucket = event.lifetime_ms < 10_000 ? 'immediate' :
    event.lifetime_ms < 60_000 ? 'quick' : 'deliberate';
  inc['ml:neg:abandoned_lifetime'] = inc['ml:neg:abandoned_lifetime'] || {};
  inc['ml:neg:abandoned_lifetime'][lifetimeBucket] =
    (inc['ml:neg:abandoned_lifetime'][lifetimeBucket] || 0) + 1;

  // Track total
  inc['ml:neg:abandoned'] = inc['ml:neg:abandoned'] || {};
  inc['ml:neg:abandoned']['total'] =
    (inc['ml:neg:abandoned']['total'] || 0) + 1;
}
```

### Files to Modify
- `src/shared/analytics/mlTelemetry.ts` - Add event type and detection
- `api/ml-telemetry.ts` - Add validation and aggregation

### Effort
**1-2 hours**

### ML Impact
**Medium** - Strong negative signal for specific sizes in specific positions

---

## Priority 5: Add Placement Sequence Tracking

### Problem
We don't capture the sequence of recent placements, which would help the model understand workflow patterns like "place large bin first, then fill gaps."

### Current State
Only `prev_bin_size` and `session_index` are tracked.

### Proposed Changes

#### Extend Session State

```typescript
interface LayoutSessionState {
  // ... existing fields

  /** Rolling window of last 5 placement contexts */
  recentPlacements: Array<{
    size: string;
    labelHash: string | null;
    position: string;
    timestamp: number;
  }>;
}

// Initialize
const layoutSession: LayoutSessionState = {
  // ... existing
  recentPlacements: [],
};
```

#### New Event Fields

```typescript
interface BinPlacementEvent {
  // ... existing fields

  /** Recent placement pattern (sizes of last 3 placements) */
  recent_sizes: string[];

  /** Time since last placement in ms */
  time_since_last_ms: number | null;

  /** Whether this is first bin with this label in session */
  is_first_of_label: boolean;
}
```

#### Tracking Changes

```typescript
// In trackBinPlacement
const now = Date.now();
const lastPlacement = layoutSession.recentPlacements[layoutSession.recentPlacements.length - 1];
const timeSinceLast = lastPlacement ? now - lastPlacement.timestamp : null;

// Check if first occurrence of this label in session
const isFirstOfLabel = labelHash !== null &&
  !layoutSession.recentPlacements.some(p => p.labelHash === labelHash);

const event: BinPlacementEvent = {
  // ... existing fields
  recent_sizes: layoutSession.recentPlacements.slice(-3).map(p => p.size),
  time_since_last_ms: timeSinceLast,
  is_first_of_label: isFirstOfLabel,
};

// Update recent placements (keep last 5)
layoutSession.recentPlacements.push({
  size: binSize,
  labelHash,
  position: `${bin.x},${bin.y}`,
  timestamp: now,
});
if (layoutSession.recentPlacements.length > 5) {
  layoutSession.recentPlacements.shift();
}
```

#### Server Aggregation

```typescript
function aggregateBinPlacement(event: BinPlacementEvent, inc: Increments): void {
  // ... existing code ...

  // Track size sequences (last 3 -> this size)
  if (event.recent_sizes.length >= 2) {
    const seqKey = event.recent_sizes.slice(-2).join('>');
    const fullSeqKey = `ml:seq:${seqKey}`;
    inc[fullSeqKey] = inc[fullSeqKey] || {};
    inc[fullSeqKey][event.bin_size] =
      (inc[fullSeqKey][event.bin_size] || 0) + 1;
  }

  // Track timing patterns
  if (event.time_since_last_ms !== null) {
    const timingBucket = event.time_since_last_ms < 2_000 ? 'rapid' :
      event.time_since_last_ms < 10_000 ? 'normal' : 'deliberate';
    inc['ml:placement_timing'] = inc['ml:placement_timing'] || {};
    inc['ml:placement_timing'][timingBucket] =
      (inc['ml:placement_timing'][timingBucket] || 0) + 1;
  }

  // Track label repeat vs first patterns
  inc['ml:label_sequence'] = inc['ml:label_sequence'] || {};
  inc['ml:label_sequence'][event.is_first_of_label ? 'first' : 'repeat'] =
    (inc['ml:label_sequence'][event.is_first_of_label ? 'first' : 'repeat'] || 0) + 1;
}
```

### Files to Modify
- `src/shared/analytics/mlTelemetry.ts` - Extend session state and tracking
- `api/ml-telemetry.ts` - Add validation and aggregation

### Effort
**2-3 hours**

### ML Impact
**High** - Enables sequence-aware recommendations

---

## Priority 6: Vocabulary Expansion (Longer Term)

### Problem
While the vocabulary has 41 terms with multi-language support, it's missing several important categories.

### Current Vocabulary Categories
- Tools (8 terms)
- Fasteners (5 terms)
- Electronics (9 terms)
- Office (4 terms)
- Craft (3 terms)
- 3D Printing (5 terms)
- Misc (7 terms)

### Missing Categories to Add

#### Garage/Automotive
```typescript
zip_tie: ['zip tie', 'cable tie', 'kabelbinder', 'collier de serrage', ...],
hose_fitting: ['hose fitting', 'hose clamp', 'schlauchschelle', ...],
fuse: ['fuse', 'fuses', 'sicherung', 'fusible', ...],
spark_plug: ['spark plug', 'zündkerze', 'bougie', ...],
o_ring: ['o-ring', 'o ring', 'dichtring', 'joint torique', ...],
```

#### Kitchen
```typescript
spice: ['spice', 'spices', 'seasoning', 'gewürz', 'épice', ...],
tea_bag: ['tea', 'tea bags', 'tee', 'thé', ...],
utensil: ['utensil', 'cutlery', 'besteck', 'couverts', ...],
```

#### Office (Expanded)
```typescript
staple: ['staple', 'staples', 'heftklammer', 'agrafe', ...],
rubber_band: ['rubber band', 'elastic', 'gummiband', 'élastique', ...],
sticky_note: ['sticky note', 'post-it', 'haftnotiz', ...],
thumbtack: ['thumbtack', 'pushpin', 'reißzwecke', 'punaise', ...],
```

#### Craft (Expanded)
```typescript
bead: ['bead', 'beads', 'perle', 'perlen', 'cuenta', ...],
button: ['button', 'buttons', 'knopf', 'bouton', 'botón', ...],
thread: ['thread', 'sewing thread', 'faden', 'fil', 'hilo', ...],
needle: ['needle', 'needles', 'nadel', 'aiguille', 'aguja', ...],
sequin: ['sequin', 'sequins', 'paillette', 'lentejuela', ...],
```

#### First Aid/Medical (Expanded)
```typescript
bandage: ['bandage', 'band-aid', 'pflaster', 'pansement', ...],
cotton_ball: ['cotton ball', 'cotton', 'watte', 'coton', ...],
thermometer: ['thermometer', 'fieberthermometer', 'thermomètre', ...],
```

#### Dimensional Modifiers (New Domain)
```typescript
// These should be recognized as size hints, not item types
METRIC_SIZES: ['m2', 'm3', 'm4', 'm5', 'm6', 'm8', 'm10', 'm12'],
IMPERIAL_SIZES: ['1/4"', '3/8"', '1/2"', '#4', '#6', '#8', '#10'],
```

### Implementation Approach

1. **Add new terms to VOCABULARY** (1 week)
2. **Add new domains to TERM_DOMAINS** (included with above)
3. **Add dimensional pattern recognition**:
   ```typescript
   // Detect "M3 bolt" -> domain: fasteners, size_hint: 'm3'
   function extractDimensionalHint(label: string): string | null {
     const metricMatch = label.match(/\bm(\d+)\b/i);
     if (metricMatch) return `m${metricMatch[1]}`;

     const imperialMatch = label.match(/(\d+\/\d+)["']?/);
     if (imperialMatch) return imperialMatch[1];

     return null;
   }
   ```
4. **Bump VOCAB_VERSION to v2**
5. **Track unknown term frequency** to discover gaps

### Files to Modify
- `src/shared/analytics/labelVocabulary.ts` - Add terms and patterns
- `api/ml-telemetry.ts` - Update validation patterns if needed

### Effort
**1 week**

### ML Impact
**High** - More labels get normalized, improving pattern recognition

---

## Implementation Timeline

### Week 1: Quick Wins
- [ ] Priority 1: Resize Direction (2 hours)
- [ ] Priority 2: Fix Bin Age Tracking (30 minutes)
- [ ] Priority 4: Abandoned Bin Detection (2 hours)
- [ ] Write tests for new fields
- [ ] Deploy and monitor validation rates

### Week 2: Context Enrichment
- [ ] Priority 3: Adjacent Labels Context (3 hours)
- [ ] Priority 5: Placement Sequence Tracking (3 hours)
- [ ] Update audit script for new Redis keys
- [ ] Deploy and validate

### Week 3: Vocabulary
- [ ] Priority 6: Add new vocabulary terms
- [ ] Add dimensional pattern recognition
- [ ] Bump vocab version to v2
- [ ] Deploy and monitor unknown term rates

### Week 4: Validation & Documentation
- [ ] Run production audit to validate improvements
- [ ] Update `docs/ml-telemetry-audit.md` with new keys
- [ ] Create baseline metrics for ML model training readiness
- [ ] Document any follow-up improvements

---

## Testing Strategy

### Unit Tests
```typescript
// For resize direction
describe('trackBinResize', () => {
  it('detects grow direction when both dimensions increase', () => {
    trackBinResize({ width: 1, depth: 1 }, { width: 2, depth: 2 }, 3, layout);
    expect(lastEvent.resize_direction).toBe('grow');
  });

  it('detects shrink direction when area decreases', () => {
    trackBinResize({ width: 3, depth: 3 }, { width: 2, depth: 2 }, 3, layout);
    expect(lastEvent.resize_direction).toBe('shrink');
  });

  it('detects mixed when width grows but depth shrinks', () => {
    trackBinResize({ width: 1, depth: 3 }, { width: 2, depth: 2 }, 3, layout);
    expect(lastEvent.resize_direction).toBe('mixed');
  });
});

// For abandoned bin detection
describe('trackBinDeletion', () => {
  it('emits abandoned event for unlabeled bin deleted within 5 min', () => {
    recordBinCreation(bin.id, 'draw', '1x1x3');
    // Simulate 30 seconds passing
    trackBinDeletion({ ...bin, label: '' }, layout, 'key', 1);
    expect(events).toContainEqual(expect.objectContaining({ type: 'bin_abandoned' }));
  });
});
```

### Integration Tests
- Verify events pass server validation
- Verify Redis keys are populated correctly
- Verify audit script reports new metrics

---

## Success Metrics

After implementation, track:

1. **Data Quality**
   - Validation pass rate should remain > 98%
   - New fields should have < 1% null/missing rate

2. **Signal Coverage**
   - `ml:neg:resize_direction` should have events within 1 week
   - `ml:neg:delete_age` should populate (previously always null)
   - `ml:neg:abandoned` should capture real patterns

3. **Volume Thresholds**
   - Target 1,000 sessions before first model training
   - Target 10,000 placement events with adjacent context

---

## Future Considerations

After these improvements, consider:

1. **Explicit Feedback UI** - Add thumbs up/down after fill operations
2. **A/B Testing Framework** - Test recommendation quality
3. **Model Serving Infrastructure** - Real-time inference endpoint
4. **Personalization** - Per-user preferences (opt-in)

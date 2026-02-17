# Smart Size Suggestions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Tetris-style "Next Bin" feature that predicts the best bin size and grid position from community ML telemetry, and auto-places on click.

**Architecture:** New Labs feature (`size-suggestions`). Server-side `/api/size-suggest` endpoint queries existing Redis ML aggregates, scores sizes via weighted Markov chain + negative signal penalty, ranks positions by spatial/gap-fit heuristics. Client-side Zustand store + floating NextBinPreview panel + ghost overlay on grid. Keyboard shortcut `N` to accept.

**Tech Stack:** Vercel serverless (ioredis), React, Zustand, Tailwind, Vitest, existing ML telemetry Redis keys.

**Design doc:** `docs/plans/2026-02-17-smart-size-suggestions-design.md`

---

### Task 1: Register Labs Feature Flag

**Files:**

- Modify: `src/core/labs/features.ts`
- Test: `src/core/store/labs.test.ts`

**Step 1: Write the failing test**

In `src/core/store/labs.test.ts`, add a test that the feature flag exists:

```typescript
it('should include size-suggestions feature flag', () => {
  const feature = getFeature('size-suggestions');
  expect(feature).toBeDefined();
  expect(feature?.status).toBe('experimental');
  expect(feature?.defaultEnabled).toBe(false);
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/core/store/labs.test.ts`
Expected: FAIL — `getFeature('size-suggestions')` returns undefined

**Step 3: Add the feature flag**

In `src/core/labs/features.ts`, add to the `FEATURE_FLAGS` array before the `as const`:

```typescript
{
  id: 'size-suggestions',
  name: 'Smart Size Suggestions',
  description:
    'Tetris-style "Next Bin" predictions based on community usage patterns. Shows a suggested bin size and position — click to auto-place.',
  status: 'experimental',
  risk: 'low',
  addedAt: '2026-02',
  requiresRefresh: false,
  defaultEnabled: false,
},
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/core/store/labs.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/labs/features.ts src/core/store/labs.test.ts
git commit -m "feat(labs): register size-suggestions feature flag"
```

---

### Task 2: Add `'suggestion'` Placement Method to ML Telemetry Types

**Files:**

- Modify: `src/shared/analytics/mlTelemetry/types.ts:656`

**Step 1: Update PlacementMethod type**

In `src/shared/analytics/mlTelemetry/types.ts` line 656, change:

```typescript
export type PlacementMethod = 'draw' | 'fill' | 'duplicate' | 'staging' | 'paint';
```

to:

```typescript
export type PlacementMethod = 'draw' | 'fill' | 'duplicate' | 'staging' | 'paint' | 'suggestion';
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS (no consumers break since the union is widened, not narrowed)

**Step 3: Commit**

```bash
git add src/shared/analytics/mlTelemetry/types.ts
git commit -m "feat(telemetry): add 'suggestion' placement method"
```

---

### Task 3: Add i18n Keys

**Files:**

- Modify: `src/i18n/locales/en.ts`
- Modify: `src/i18n/locales/de.json`, `es.json`, `fr.json`, `nb.json`, `nl.json`, `pt-BR.json`

**Step 1: Add English keys**

In `src/i18n/locales/en.ts`, add in alphabetical order among sibling sections:

```typescript
'sizeSuggestion.dismiss': 'Dismiss',
'sizeSuggestion.next': 'Next',
'sizeSuggestion.placed': 'Placed {size} bin',
'sizeSuggestion.useSize': 'Use suggested size: {size}',
```

**Step 2: Add keys to all JSON locale files**

Add the same four keys (English values as placeholders) to each JSON locale file: `de.json`, `es.json`, `fr.json`, `nb.json`, `nl.json`, `pt-BR.json`.

**Step 3: Run i18n check**

Run: `npm run check:i18n`
Expected: PASS

**Step 4: Commit**

```bash
git add src/i18n/locales/
git commit -m "feat(i18n): add sizeSuggestion keys for all locales"
```

---

### Task 4: Create API Endpoint — `/api/size-suggest.ts`

**Files:**

- Create: `api/size-suggest.ts`
- Create: `api/lib/sizeSuggest.ts` (scoring logic, testable)
- Create: `api/lib/sizeSuggest.test.ts`

**Step 1: Write the scoring logic tests**

Create `api/lib/sizeSuggest.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { scoreSizes, rankPositions, parseOccupied } from './sizeSuggest';

describe('scoreSizes', () => {
  it('should return scored sizes from drawer frequency data', () => {
    const drawerFreq = { '1x1': 50, '2x1': 30, '2x2': 20 };
    const result = scoreSizes({
      drawerFreq,
      transitionFreq: {},
      labelFreq: {},
      correctionFreq: {},
    });
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].score).toBeGreaterThanOrEqual(result[1].score);
  });

  it('should penalize frequently corrected sizes', () => {
    const drawerFreq = { '1x1': 50, '2x1': 50 };
    const correctionFreq = { '1x1': 40, '2x1': 0 };
    const result = scoreSizes({ drawerFreq, transitionFreq: {}, labelFreq: {}, correctionFreq });
    const score1x1 = result.find((s) => s.size === '1x1')!.score;
    const score2x1 = result.find((s) => s.size === '2x1')!.score;
    expect(score2x1).toBeGreaterThan(score1x1);
  });

  it('should boost transition probability when prev is provided', () => {
    const drawerFreq = { '1x1': 50, '2x1': 50 };
    const transitionFreq = { '2x1': 80, '1x1': 5 };
    const result = scoreSizes({ drawerFreq, transitionFreq, labelFreq: {}, correctionFreq: {} });
    const score2x1 = result.find((s) => s.size === '2x1')!.score;
    const score1x1 = result.find((s) => s.size === '1x1')!.score;
    expect(score2x1).toBeGreaterThan(score1x1);
  });

  it('should return empty array when no frequency data exists', () => {
    const result = scoreSizes({
      drawerFreq: {},
      transitionFreq: {},
      labelFreq: {},
      correctionFreq: {},
    });
    expect(result).toEqual([]);
  });
});

describe('rankPositions', () => {
  it('should find valid position for size in empty grid', () => {
    const result = rankPositions('2x1', [], { width: 6, depth: 4 }, {});
    expect(result).toBeDefined();
    expect(result!.x).toBe(0);
    expect(result!.y).toBe(0);
  });

  it('should avoid occupied cells', () => {
    const occupied = [{ x: 0, y: 0, width: 2, depth: 1 }];
    const result = rankPositions('2x1', occupied, { width: 6, depth: 4 }, {});
    expect(result).toBeDefined();
    expect(result!.x).toBeGreaterThanOrEqual(2);
  });

  it('should return null when grid is full', () => {
    const occupied = [{ x: 0, y: 0, width: 6, depth: 4 }];
    const result = rankPositions('2x1', occupied, { width: 6, depth: 4 }, {});
    expect(result).toBeNull();
  });
});

describe('parseOccupied', () => {
  it('should parse tuple array to rect array', () => {
    const result = parseOccupied([
      [0, 0, 2, 1],
      [3, 1, 1, 1],
    ]);
    expect(result).toEqual([
      { x: 0, y: 0, width: 2, depth: 1 },
      { x: 3, y: 1, width: 1, depth: 1 },
    ]);
  });

  it('should return empty array for invalid input', () => {
    expect(parseOccupied(null as unknown as number[][])).toEqual([]);
    expect(parseOccupied([])).toEqual([]);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm run test:run -- api/lib/sizeSuggest.test.ts`
Expected: FAIL — module not found

**Step 3: Implement scoring logic**

Create `api/lib/sizeSuggest.ts`:

```typescript
/**
 * Size suggestion scoring and position ranking logic.
 *
 * Scoring weights:
 * - 0.3 drawer frequency (what sizes are common for this drawer?)
 * - 0.4 transition frequency (what size follows the previous one?)
 * - 0.2 label frequency (what sizes are used with these labels?)
 * - -0.1 correction penalty (sizes that get quickly corrected are bad)
 *
 * Position ranking: gap-filling bottom-left, with telemetry-based edge
 * usage and adjacency boosts when data is available.
 */

interface FreqMap {
  [key: string]: number;
}

interface ScoreInput {
  drawerFreq: FreqMap;
  transitionFreq: FreqMap;
  labelFreq: FreqMap;
  correctionFreq: FreqMap;
}

export interface ScoredSize {
  size: string;
  score: number;
}

interface OccupiedRect {
  x: number;
  y: number;
  width: number;
  depth: number;
}

interface DrawerSize {
  width: number;
  depth: number;
}

interface EdgeUsage {
  [position: string]: number;
}

function normalize(freq: FreqMap): FreqMap {
  const total = Object.values(freq).reduce((a, b) => a + b, 0);
  if (total === 0) return {};
  const result: FreqMap = {};
  for (const [k, v] of Object.entries(freq)) {
    result[k] = v / total;
  }
  return result;
}

export function scoreSizes(input: ScoreInput): ScoredSize[] {
  const { drawerFreq, transitionFreq, labelFreq, correctionFreq } = input;

  // Collect all candidate sizes
  const allSizes = new Set([
    ...Object.keys(drawerFreq),
    ...Object.keys(transitionFreq),
    ...Object.keys(labelFreq),
  ]);

  if (allSizes.size === 0) return [];

  const normDrawer = normalize(drawerFreq);
  const normTrans = normalize(transitionFreq);
  const normLabel = normalize(labelFreq);
  const normCorrection = normalize(correctionFreq);

  // Determine weights — redistribute when signals are absent
  const hasTrans = Object.keys(transitionFreq).length > 0;
  const hasLabel = Object.keys(labelFreq).length > 0;

  let wDrawer = 0.3;
  let wTrans = hasTrans ? 0.4 : 0;
  let wLabel = hasLabel ? 0.2 : 0;
  const wCorrection = 0.1;

  // Redistribute missing weights to drawer
  const totalPositive = wDrawer + wTrans + wLabel;
  if (totalPositive > 0 && totalPositive < 0.9) {
    const scale = 0.9 / totalPositive;
    wDrawer *= scale;
    wTrans *= scale;
    wLabel *= scale;
  }

  const scored: ScoredSize[] = [];
  for (const size of allSizes) {
    const score =
      wDrawer * (normDrawer[size] ?? 0) +
      wTrans * (normTrans[size] ?? 0) +
      wLabel * (normLabel[size] ?? 0) -
      wCorrection * (normCorrection[size] ?? 0);

    scored.push({ size, score: Math.max(0, score) });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 3);
}

function parseSize(size: string): { width: number; depth: number } | null {
  const match = size.match(/^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/);
  if (!match) return null;
  return { width: Number(match[1]), depth: Number(match[2]) };
}

function overlaps(a: OccupiedRect, b: OccupiedRect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.depth && a.y + a.depth > b.y;
}

export function rankPositions(
  size: string,
  occupied: OccupiedRect[],
  drawer: DrawerSize,
  _edgeUsage: EdgeUsage
): { x: number; y: number } | null {
  const parsed = parseSize(size);
  if (!parsed) return null;

  const { width, depth } = parsed;

  // Scan bottom-left to top-right (matches grid origin = bottom-left)
  // Step by 0.5 to support half-bin mode
  const step = 0.5;
  for (let y = 0; y <= drawer.depth - depth; y += step) {
    for (let x = 0; x <= drawer.width - width; x += step) {
      const candidate = { x, y, width, depth };
      const collision = occupied.some((occ) => overlaps(occ, candidate));
      if (!collision) {
        return { x, y };
      }
    }
  }

  return null;
}

export function parseOccupied(tuples: unknown): OccupiedRect[] {
  if (!Array.isArray(tuples)) return [];
  const result: OccupiedRect[] = [];
  for (const tuple of tuples) {
    if (
      Array.isArray(tuple) &&
      tuple.length === 4 &&
      tuple.every((v) => typeof v === 'number' && isFinite(v))
    ) {
      result.push({ x: tuple[0], y: tuple[1], width: tuple[2], depth: tuple[3] });
    }
  }
  return result;
}
```

**Step 4: Run tests to verify they pass**

Run: `npm run test:run -- api/lib/sizeSuggest.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add api/lib/sizeSuggest.ts api/lib/sizeSuggest.test.ts
git commit -m "feat(api): add size suggestion scoring and position logic"
```

**Step 6: Create the API endpoint**

Create `api/size-suggest.ts`. Pattern matches existing endpoints (`api/share.ts`):

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash } from 'crypto';
import { Redis } from 'ioredis';
import type { RedisOptions } from 'ioredis';
import { checkRateLimit, getClientIP } from './lib/rateLimit.js';
import { scoreSizes, rankPositions, parseOccupied } from './lib/sizeSuggest.js';

// Same Redis setup as ml-telemetry.ts
function parseRedisUrl(url: string): RedisOptions {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port) || 6379,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
    tls: parsed.protocol === 'rediss:' ? {} : undefined,
    db: parsed.pathname ? Number(parsed.pathname.slice(1)) || 0 : 0,
  };
}

let redis: Redis | null = null;
function getRedis(): Redis {
  if (!redis) {
    const url = process.env.KV_REST_API_URL ?? process.env.REDIS_URL;
    if (!url) throw new Error('No Redis URL configured');
    const config = parseRedisUrl(url);
    redis = new Redis({
      ...config,
      commandTimeout: 5000,
      connectTimeout: 5000,
      maxRetriesPerRequest: 1,
    });
  }
  return redis;
}

const VALID_DRAWER_REGEX = /^\d+(?:\.\d+)?x\d+(?:\.\d+)?$/;
const VALID_SIZE_REGEX = /^\d+(?:\.\d+)?x\d+(?:\.\d+)?$/;
const VALID_HASH_REGEX = /^[a-f0-9]{8}$/;
const CACHE_TTL = 60; // seconds

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Rate limiting (reuse CRUD limiter)
    const clientIP = getClientIP(req);
    const rateLimit = await checkRateLimit(clientIP, 'create');
    if (!rateLimit.allowed) {
      return res
        .status(429)
        .json({ error: 'Rate limited', retryAfter: rateLimit.retryAfterSeconds });
    }

    // Parse and validate input
    const body = (req.body ?? {}) as Record<string, unknown>;
    const { drawer, prev, labels, occupied } = body;

    if (typeof drawer !== 'string' || !VALID_DRAWER_REGEX.test(drawer)) {
      return res.status(400).json({ error: 'Invalid drawer size' });
    }

    if (
      prev !== undefined &&
      prev !== null &&
      (typeof prev !== 'string' || !VALID_SIZE_REGEX.test(prev))
    ) {
      return res.status(400).json({ error: 'Invalid prev size' });
    }

    const validLabels: string[] = [];
    if (Array.isArray(labels)) {
      for (const l of labels) {
        if (typeof l === 'string' && VALID_HASH_REGEX.test(l)) {
          validLabels.push(l);
        }
      }
    }

    const occupiedRects = parseOccupied(occupied);

    // Check cache
    const cacheKey = `ml:suggest:${createHash('sha256')
      .update(JSON.stringify({ drawer, prev, labels: validLabels, occupied: occupiedRects }))
      .digest('hex')
      .slice(0, 16)}`;
    const r = getRedis();
    const cached = await r.get(cacheKey);
    if (cached) {
      return res.status(200).json(JSON.parse(cached));
    }

    // Fetch frequency data from Redis (parallel)
    const [drawerData, transData, correctionData, ...labelData] = await Promise.all([
      r.hgetall(`ml:drawer:${drawer}`),
      prev ? r.hgetall(`ml:trans:${prev}`) : Promise.resolve({}),
      r.hgetall('ml:neg:corrected_sizes'),
      ...validLabels.slice(0, 5).map((h) => r.hgetall(`ml:label_hash:${h}`)),
    ]);

    // Merge label frequency data
    const labelFreq: Record<string, number> = {};
    for (const data of labelData) {
      for (const [size, count] of Object.entries(data)) {
        labelFreq[size] = (labelFreq[size] ?? 0) + Number(count);
      }
    }

    // Convert string values to numbers
    const toNumMap = (obj: Record<string, string>): Record<string, number> => {
      const result: Record<string, number> = {};
      for (const [k, v] of Object.entries(obj)) {
        result[k] = Number(v);
      }
      return result;
    };

    // Score sizes
    const scored = scoreSizes({
      drawerFreq: toNumMap(drawerData),
      transitionFreq: toNumMap(transData as Record<string, string>),
      labelFreq,
      correctionFreq: toNumMap(correctionData),
    });

    if (scored.length === 0) {
      // Cold start fallback: use global size data
      const globalSizes = await r.hgetall('ml:sizes');
      const fallbackScored = scoreSizes({
        drawerFreq: toNumMap(globalSizes),
        transitionFreq: {},
        labelFreq: {},
        correctionFreq: toNumMap(correctionData),
      });

      if (fallbackScored.length === 0) {
        const response = { suggestions: [], source: 'none' };
        await r.setex(cacheKey, CACHE_TTL, JSON.stringify(response));
        return res.status(200).json(response);
      }

      scored.push(...fallbackScored);
    }

    // Parse drawer size for position ranking
    const drawerMatch = drawer.match(/^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/);
    const drawerSize = drawerMatch
      ? { width: Number(drawerMatch[1]), depth: Number(drawerMatch[2]) }
      : { width: 6, depth: 4 };

    // Fetch edge usage for position ranking
    const edgeUsage = await r.hgetall('ml:edge_usage');

    // Add positions to suggestions
    const suggestions = scored
      .map((s) => {
        const position = rankPositions(s.size, occupiedRects, drawerSize, edgeUsage);
        return {
          size: s.size,
          score: Math.round(s.score * 100) / 100,
          position,
          positionSource: 'gap_fill',
        };
      })
      .filter((s) => s.position !== null);

    const sources: string[] = [];
    if (Object.keys(drawerData).length > 0) sources.push('drawer');
    if (prev && Object.keys(transData as Record<string, string>).length > 0)
      sources.push('transition');
    if (Object.keys(labelFreq).length > 0) sources.push('label');

    const response = {
      suggestions,
      source: sources.length > 0 ? sources.join('+') : 'global',
    };

    await r.setex(cacheKey, CACHE_TTL, JSON.stringify(response));
    return res.status(200).json(response);
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
}
```

**Step 7: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 8: Commit**

```bash
git add api/size-suggest.ts
git commit -m "feat(api): add /api/size-suggest endpoint"
```

---

### Task 5: Create Client-Side Store and Fetch Hook

**Files:**

- Create: `src/features/size-suggestions/store/index.ts`
- Create: `src/features/size-suggestions/hooks/useSizeSuggestions.ts`
- Create: `src/features/size-suggestions/hooks/useSizeSuggestions.test.ts`
- Create: `src/features/size-suggestions/hooks/index.ts`
- Create: `src/features/size-suggestions/index.ts`
- Create: `src/features/size-suggestions/types.ts`

**Step 1: Create types file**

Create `src/features/size-suggestions/types.ts`:

```typescript
export interface SizeSuggestion {
  size: string;
  score: number;
  position: { x: number; y: number } | null;
  positionSource: string;
}

export interface SizeSuggestResponse {
  suggestions: SizeSuggestion[];
  source: string;
}
```

**Step 2: Create the Zustand store**

Create `src/features/size-suggestions/store/index.ts`:

```typescript
import { create } from 'zustand';
import type { SizeSuggestion } from '../types';

interface SizeSuggestionState {
  suggestions: SizeSuggestion[];
  isLoading: boolean;
  isDismissed: boolean;
  lastFetchParams: string | null;
  setSuggestions: (suggestions: SizeSuggestion[]) => void;
  setLoading: (loading: boolean) => void;
  dismiss: () => void;
  reset: () => void;
  setLastFetchParams: (params: string) => void;
}

export const useSizeSuggestionStore = create<SizeSuggestionState>()((set) => ({
  suggestions: [],
  isLoading: false,
  isDismissed: false,
  lastFetchParams: null,

  setSuggestions: (suggestions) => set({ suggestions, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
  dismiss: () => set({ isDismissed: true, suggestions: [] }),
  reset: () =>
    set({ suggestions: [], isLoading: false, isDismissed: false, lastFetchParams: null }),
  setLastFetchParams: (lastFetchParams) => set({ lastFetchParams }),
}));
```

**Step 3: Write the fetch hook test**

Create `src/features/size-suggestions/hooks/useSizeSuggestions.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useSizeSuggestionStore } from '../store';

describe('useSizeSuggestionStore', () => {
  beforeEach(() => {
    useSizeSuggestionStore.getState().reset();
  });

  it('should set suggestions', () => {
    const suggestions = [
      { size: '2x1', score: 0.8, position: { x: 0, y: 0 }, positionSource: 'gap_fill' },
    ];
    useSizeSuggestionStore.getState().setSuggestions(suggestions);
    expect(useSizeSuggestionStore.getState().suggestions).toEqual(suggestions);
    expect(useSizeSuggestionStore.getState().isLoading).toBe(false);
  });

  it('should dismiss and clear suggestions', () => {
    useSizeSuggestionStore
      .getState()
      .setSuggestions([
        { size: '1x1', score: 0.5, position: { x: 0, y: 0 }, positionSource: 'gap_fill' },
      ]);
    useSizeSuggestionStore.getState().dismiss();
    expect(useSizeSuggestionStore.getState().isDismissed).toBe(true);
    expect(useSizeSuggestionStore.getState().suggestions).toEqual([]);
  });

  it('should reset all state', () => {
    useSizeSuggestionStore
      .getState()
      .setSuggestions([
        { size: '1x1', score: 0.5, position: { x: 0, y: 0 }, positionSource: 'gap_fill' },
      ]);
    useSizeSuggestionStore.getState().dismiss();
    useSizeSuggestionStore.getState().reset();
    expect(useSizeSuggestionStore.getState().isDismissed).toBe(false);
    expect(useSizeSuggestionStore.getState().suggestions).toEqual([]);
  });

  it('should deduplicate fetches via lastFetchParams', () => {
    useSizeSuggestionStore.getState().setLastFetchParams('6x4|2x1|abc');
    expect(useSizeSuggestionStore.getState().lastFetchParams).toBe('6x4|2x1|abc');
  });
});
```

**Step 4: Run tests**

Run: `npm run test:run -- src/features/size-suggestions/hooks/useSizeSuggestions.test.ts`
Expected: PASS (store tests are synchronous)

**Step 5: Implement the fetch hook**

Create `src/features/size-suggestions/hooks/useSizeSuggestions.ts`:

```typescript
import { useCallback, useEffect, useRef } from 'react';
import { useLayoutStore } from '@/core/store/layout';
import { useLabsStore } from '@/core/store/labs';
import { useSizeSuggestionStore } from '../store';
import type { SizeSuggestResponse } from '../types';

const DEBOUNCE_MS = 2000;

/**
 * Hook that fetches size suggestions from the API when context changes.
 * Gated behind the 'size-suggestions' Labs feature flag.
 */
export function useSizeSuggestions() {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchSuggestions = useCallback(async () => {
    const enabled = useLabsStore.getState().isFeatureEnabled('size-suggestions');
    if (!enabled) return;

    const { isDismissed, lastFetchParams, setLoading, setSuggestions, setLastFetchParams } =
      useSizeSuggestionStore.getState();
    if (isDismissed) return;

    const layout = useLayoutStore.getState().layout;
    const { drawer, bins } = layout;

    // Build request params
    const drawerKey = `${drawer.width}x${drawer.depth}`;
    const onGridBins = bins.filter((b) => b.layerId !== '__staging__');
    const lastBin = onGridBins[onGridBins.length - 1];
    const prev = lastBin ? `${lastBin.width}x${lastBin.depth}` : undefined;
    const labels = [...new Set(onGridBins.filter((b) => b.label).map((b) => b.label!))].slice(0, 5);
    const occupied = onGridBins.map((b) => [b.x, b.y, b.width, b.depth]);

    // Dedup check
    const paramKey = `${drawerKey}|${prev ?? ''}|${labels.join(',')}|${occupied.length}`;
    if (paramKey === lastFetchParams) return;

    setLastFetchParams(paramKey);
    setLoading(true);

    // Cancel previous request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch('/api/size-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drawer: drawerKey, prev, labels, occupied }),
        signal: controller.signal,
      });

      if (!response.ok) {
        setSuggestions([]);
        return;
      }

      const data = (await response.json()) as SizeSuggestResponse;
      setSuggestions(data.suggestions);
    } catch {
      // Silently fail — this is a nice-to-have feature
      setSuggestions([]);
    }
  }, []);

  const debouncedFetch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fetchSuggestions, DEBOUNCE_MS);
  }, [fetchSuggestions]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, []);

  return { fetchSuggestions, debouncedFetch };
}
```

**Step 6: Create barrel exports**

Create `src/features/size-suggestions/hooks/index.ts`:

```typescript
export { useSizeSuggestions } from './useSizeSuggestions';
```

Create `src/features/size-suggestions/index.ts`:

```typescript
export { useSizeSuggestionStore } from './store';
export { useSizeSuggestions } from './hooks';
export type { SizeSuggestion, SizeSuggestResponse } from './types';
```

**Step 7: Commit**

```bash
git add src/features/size-suggestions/
git commit -m "feat(size-suggestions): add store, fetch hook, and types"
```

---

### Task 6: Create NextBinPreview Component

**Files:**

- Create: `src/features/size-suggestions/components/NextBinPreview/NextBinPreview.tsx`
- Create: `src/features/size-suggestions/components/NextBinPreview/NextBinPreview.test.tsx`
- Create: `src/features/size-suggestions/components/NextBinPreview/index.ts`
- Create: `src/features/size-suggestions/components/index.ts`

**Step 1: Write the component test**

Create `src/features/size-suggestions/components/NextBinPreview/NextBinPreview.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NextBinPreview } from './NextBinPreview';
import { useSizeSuggestionStore } from '../../store';

// Mock i18n
vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string, vars?: Record<string, string>) => {
    if (key === 'sizeSuggestion.next') return 'Next';
    if (key === 'sizeSuggestion.useSize') return `Use suggested size: ${vars?.size}`;
    if (key === 'sizeSuggestion.dismiss') return 'Dismiss';
    return key;
  },
}));

describe('NextBinPreview', () => {
  const mockOnAccept = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useSizeSuggestionStore.getState().reset();
  });

  it('should render nothing when no suggestions', () => {
    const { container } = render(
      <NextBinPreview onAccept={mockOnAccept} categoryColor="#4f46e5" />
    );
    expect(container.firstChild).toBeNull();
  });

  it('should render suggestion when available', () => {
    useSizeSuggestionStore.getState().setSuggestions([
      { size: '2x1', score: 0.8, position: { x: 0, y: 0 }, positionSource: 'gap_fill' },
    ]);
    render(<NextBinPreview onAccept={mockOnAccept} categoryColor="#4f46e5" />);
    expect(screen.getByText('Next')).toBeInTheDocument();
    expect(screen.getByText('2 × 1')).toBeInTheDocument();
  });

  it('should call onAccept when clicked', () => {
    useSizeSuggestionStore.getState().setSuggestions([
      { size: '2x1', score: 0.8, position: { x: 0, y: 0 }, positionSource: 'gap_fill' },
    ]);
    render(<NextBinPreview onAccept={mockOnAccept} categoryColor="#4f46e5" />);
    fireEvent.click(screen.getByRole('button', { name: /use suggested size/i }));
    expect(mockOnAccept).toHaveBeenCalledWith({ size: '2x1', score: 0.8, position: { x: 0, y: 0 }, positionSource: 'gap_fill' });
  });

  it('should hide when dismissed', () => {
    useSizeSuggestionStore.getState().setSuggestions([
      { size: '2x1', score: 0.8, position: { x: 0, y: 0 }, positionSource: 'gap_fill' },
    ]);
    const { container } = render(<NextBinPreview onAccept={mockOnAccept} categoryColor="#4f46e5" />);
    fireEvent.click(screen.getByLabelText('Dismiss'));
    expect(container.querySelector('[role="complementary"]')).toBeNull();
  });

  it('should render nothing when dismissed', () => {
    useSizeSuggestionStore.getState().dismiss();
    useSizeSuggestionStore.getState().setSuggestions([
      { size: '2x1', score: 0.8, position: { x: 0, y: 0 }, positionSource: 'gap_fill' },
    ]);
    const { container } = render(
      <NextBinPreview onAccept={mockOnAccept} categoryColor="#4f46e5" />
    );
    expect(container.firstChild).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/features/size-suggestions/components/NextBinPreview/NextBinPreview.test.tsx`
Expected: FAIL — module not found

**Step 3: Implement the component**

Create `src/features/size-suggestions/components/NextBinPreview/NextBinPreview.tsx`:

```tsx
import { useShallow } from 'zustand/react/shallow';
import { useTranslation } from '@/i18n';
import { useSizeSuggestionStore } from '../../store';
import type { SizeSuggestion } from '../../types';

interface NextBinPreviewProps {
  onAccept: (suggestion: SizeSuggestion) => void;
  categoryColor: string;
}

function MiniGrid({ size, color }: { size: string; color: string }) {
  const match = size.match(/^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/);
  if (!match) return null;

  const w = Number(match[1]);
  const d = Number(match[2]);
  const cellPx = 20;
  const maxDim = Math.max(w, d);
  const scale = maxDim > 3 ? 3 / maxDim : 1;

  return (
    <div
      className="rounded border border-border"
      style={{
        width: w * cellPx * scale,
        height: d * cellPx * scale,
        backgroundColor: `${color}33`,
        borderColor: color,
      }}
    />
  );
}

export function NextBinPreview({ onAccept, categoryColor }: NextBinPreviewProps) {
  const t = useTranslation();
  const { suggestions, isDismissed } = useSizeSuggestionStore(
    useShallow((s) => ({ suggestions: s.suggestions, isDismissed: s.isDismissed }))
  );
  const dismiss = useSizeSuggestionStore((s) => s.dismiss);

  const top = suggestions[0];
  if (!top || isDismissed || !top.position) return null;

  const displaySize = top.size.replace('x', ' × ');

  return (
    <div
      role="complementary"
      aria-label={t('sizeSuggestion.useSize', { size: displaySize })}
      className="absolute top-2 right-2 z-30 flex flex-col items-center gap-1 rounded-lg border border-border bg-surface p-2 shadow-md"
    >
      <div className="flex w-full items-center justify-between gap-2">
        <span className="text-xs text-muted">{t('sizeSuggestion.next')}</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            dismiss();
          }}
          aria-label={t('sizeSuggestion.dismiss')}
          className="text-muted hover:text-foreground -mr-1 h-4 w-4 text-xs leading-none"
        >
          ×
        </button>
      </div>
      <button
        onClick={() => onAccept(top)}
        aria-label={t('sizeSuggestion.useSize', { size: displaySize })}
        className="flex flex-col items-center gap-1 rounded p-1 hover:bg-surface-hover"
      >
        <MiniGrid size={top.size} color={categoryColor} />
        <span className="text-xs font-medium">{displaySize}</span>
      </button>
    </div>
  );
}
```

**Step 4: Create barrel exports**

Create `src/features/size-suggestions/components/NextBinPreview/index.ts`:

```typescript
export { NextBinPreview } from './NextBinPreview';
```

Create `src/features/size-suggestions/components/index.ts`:

```typescript
export { NextBinPreview } from './NextBinPreview';
```

**Step 5: Run tests**

Run: `npm run test:run -- src/features/size-suggestions/components/NextBinPreview/NextBinPreview.test.tsx`
Expected: PASS

**Step 6: Commit**

```bash
git add src/features/size-suggestions/components/
git commit -m "feat(size-suggestions): add NextBinPreview component"
```

---

### Task 7: Create SuggestionGhost Component

**Files:**

- Create: `src/features/size-suggestions/components/SuggestionGhost/SuggestionGhost.tsx`
- Create: `src/features/size-suggestions/components/SuggestionGhost/SuggestionGhost.test.tsx`
- Create: `src/features/size-suggestions/components/SuggestionGhost/index.ts`
- Modify: `src/features/size-suggestions/components/index.ts`

**Step 1: Write the component test**

Create `src/features/size-suggestions/components/SuggestionGhost/SuggestionGhost.test.tsx`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { SuggestionGhost } from './SuggestionGhost';
import { useSizeSuggestionStore } from '../../store';

describe('SuggestionGhost', () => {
  beforeEach(() => {
    useSizeSuggestionStore.getState().reset();
  });

  it('should render nothing when no suggestions', () => {
    const { container } = render(
      <SuggestionGhost cellSize={50} gap={2} categoryColor="#4f46e5" />
    );
    expect(container.firstChild).toBeNull();
  });

  it('should render ghost at correct position', () => {
    useSizeSuggestionStore.getState().setSuggestions([
      { size: '2x1', score: 0.8, position: { x: 1, y: 2 }, positionSource: 'gap_fill' },
    ]);
    const { container } = render(
      <SuggestionGhost cellSize={50} gap={2} categoryColor="#4f46e5" />
    );
    const ghost = container.firstChild as HTMLElement;
    expect(ghost).toBeTruthy();
    expect(ghost.style.left).toBe('52px');  // 1 * (50 + 2)
    expect(ghost.style.top).toBe('104px');  // 2 * (50 + 2)
    expect(ghost.style.width).toBe('102px'); // 2 * 50 + 1 * 2
    expect(ghost.style.height).toBe('50px'); // 1 * 50 + 0 * 2
  });

  it('should render nothing when dismissed', () => {
    useSizeSuggestionStore.getState().setSuggestions([
      { size: '2x1', score: 0.8, position: { x: 0, y: 0 }, positionSource: 'gap_fill' },
    ]);
    useSizeSuggestionStore.getState().dismiss();
    const { container } = render(
      <SuggestionGhost cellSize={50} gap={2} categoryColor="#4f46e5" />
    );
    expect(container.firstChild).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/features/size-suggestions/components/SuggestionGhost/SuggestionGhost.test.tsx`
Expected: FAIL — module not found

**Step 3: Implement the ghost overlay**

Create `src/features/size-suggestions/components/SuggestionGhost/SuggestionGhost.tsx`:

```tsx
import { useShallow } from 'zustand/react/shallow';
import { useSizeSuggestionStore } from '../../store';

interface SuggestionGhostProps {
  cellSize: number;
  gap: number;
  categoryColor: string;
}

export function SuggestionGhost({ cellSize, gap, categoryColor }: SuggestionGhostProps) {
  const { suggestions, isDismissed } = useSizeSuggestionStore(
    useShallow((s) => ({ suggestions: s.suggestions, isDismissed: s.isDismissed }))
  );

  const top = suggestions[0];
  if (!top || isDismissed || !top.position) return null;

  const match = top.size.match(/^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/);
  if (!match) return null;

  const w = Number(match[1]);
  const d = Number(match[2]);

  const left = top.position.x * (cellSize + gap);
  const topPos = top.position.y * (cellSize + gap);
  const width = w * cellSize + (w - 1) * gap;
  const height = d * cellSize + (d - 1) * gap;

  return (
    <div
      style={{
        position: 'absolute',
        left,
        top: topPos,
        width,
        height,
        border: `2px dashed ${categoryColor}`,
        backgroundColor: `${categoryColor}15`,
        borderRadius: 4,
        pointerEvents: 'none',
        zIndex: 5,
        transition: 'all 200ms ease-out',
      }}
    />
  );
}
```

**Step 4: Create barrel export and update parent**

Create `src/features/size-suggestions/components/SuggestionGhost/index.ts`:

```typescript
export { SuggestionGhost } from './SuggestionGhost';
```

Update `src/features/size-suggestions/components/index.ts`:

```typescript
export { NextBinPreview } from './NextBinPreview';
export { SuggestionGhost } from './SuggestionGhost';
```

Update `src/features/size-suggestions/index.ts`:

```typescript
export { useSizeSuggestionStore } from './store';
export { useSizeSuggestions } from './hooks';
export { NextBinPreview, SuggestionGhost } from './components';
export type { SizeSuggestion, SizeSuggestResponse } from './types';
```

**Step 5: Run tests**

Run: `npm run test:run -- src/features/size-suggestions/components/SuggestionGhost/SuggestionGhost.test.tsx`
Expected: PASS

**Step 6: Commit**

```bash
git add src/features/size-suggestions/
git commit -m "feat(size-suggestions): add SuggestionGhost overlay component"
```

---

### Task 8: Integrate Into Grid and Keyboard

**Files:**

- Modify: `src/features/grid-editor/components/Grid/Grid.tsx`
- Modify: `src/hooks/useKeyboard.ts`

**Step 1: Add NextBinPreview and SuggestionGhost to Grid**

In `src/features/grid-editor/components/Grid/Grid.tsx`:

1. Add imports:

```typescript
import {
  NextBinPreview,
  SuggestionGhost,
  useSizeSuggestionStore,
  useSizeSuggestions,
} from '@/features/size-suggestions';
import { useLabsStore } from '@/core/store/labs';
```

2. Inside the `Grid` component function, add:

```typescript
const sizeSuggestionsEnabled = useLabsStore((s) => s.isFeatureEnabled('size-suggestions'));
const { debouncedFetch, fetchSuggestions } = useSizeSuggestions();
```

3. Add an effect to fetch on layout load:

```typescript
useEffect(() => {
  if (sizeSuggestionsEnabled) {
    fetchSuggestions();
  }
}, [sizeSuggestionsEnabled, fetchSuggestions]);
```

4. Add a callback for accepting a suggestion:

```typescript
const handleSuggestionAccept = useCallback(
  (suggestion: { size: string; position: { x: number; y: number } | null }) => {
    if (!suggestion.position) return;
    const match = suggestion.size.match(/^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/);
    if (!match) return;
    const width = Number(match[1]);
    const depth = Number(match[2]);
    const layer = layout.layers.find((l) => l.id === activeLayerId);
    if (!layer) return;

    execute(() => {
      const binData = {
        layerId: activeLayerId,
        x: suggestion.position!.x,
        y: suggestion.position!.y,
        width,
        depth,
        height: layer.height,
        category: activeCategoryId,
        label: '',
        notes: '',
      };
      const result = addBin(binData);
      if (isOk(result)) {
        setSelectedBin(result.value);
        const placedBin: Bin = { ...binData, id: result.value };
        mlTracking.trackPlacement(placedBin, 'suggestion');
        mlTracking.recordCreation(result.value, 'suggestion', suggestion.size);
      }
    });
    // Re-fetch with updated context
    debouncedFetch();
  },
  [layout, activeLayerId, activeCategoryId, addBin, execute, setSelectedBin, debouncedFetch]
);
```

5. Render components in the grid area (near the existing `<Overlay>` element):

```tsx
{
  sizeSuggestionsEnabled && (
    <>
      <SuggestionGhost cellSize={cellSize} gap={gap} categoryColor={/* active category color */} />
      <NextBinPreview
        onAccept={handleSuggestionAccept}
        categoryColor={/* active category color */}
      />
    </>
  );
}
```

**Note:** The exact category color derivation will depend on existing patterns in `Grid.tsx` — look for how `activeCategoryId` maps to a color via the layout's `categories` array.

**Step 2: Add keyboard shortcut**

In `src/hooks/useKeyboard.ts`, inside the keyboard handler, add (gated behind labs flag):

```typescript
// N key — accept size suggestion
if (event.key === 'n' && !event.metaKey && !event.ctrlKey && !event.altKey) {
  const sizeSuggestionsEnabled = useLabsStore.getState().isFeatureEnabled('size-suggestions');
  if (sizeSuggestionsEnabled) {
    const { suggestions, isDismissed } = useSizeSuggestionStore.getState();
    const top = suggestions[0];
    if (top && !isDismissed && top.position) {
      event.preventDefault();
      // Trigger the same accept flow as clicking the preview
      // This will need to call the same handler as NextBinPreview.onAccept
      // Implementation: dispatch a custom event or call a shared function
    }
  }
}
```

**Implementation note:** The keyboard handler doesn't have direct access to `handleSuggestionAccept` from Grid. Two approaches:

- (a) Put the accept logic in the store as an action (preferred — keeps it centralized)
- (b) Use a shared event emitter

Choose (a): move the accept logic into a `useSuggestionAccept` hook or store action that both the keyboard handler and NextBinPreview call.

**Step 3: Run typecheck and existing tests**

Run: `npm run typecheck && npm run test:run -- src/features/grid-editor/ src/hooks/useKeyboard`
Expected: PASS

**Step 4: Commit**

```bash
git add src/features/grid-editor/components/Grid/Grid.tsx src/hooks/useKeyboard.ts
git commit -m "feat(size-suggestions): integrate into Grid and keyboard shortcut"
```

---

### Task 9: Wire Up Fetch Triggers

**Files:**

- Modify: `src/hooks/interactions/useDrawInteraction.ts` (trigger fetch after bin placement)
- Modify: `src/features/grid-editor/components/Grid/Grid.tsx` (trigger on drawer resize, label change)

**Step 1: Add debouncedFetch call after bin placement in useDrawInteraction**

After the existing `mlTracking.trackPlacement(placedBin, 'draw')` line in `useDrawInteraction.ts`, add:

```typescript
// Trigger size suggestion refresh
useSizeSuggestionStore.getState(); // will be used by the fetch hook
```

Actually, the cleaner approach: have the `useSizeSuggestions` hook subscribe to layout changes via `useLayoutStore.subscribe()`. This way we don't need to modify every placement site.

In `src/features/size-suggestions/hooks/useSizeSuggestions.ts`, add a layout subscription effect:

```typescript
useEffect(() => {
  if (!useLabsStore.getState().isFeatureEnabled('size-suggestions')) return;

  // Subscribe to bin count changes (proxy for placement/deletion)
  let prevBinCount = useLayoutStore.getState().layout.bins.length;
  const unsub = useLayoutStore.subscribe((state) => {
    const newCount = state.layout.bins.length;
    if (newCount !== prevBinCount) {
      prevBinCount = newCount;
      debouncedFetch();
    }
  });

  return unsub;
}, [debouncedFetch]);
```

This triggers a debounced re-fetch whenever bins are added or removed, without modifying any existing interaction hooks.

**Step 2: Run tests**

Run: `npm run test:run -- src/features/size-suggestions/`
Expected: PASS

**Step 3: Commit**

```bash
git add src/features/size-suggestions/hooks/useSizeSuggestions.ts
git commit -m "feat(size-suggestions): auto-refresh on bin count changes"
```

---

### Task 10: Add Feature README and Final Polish

**Files:**

- Create: `src/features/size-suggestions/README.md`
- Run: `npm run quality` (typecheck + lint + knip)
- Run: `npm run test:coverage`
- Run: `npm run check:i18n`

**Step 1: Create README**

Create `src/features/size-suggestions/README.md`:

```markdown
# Size Suggestions

Tetris-style "Next Bin" predictions based on community ML telemetry.

## Architecture
```

POST /api/size-suggest ──▶ Redis ML aggregates ──▶ scored sizes + positions
│
▼
useSizeSuggestions (fetch hook, debounced, deduped)
│
▼
useSizeSuggestionStore (Zustand)
│
├─▶ NextBinPreview (floating panel, click to accept)
└─▶ SuggestionGhost (dashed overlay on grid)

```

## Key Files

- `store/index.ts` — Zustand store (suggestions, loading, dismiss)
- `hooks/useSizeSuggestions.ts` — Fetch lifecycle, layout subscription
- `components/NextBinPreview/` — Floating "Next" panel
- `components/SuggestionGhost/` — Ghost overlay on grid
- `types.ts` — Shared types
- `api/size-suggest.ts` — Server endpoint
- `api/lib/sizeSuggest.ts` — Scoring + position logic

## Labs

Feature ID: `size-suggestions` (experimental, default off)

## Keyboard

`N` — accept current suggestion
```

**Step 2: Run all quality checks**

```bash
npm run quality
npm run test:coverage
npm run check:i18n
```

Fix any issues found.

**Step 3: Commit**

```bash
git add src/features/size-suggestions/README.md
git commit -m "docs(size-suggestions): add feature README"
```

---

## Summary

| Task | What                           | Files                                           |
| ---- | ------------------------------ | ----------------------------------------------- |
| 1    | Labs feature flag              | `features.ts`, `labs.test.ts`                   |
| 2    | PlacementMethod type           | `types.ts`                                      |
| 3    | i18n keys                      | All locale files                                |
| 4    | API endpoint + scoring logic   | `api/size-suggest.ts`, `api/lib/sizeSuggest.ts` |
| 5    | Client store + fetch hook      | `store/`, `hooks/`, `types.ts`                  |
| 6    | NextBinPreview component       | `components/NextBinPreview/`                    |
| 7    | SuggestionGhost component      | `components/SuggestionGhost/`                   |
| 8    | Grid + keyboard integration    | `Grid.tsx`, `useKeyboard.ts`                    |
| 9    | Auto-refresh on layout changes | `useSizeSuggestions.ts`                         |
| 10   | README + quality checks        | `README.md`                                     |

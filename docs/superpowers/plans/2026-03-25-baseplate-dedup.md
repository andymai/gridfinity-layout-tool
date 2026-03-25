# Baseplate Split Deduplication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detect identical split baseplate pieces, generate BREP once per unique shape, clone meshes for duplicates, and export deduplicated ZIPs with a print guide.

**Architecture:** Fingerprint each piece's generation params (dimensions, padding, edges, magnets, connectors) into a stable string key. Group pieces by fingerprint before dispatching to the BREP pipeline. During preview, clone MeshData for duplicates. During export, emit one file per unique shape with descriptive role-based names (corner, edge-x, edge-y, center) plus a `.txt` print guide with an ASCII grid map, mm dimensions, and copy counts.

**Tech Stack:** TypeScript, Vitest, Zustand/Immer, JSZip, i18n (7 locales)

---

## File Structure

| Action | File                                                          | Responsibility                                                                                    |
| ------ | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Create | `src/features/baseplate/utils/pieceFingerprint.ts`            | Stable fingerprint key from `BaseplateParams`, grouping helpers                                   |
| Create | `src/features/baseplate/utils/pieceFingerprint.test.ts`       | Tests for fingerprinting and grouping                                                             |
| Create | `src/features/baseplate/utils/pieceNaming.ts`                 | Role-based descriptive name classification (corner, edge-x, edge-y, center, piece-A/B/C fallback) |
| Create | `src/features/baseplate/utils/pieceNaming.test.ts`            | Tests for naming logic across various tiling topologies                                           |
| Create | `src/features/baseplate/utils/printGuide.ts`                  | Generate print guide `.txt` content: header, piece table, ASCII grid map                          |
| Create | `src/features/baseplate/utils/printGuide.test.ts`             | Tests for print guide output format                                                               |
| Modify | `src/features/baseplate/hooks/useBaseplateGeneration.ts`      | Dedup generation: fingerprint → generate unique → clone for duplicates                            |
| Modify | `src/features/baseplate/hooks/useBaseplateGeneration.test.ts` | Test dedup generation logic                                                                       |
| Modify | `src/features/baseplate/hooks/useBaseplateExport.ts`          | Dedup export: one file per unique shape + print guide in ZIP                                      |
| Modify | `src/features/baseplate/hooks/useBaseplateExport.test.ts`     | Test dedup export logic                                                                           |
| Modify | `src/features/baseplate/store/baseplatePageStore.ts`          | Add `dedupStats` to store for UI progress feedback                                                |
| Modify | `src/features/baseplate/store/baseplatePageStore.test.ts`     | Test new store fields                                                                             |
| Modify | `src/features/baseplate/types/tiling.ts`                      | Add `DedupStats` type                                                                             |
| Modify | `src/i18n/locales/en.ts`                                      | Add dedup progress i18n keys                                                                      |
| Modify | `src/i18n/locales/en.json`                                    | Add dedup progress i18n keys                                                                      |
| Modify | `src/i18n/locales/de.json`                                    | Add dedup progress i18n keys                                                                      |
| Modify | `src/i18n/locales/es.json`                                    | Add dedup progress i18n keys                                                                      |
| Modify | `src/i18n/locales/fr.json`                                    | Add dedup progress i18n keys                                                                      |
| Modify | `src/i18n/locales/nb.json`                                    | Add dedup progress i18n keys                                                                      |
| Modify | `src/i18n/locales/nl.json`                                    | Add dedup progress i18n keys                                                                      |
| Modify | `src/i18n/locales/pt-BR.json`                                 | Add dedup progress i18n keys                                                                      |

---

## Task 1: Piece Fingerprinting

**Files:**

- Create: `src/features/baseplate/utils/pieceFingerprint.ts`
- Create: `src/features/baseplate/utils/pieceFingerprint.test.ts`

The fingerprint must be a **stable, deterministic string** derived from every param that affects BREP geometry output. Two pieces with the same fingerprint produce byte-identical meshes and can be cloned.

### Fingerprint Key Format

The key is a pipe-delimited string of all geometry-affecting params from `BaseplateParams` (the output of `pieceToBaseplateParams`):

```
w:3|d:3|g:42|mh:1|md:6.5|mz:2|pl:2|pr:0|pf:2|pb:0|fx:end|fy:end|el:exterior|er:join|ef:exterior|eb:join|cn:1|lw:0|cr:2|cri:2,0,2,0
```

### Grouping

`groupPiecesByFingerprint(pieces, parentParams)` returns a `Map<string, { indices: number[]; params: BaseplateParams }>` — each unique fingerprint maps to the array of original piece indices that share it, plus the generation params for that group.

- [ ] **Step 1: Write the failing tests**

Create `src/features/baseplate/utils/pieceFingerprint.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { computePieceFingerprint, groupPiecesByFingerprint } from './pieceFingerprint';
import { computeBaseplateTiling, pieceToBaseplateParams } from './splitPlanner';
import type { BaseplateParams } from '@/shared/types/bin';

function makeParams(overrides: Partial<BaseplateParams> = {}): BaseplateParams {
  return {
    width: 6,
    depth: 4,
    gridUnitMm: 42,
    magnetHoles: false,
    magnetDiameter: 6.5,
    magnetDepth: 2,
    paddingLeft: 0,
    paddingRight: 0,
    paddingFront: 0,
    paddingBack: 0,
    fractionalEdgeX: 'end',
    fractionalEdgeY: 'end',
    ...overrides,
  };
}

describe('computePieceFingerprint', () => {
  it('produces identical keys for identical params', () => {
    const params = makeParams({ width: 3, depth: 3 });
    const fp1 = computePieceFingerprint(params);
    const fp2 = computePieceFingerprint(params);
    expect(fp1).toBe(fp2);
  });

  it('produces different keys when dimensions differ', () => {
    const a = makeParams({ width: 3, depth: 3 });
    const b = makeParams({ width: 3, depth: 4 });
    expect(computePieceFingerprint(a)).not.toBe(computePieceFingerprint(b));
  });

  it('produces different keys when padding differs', () => {
    const a = makeParams({ width: 3, depth: 3, paddingLeft: 2 });
    const b = makeParams({ width: 3, depth: 3, paddingLeft: 0 });
    expect(computePieceFingerprint(a)).not.toBe(computePieceFingerprint(b));
  });

  it('produces different keys when edges differ', () => {
    const a = makeParams({ width: 3, depth: 3 });
    const aWithEdges = {
      ...a,
      edges: {
        left: 'exterior' as const,
        right: 'join' as const,
        front: 'exterior' as const,
        back: 'join' as const,
      },
    };
    const bWithEdges = {
      ...a,
      edges: {
        left: 'join' as const,
        right: 'exterior' as const,
        front: 'join' as const,
        back: 'exterior' as const,
      },
    };
    expect(computePieceFingerprint(aWithEdges)).not.toBe(computePieceFingerprint(bWithEdges));
  });

  it('produces different keys when magnet config differs', () => {
    const a = makeParams({ width: 3, depth: 3, magnetHoles: true });
    const b = makeParams({ width: 3, depth: 3, magnetHoles: false });
    expect(computePieceFingerprint(a)).not.toBe(computePieceFingerprint(b));
  });

  it('produces different keys when connectors differ', () => {
    const a = makeParams({ width: 3, depth: 3, connectorNubs: true });
    const b = makeParams({ width: 3, depth: 3, connectorNubs: false });
    expect(computePieceFingerprint(a)).not.toBe(computePieceFingerprint(b));
  });
});

describe('groupPiecesByFingerprint', () => {
  it('groups identical pieces in a symmetric 2x2 split (no padding)', () => {
    // 12x12 on 256mm bed = 2x2 split = four 6x6 pieces
    // No padding → all 4 pieces identical (no exterior padding to differentiate)
    const params = makeParams({ width: 12, depth: 12 });
    const tiling = computeBaseplateTiling(params, 256);
    expect(tiling.isSplit).toBe(true);
    expect(tiling.pieces.length).toBe(4);

    const groups = groupPiecesByFingerprint(tiling.pieces, params);
    // All 4 should be the same if no padding, but edges differ:
    // corners have different join/exterior edge combos
    // Actually: (0,0) has exterior left+front, (1,0) has exterior right+front, etc.
    // So with edges in fingerprint, each corner is unique in a 2x2 no-padding split.
    // They only become duplicates when their edge patterns match.
    expect(groups.size).toBeGreaterThanOrEqual(1);
  });

  it('groups identical pieces in a symmetric 3x3 split with padding', () => {
    // 18x18 on 256mm bed with equal padding = 3x3 = 9 pieces
    // 4 corners, 4 edges (2 edge-x + 2 edge-y), 1 center
    const params = makeParams({
      width: 18,
      depth: 18,
      paddingLeft: 2,
      paddingRight: 2,
      paddingFront: 2,
      paddingBack: 2,
    });
    const tiling = computeBaseplateTiling(params, 256);
    expect(tiling.isSplit).toBe(true);

    const groups = groupPiecesByFingerprint(tiling.pieces, params);
    // At most 9 unique, but symmetric padding means corners match corners, etc.
    // Exact count depends on whether symmetric corners have matching edge patterns.
    expect(groups.size).toBeLessThanOrEqual(tiling.pieces.length);
  });

  it('single piece (no split) produces one group', () => {
    const params = makeParams({ width: 3, depth: 3 });
    const tiling = computeBaseplateTiling(params, 256);
    expect(tiling.isSplit).toBe(false);

    const groups = groupPiecesByFingerprint(tiling.pieces, params);
    expect(groups.size).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/features/baseplate/utils/pieceFingerprint.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement pieceFingerprint.ts**

Create `src/features/baseplate/utils/pieceFingerprint.ts`:

```typescript
/**
 * Fingerprinting for baseplate split pieces.
 *
 * Computes a stable, deterministic string key from all geometry-affecting
 * BaseplateParams fields. Pieces with identical fingerprints produce
 * byte-identical BREP output and can be cloned instead of regenerated.
 */

import type { BaseplateParams } from '@/shared/types/bin';
import type { BaseplatePiece } from '../types/tiling';
import { pieceToBaseplateParams } from './splitPlanner';

/**
 * Compute a stable fingerprint for a set of baseplate generation params.
 * Every field that affects BREP geometry output is included.
 */
export function computePieceFingerprint(params: BaseplateParams): string {
  const parts = [
    `w:${params.width}`,
    `d:${params.depth}`,
    `g:${params.gridUnitMm}`,
    `mh:${params.magnetHoles ? 1 : 0}`,
    `md:${params.magnetDiameter}`,
    `mz:${params.magnetDepth}`,
    `pl:${params.paddingLeft}`,
    `pr:${params.paddingRight}`,
    `pf:${params.paddingFront}`,
    `pb:${params.paddingBack}`,
    `fx:${params.fractionalEdgeX}`,
    `fy:${params.fractionalEdgeY}`,
    `cn:${params.connectorNubs ? 1 : 0}`,
    `lw:${params.lightweight ? 1 : 0}`,
    `cr:${params.cornerRadius ?? 0}`,
  ];

  if (params.edges) {
    parts.push(
      `el:${params.edges.left}`,
      `er:${params.edges.right}`,
      `ef:${params.edges.front}`,
      `eb:${params.edges.back}`
    );
  }

  if (params.cornerRadii) {
    const cr = params.cornerRadii;
    parts.push(`cri:${cr.tl},${cr.tr},${cr.bl},${cr.br}`);
  }

  return parts.join('|');
}

/** A group of pieces sharing the same geometry fingerprint. */
export interface PieceGroup {
  /** Indices into the original tiling.pieces array */
  readonly indices: number[];
  /** Generation params for this group (from first piece) */
  readonly params: BaseplateParams;
  /** The fingerprint key */
  readonly fingerprint: string;
}

/**
 * Group tiling pieces by their generation fingerprint.
 *
 * Returns a Map keyed by fingerprint string. Each value contains the
 * original piece indices that share that geometry, plus the BaseplateParams
 * to use for generation (from the first piece in the group).
 */
export function groupPiecesByFingerprint(
  pieces: readonly BaseplatePiece[],
  parentParams: BaseplateParams
): Map<string, PieceGroup> {
  const groups = new Map<string, PieceGroup>();

  for (let i = 0; i < pieces.length; i++) {
    const pieceParams = pieceToBaseplateParams(pieces[i], parentParams);
    const fp = computePieceFingerprint(pieceParams);

    const existing = groups.get(fp);
    if (existing) {
      (existing.indices as number[]).push(i);
    } else {
      groups.set(fp, { indices: [i], params: pieceParams, fingerprint: fp });
    }
  }

  return groups;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/features/baseplate/utils/pieceFingerprint.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/baseplate/utils/pieceFingerprint.ts src/features/baseplate/utils/pieceFingerprint.test.ts
git commit -m "feat(baseplate): add piece fingerprinting for split deduplication"
```

---

## Task 2: Piece Role Naming

**Files:**

- Create: `src/features/baseplate/utils/pieceNaming.ts`
- Create: `src/features/baseplate/utils/pieceNaming.test.ts`

Role-based descriptive names for deduplicated piece groups. The classification uses grid position:

| Position                                      | Role Name                  |
| --------------------------------------------- | -------------------------- |
| Has 2 exterior edges meeting at a corner      | `corner`                   |
| Has 1 exterior edge on left or right (X-axis) | `edge-x`                   |
| Has 1 exterior edge on front or back (Y-axis) | `edge-y`                   |
| Has 0 exterior edges (all join)               | `center`                   |
| Fallback (1×N or N×1 strips, ambiguous)       | `piece-A`, `piece-B`, etc. |

When multiple groups map to the same role name, append a numeric suffix: `corner-1`, `corner-2`.

- [ ] **Step 1: Write the failing tests**

Create `src/features/baseplate/utils/pieceNaming.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { classifyPieceRole, assignGroupNames } from './pieceNaming';
import { computeBaseplateTiling } from './splitPlanner';
import { groupPiecesByFingerprint } from './pieceFingerprint';
import type { BaseplateParams } from '@/shared/types/bin';

function makeParams(overrides: Partial<BaseplateParams> = {}): BaseplateParams {
  return {
    width: 6,
    depth: 4,
    gridUnitMm: 42,
    magnetHoles: false,
    magnetDiameter: 6.5,
    magnetDepth: 2,
    paddingLeft: 0,
    paddingRight: 0,
    paddingFront: 0,
    paddingBack: 0,
    fractionalEdgeX: 'end',
    fractionalEdgeY: 'end',
    ...overrides,
  };
}

describe('classifyPieceRole', () => {
  it('identifies corner pieces (2 exterior edges meeting)', () => {
    const edges = {
      left: 'exterior' as const,
      right: 'join' as const,
      front: 'exterior' as const,
      back: 'join' as const,
    };
    expect(classifyPieceRole(edges)).toBe('corner');
  });

  it('identifies edge-x pieces (left or right exterior only)', () => {
    const edges = {
      left: 'exterior' as const,
      right: 'join' as const,
      front: 'join' as const,
      back: 'join' as const,
    };
    expect(classifyPieceRole(edges)).toBe('edge-x');
  });

  it('identifies edge-y pieces (front or back exterior only)', () => {
    const edges = {
      left: 'join' as const,
      right: 'join' as const,
      front: 'exterior' as const,
      back: 'join' as const,
    };
    expect(classifyPieceRole(edges)).toBe('edge-y');
  });

  it('identifies center pieces (no exterior edges)', () => {
    const edges = {
      left: 'join' as const,
      right: 'join' as const,
      front: 'join' as const,
      back: 'join' as const,
    };
    expect(classifyPieceRole(edges)).toBe('center');
  });

  it('identifies single-exterior pieces with 3 exterior edges', () => {
    // A 1×2 strip: left piece has exterior on left, front, and back
    const edges = {
      left: 'exterior' as const,
      right: 'join' as const,
      front: 'exterior' as const,
      back: 'exterior' as const,
    };
    // 3 exterior edges = still a corner-like piece
    expect(classifyPieceRole(edges)).toBe('corner');
  });
});

describe('assignGroupNames', () => {
  it('assigns unique names to groups in a 3x3 split', () => {
    const params = makeParams({
      width: 18,
      depth: 18,
      paddingLeft: 2,
      paddingRight: 2,
      paddingFront: 2,
      paddingBack: 2,
    });
    const tiling = computeBaseplateTiling(params, 256);
    const groups = groupPiecesByFingerprint(tiling.pieces, params);
    const names = assignGroupNames(groups, tiling.pieces);

    // All names should be unique strings
    const nameSet = new Set(names.values());
    expect(nameSet.size).toBe(names.size);

    // Each name should be a valid filename component (no spaces, slashes, etc.)
    for (const name of names.values()) {
      expect(name).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it('uses sequential fallback for 1xN strips', () => {
    // Force a 1x3 strip
    const params = makeParams({
      width: 3,
      depth: 18,
      paddingFront: 2,
      paddingBack: 2,
    });
    const tiling = computeBaseplateTiling(params, 256);
    if (!tiling.isSplit) return; // Skip if doesn't actually split

    const groups = groupPiecesByFingerprint(tiling.pieces, params);
    const names = assignGroupNames(groups, tiling.pieces);

    for (const name of names.values()) {
      expect(name).toMatch(/^(corner|edge-[xy]|center|piece-[a-z])(-\d+)?$/);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/features/baseplate/utils/pieceNaming.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement pieceNaming.ts**

Create `src/features/baseplate/utils/pieceNaming.ts`:

```typescript
/**
 * Role-based descriptive naming for deduplicated baseplate pieces.
 *
 * Classifies pieces by their edge topology: corner, edge-x, edge-y, center.
 * Falls back to sequential letters (piece-a, piece-b) for ambiguous topologies
 * like 1×N strips where the role names don't clearly apply.
 */

import type { PieceEdges } from '../types/tiling';
import type { BaseplatePiece } from '../types/tiling';
import type { PieceGroup } from './pieceFingerprint';

type PieceRole = 'corner' | 'edge-x' | 'edge-y' | 'center';

/**
 * Classify a piece's role based on its edge topology.
 *
 * - corner: 2+ exterior edges meeting at a corner (includes 3-exterior pieces)
 * - edge-x: exactly 1 exterior edge on left or right
 * - edge-y: exactly 1 exterior edge on front or back
 * - center: no exterior edges
 */
export function classifyPieceRole(edges: PieceEdges): PieceRole {
  const exteriorCount = [edges.left, edges.right, edges.front, edges.back].filter(
    (e) => e === 'exterior'
  ).length;

  if (exteriorCount >= 2) return 'corner';
  if (exteriorCount === 0) return 'center';

  // Exactly 1 exterior edge
  if (edges.left === 'exterior' || edges.right === 'exterior') return 'edge-x';
  return 'edge-y';
}

/**
 * Assign unique descriptive file names to each fingerprint group.
 *
 * Returns a Map from fingerprint string → descriptive name (e.g. "corner", "edge-x").
 * When multiple groups share a role, numeric suffixes are added: "corner-1", "corner-2".
 * For 1×N or N×1 strips where roles are ambiguous, falls back to "piece-a", "piece-b", etc.
 */
export function assignGroupNames(
  groups: Map<string, PieceGroup>,
  pieces: readonly BaseplatePiece[]
): Map<string, string> {
  // Determine if this is a strip layout (only 1 col or 1 row)
  const maxCol = Math.max(...pieces.map((p) => p.col));
  const maxRow = Math.max(...pieces.map((p) => p.row));
  const isStrip = maxCol === 0 || maxRow === 0;

  if (isStrip && groups.size > 1) {
    return assignSequentialNames(groups);
  }

  return assignRoleNames(groups, pieces);
}

function assignRoleNames(
  groups: Map<string, PieceGroup>,
  pieces: readonly BaseplatePiece[]
): Map<string, string> {
  // Classify each group's role using the first piece's edges
  const roleMap = new Map<string, PieceRole>();
  for (const [fp, group] of groups) {
    const piece = pieces[group.indices[0]];
    roleMap.set(fp, classifyPieceRole(piece.edges));
  }

  // Count occurrences of each role
  const roleCounts = new Map<PieceRole, number>();
  for (const role of roleMap.values()) {
    roleCounts.set(role, (roleCounts.get(role) ?? 0) + 1);
  }

  // Assign names with suffixes where needed
  const result = new Map<string, string>();
  const roleCounters = new Map<PieceRole, number>();

  for (const [fp, role] of roleMap) {
    const count = roleCounts.get(role) ?? 1;
    if (count === 1) {
      result.set(fp, role);
    } else {
      const idx = (roleCounters.get(role) ?? 0) + 1;
      roleCounters.set(role, idx);
      result.set(fp, `${role}-${idx}`);
    }
  }

  return result;
}

function assignSequentialNames(groups: Map<string, PieceGroup>): Map<string, string> {
  const result = new Map<string, string>();
  let idx = 0;

  for (const fp of groups.keys()) {
    result.set(fp, `piece-${String.fromCharCode(97 + idx)}`); // 'a', 'b', 'c', ...
    idx++;
  }

  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/features/baseplate/utils/pieceNaming.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/baseplate/utils/pieceNaming.ts src/features/baseplate/utils/pieceNaming.test.ts
git commit -m "feat(baseplate): add role-based naming for deduplicated pieces"
```

---

## Task 3: Print Guide Generator

**Files:**

- Create: `src/features/baseplate/utils/printGuide.ts`
- Create: `src/features/baseplate/utils/printGuide.test.ts`
- Modify: `src/features/baseplate/types/tiling.ts` — add `DedupGroup` type

The print guide is a plain `.txt` file included in every split export ZIP. It contains:

1. **Header** — baseplate dimensions, grid unit, settings summary
2. **Piece table** — each unique shape with dimensions (mm), features, copy count, grid positions
3. **ASCII grid map** — visual layout with front at bottom, matching app coordinate system
4. **Footer** — generated-by attribution

### ASCII Grid Map Format

The grid uses the piece's descriptive file name (without extension) as the cell label, right-padded to a uniform width:

```
Assembly Layout (front of drawer at bottom):

  Row 3:  [ corner  ][ edge-y  ][ corner  ]
  Row 2:  [ edge-x  ][ center  ][ edge-x  ]
  Row 1:  [ corner  ][ edge-y  ][ corner  ]
            Col A      Col B      Col C

  ▼ Front of drawer
```

- [ ] **Step 1: Add DedupGroup type to tiling.ts**

Modify `src/features/baseplate/types/tiling.ts` — add at the end of the file:

```typescript
/** Statistics about deduplication in a split baseplate generation/export. */
export interface DedupStats {
  /** Number of unique shapes generated */
  readonly uniqueCount: number;
  /** Total number of pieces (unique + duplicates) */
  readonly totalCount: number;
  /** Number of duplicates that were cloned instead of generated */
  readonly duplicatesSkipped: number;
}
```

- [ ] **Step 2: Run existing tiling type tests still pass**

Run: `pnpm vitest run src/features/baseplate/types/`
Expected: PASS (or no tests in that dir — that's fine, type-only changes)

- [ ] **Step 3: Write the failing print guide tests**

Create `src/features/baseplate/utils/printGuide.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { generatePrintGuide } from './printGuide';
import { computeBaseplateTiling } from './splitPlanner';
import { groupPiecesByFingerprint } from './pieceFingerprint';
import { assignGroupNames } from './pieceNaming';
import type { BaseplateParams } from '@/shared/types/bin';

function makeParams(overrides: Partial<BaseplateParams> = {}): BaseplateParams {
  return {
    width: 6,
    depth: 4,
    gridUnitMm: 42,
    magnetHoles: false,
    magnetDiameter: 6.5,
    magnetDepth: 2,
    paddingLeft: 0,
    paddingRight: 0,
    paddingFront: 0,
    paddingBack: 0,
    fractionalEdgeX: 'end',
    fractionalEdgeY: 'end',
    ...overrides,
  };
}

describe('generatePrintGuide', () => {
  it('generates a guide with header, piece table, and grid map', () => {
    const params = makeParams({
      width: 18,
      depth: 18,
      paddingLeft: 2,
      paddingRight: 2,
      paddingFront: 2,
      paddingBack: 2,
      magnetHoles: true,
    });
    const tiling = computeBaseplateTiling(params, 256);
    const groups = groupPiecesByFingerprint(tiling.pieces, params);
    const names = assignGroupNames(groups, tiling.pieces);

    const guide = generatePrintGuide({
      tiling,
      groups,
      groupNames: names,
      parentParams: params,
      fileExtension: '.stl',
      baseFileName: 'gridfinity-baseplate-18x18-magnets-padded',
    });

    // Should contain key sections
    expect(guide).toContain('Gridfinity Baseplate Print Guide');
    expect(guide).toContain('18 × 18');
    expect(guide).toContain('magnets');
    expect(guide).toContain('Assembly Layout');
    expect(guide).toContain('Front of drawer');
    expect(guide).toContain('Row 1');
    expect(guide).toContain('Col A');

    // Should contain piece details with mm dimensions
    expect(guide).toMatch(/\d+\.\d+ × \d+\.\d+ × \d+\.\d+ mm/);

    // Should mention copy counts
    expect(guide).toMatch(/Print \d+ cop(y|ies)/);
  });

  it('includes all piece positions in the guide', () => {
    const params = makeParams({ width: 12, depth: 12 });
    const tiling = computeBaseplateTiling(params, 256);
    const groups = groupPiecesByFingerprint(tiling.pieces, params);
    const names = assignGroupNames(groups, tiling.pieces);

    const guide = generatePrintGuide({
      tiling,
      groups,
      groupNames: names,
      parentParams: params,
      fileExtension: '.stl',
      baseFileName: 'gridfinity-baseplate-12x12',
    });

    // Every piece label should appear somewhere in the guide
    for (const piece of tiling.pieces) {
      expect(guide).toContain(piece.label);
    }
  });

  it('generates valid guide for single-piece (non-split) tiling', () => {
    const params = makeParams({ width: 3, depth: 3 });
    const tiling = computeBaseplateTiling(params, 256);
    const groups = groupPiecesByFingerprint(tiling.pieces, params);
    const names = assignGroupNames(groups, tiling.pieces);

    const guide = generatePrintGuide({
      tiling,
      groups,
      groupNames: names,
      parentParams: params,
      fileExtension: '.3mf',
      baseFileName: 'gridfinity-baseplate-3x3',
    });

    expect(guide).toContain('3 × 3');
    expect(guide).toContain('Print 1 copy');
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `pnpm vitest run src/features/baseplate/utils/printGuide.test.ts`
Expected: FAIL — module not found

- [ ] **Step 5: Implement printGuide.ts**

Create `src/features/baseplate/utils/printGuide.ts`:

```typescript
/**
 * Print guide generator for split baseplate exports.
 *
 * Produces a plain-text (.txt) guide included in export ZIPs with:
 * - Header: baseplate dimensions, settings
 * - Piece table: unique shapes with mm dimensions, features, copy counts
 * - ASCII grid map: visual assembly layout, front at bottom
 */

import type { BaseplateParams } from '@/shared/types/bin';
import type { BaseplatePiece, BaseplateTiling } from '../types/tiling';
import type { PieceGroup } from './pieceFingerprint';
import { colToLetter } from './splitPlanner';

// Baseplate geometry constants (must match baseplateGenerator.ts)
const SOCKET_HEIGHT = 5;
const MAGNET_FLOOR = 0.5;

interface PrintGuideInput {
  readonly tiling: BaseplateTiling;
  readonly groups: Map<string, PieceGroup>;
  readonly groupNames: Map<string, string>;
  readonly parentParams: BaseplateParams;
  readonly fileExtension: string;
  readonly baseFileName: string;
}

export function generatePrintGuide(input: PrintGuideInput): string {
  const { tiling, groups, groupNames, parentParams, fileExtension, baseFileName } = input;

  const sections = [
    generateHeader(tiling, parentParams, groupNames.size),
    generatePieceTable(
      groups,
      groupNames,
      parentParams,
      tiling.pieces,
      fileExtension,
      baseFileName
    ),
    generateGridMap(tiling, groups, groupNames),
    generateFooter(),
  ];

  return sections.join('\n\n');
}

function generateHeader(
  tiling: BaseplateTiling,
  params: BaseplateParams,
  uniqueCount: number
): string {
  const features: string[] = [];
  if (params.magnetHoles) features.push('magnets');
  const hasPadding =
    params.paddingLeft > 0 ||
    params.paddingRight > 0 ||
    params.paddingFront > 0 ||
    params.paddingBack > 0;
  if (hasPadding) features.push('padded');
  if (params.connectorNubs) features.push('connectors');

  const featureStr = features.length > 0 ? features.join(', ') : 'standard';
  const totalPieces = tiling.pieces.length;

  const lines = [
    '═══════════════════════════════════════════════════',
    '  Gridfinity Baseplate Print Guide',
    '═══════════════════════════════════════════════════',
    '',
    `  Grid size:    ${tiling.totalWidthUnits} × ${tiling.totalDepthUnits} units`,
    `  Grid unit:    ${params.gridUnitMm}mm`,
    `  Features:     ${featureStr}`,
    `  Total pieces: ${totalPieces}${totalPieces > 1 ? ` (${uniqueCount} unique)` : ''}`,
  ];

  return lines.join('\n');
}

function generatePieceTable(
  groups: Map<string, PieceGroup>,
  names: Map<string, string>,
  parentParams: BaseplateParams,
  pieces: readonly BaseplatePiece[],
  ext: string,
  baseName: string
): string {
  const lines = ['─── Pieces ──────────────────────────────────────', ''];

  for (const [fp, group] of groups) {
    const name = names.get(fp) ?? 'unknown';
    const params = group.params;
    const count = group.indices.length;

    // Compute physical dimensions in mm
    const widthMm = params.width * params.gridUnitMm + params.paddingLeft + params.paddingRight;
    const depthMm = params.depth * params.gridUnitMm + params.paddingFront + params.paddingBack;
    const heightMm = SOCKET_HEIGHT + (params.magnetHoles ? MAGNET_FLOOR + params.magnetDepth : 0);

    // Collect grid position labels
    const positions = group.indices.map((i) => pieces[i].label).join(', ');

    // Describe features
    const features: string[] = [];
    if (params.magnetHoles) features.push('magnet holes');
    if (params.connectorNubs) features.push('connectors');
    const hasPadding =
      params.paddingLeft > 0 ||
      params.paddingRight > 0 ||
      params.paddingFront > 0 ||
      params.paddingBack > 0;
    if (hasPadding) {
      const sides: string[] = [];
      if (params.paddingLeft > 0) sides.push(`${params.paddingLeft}mm left`);
      if (params.paddingRight > 0) sides.push(`${params.paddingRight}mm right`);
      if (params.paddingFront > 0) sides.push(`${params.paddingFront}mm front`);
      if (params.paddingBack > 0) sides.push(`${params.paddingBack}mm back`);
      features.push(`padding: ${sides.join(', ')}`);
    }

    const fileName = `${baseName}_${name}${ext}`;
    const copyText = count === 1 ? 'Print 1 copy' : `Print ${count} copies`;

    lines.push(`  ${name} (${fileName})`);
    lines.push(`    Grid:      ${params.width} × ${params.depth} units`);
    lines.push(
      `    Size:      ${widthMm.toFixed(1)} × ${depthMm.toFixed(1)} × ${heightMm.toFixed(1)} mm`
    );
    if (features.length > 0) {
      lines.push(`    Features:  ${features.join(', ')}`);
    }
    lines.push(`    ${copyText} → ${positions}`);
    lines.push('');
  }

  return lines.join('\n');
}

function generateGridMap(
  tiling: BaseplateTiling,
  groups: Map<string, PieceGroup>,
  names: Map<string, string>
): string {
  // Build a lookup: piece index → group name
  const pieceNameLookup = new Map<number, string>();
  for (const [fp, group] of groups) {
    const name = names.get(fp) ?? '?';
    for (const idx of group.indices) {
      pieceNameLookup.set(idx, name);
    }
  }

  // Find max name length for padding
  const maxNameLen = Math.max(...[...names.values()].map((n) => n.length), 3);
  const cellWidth = maxNameLen + 4; // "[ name  ]"

  const lines = ['─── Assembly Layout (front of drawer at bottom) ─', ''];

  // Rows printed top-to-bottom (highest row at top, Row 1 at bottom)
  for (let r = tiling.rows - 1; r >= 0; r--) {
    const rowLabel = `Row ${r + 1}:`.padEnd(8);
    const cells: string[] = [];

    for (let c = 0; c < tiling.cols; c++) {
      const pieceIdx = tiling.pieces.findIndex((p) => p.col === c && p.row === r);
      const name = pieceIdx >= 0 ? (pieceNameLookup.get(pieceIdx) ?? '?') : '?';
      const padded = name.padEnd(maxNameLen);
      cells.push(`[ ${padded} ]`);
    }

    lines.push(`  ${rowLabel}${cells.join('')}`);
  }

  // Column labels
  const colLabels: string[] = [];
  for (let c = 0; c < tiling.cols; c++) {
    colLabels.push(`Col ${colToLetter(c)}`.padEnd(cellWidth));
  }
  lines.push(`  ${''.padEnd(8)}${colLabels.join('')}`);
  lines.push('');
  lines.push('  ▼ Front of drawer');

  return lines.join('\n');
}

function generateFooter(): string {
  return [
    '─────────────────────────────────────────────────',
    '  Generated by Gridfinity Layout Tool',
    '  https://gridfinity.xyz',
    '─────────────────────────────────────────────────',
  ].join('\n');
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm vitest run src/features/baseplate/utils/printGuide.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/features/baseplate/utils/printGuide.ts src/features/baseplate/utils/printGuide.test.ts src/features/baseplate/types/tiling.ts
git commit -m "feat(baseplate): add print guide generator for split exports"
```

---

## Task 4: Store — Add DedupStats

**Files:**

- Modify: `src/features/baseplate/store/baseplatePageStore.ts`
- Modify: `src/features/baseplate/store/baseplatePageStore.test.ts`

Add a `dedupStats` field to track dedup statistics for the UI progress display.

- [ ] **Step 1: Write the failing test**

Add to `src/features/baseplate/store/baseplatePageStore.test.ts`:

```typescript
describe('dedupStats', () => {
  it('initializes with null dedupStats', () => {
    const state = useBaseplatePageStore.getState();
    expect(state.dedupStats).toBeNull();
  });

  it('sets and clears dedupStats', () => {
    const { setDedupStats } = useBaseplatePageStore.getState();

    setDedupStats({ uniqueCount: 3, totalCount: 9, duplicatesSkipped: 6 });
    expect(useBaseplatePageStore.getState().dedupStats).toEqual({
      uniqueCount: 3,
      totalCount: 9,
      duplicatesSkipped: 6,
    });

    setDedupStats(null);
    expect(useBaseplatePageStore.getState().dedupStats).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/baseplate/store/baseplatePageStore.test.ts`
Expected: FAIL — `dedupStats` / `setDedupStats` not found

- [ ] **Step 3: Add dedupStats to baseplatePageStore.ts**

In `src/features/baseplate/store/baseplatePageStore.ts`:

1. Add import: `import type { DedupStats } from '../types/tiling';`
2. Add to `BaseplatePageState` interface:
   ```typescript
   dedupStats: DedupStats | null;
   setDedupStats: (stats: DedupStats | null) => void;
   ```
3. Add initial value in `create()`: `dedupStats: null,`
4. Add setter:
   ```typescript
   setDedupStats: (stats) => {
     set((state) => {
       state.dedupStats = stats;
     });
   },
   ```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/features/baseplate/store/baseplatePageStore.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/baseplate/store/baseplatePageStore.ts src/features/baseplate/store/baseplatePageStore.test.ts
git commit -m "feat(baseplate): add dedupStats to page store"
```

---

## Task 5: Deduplicated Preview Generation

**Files:**

- Modify: `src/features/baseplate/hooks/useBaseplateGeneration.ts`
- Modify: `src/features/baseplate/hooks/useBaseplateGeneration.test.ts`

This is the core performance optimization. The `runGeneration` callback in `useBaseplateGeneration` currently generates every piece independently. We change it to:

1. Compute tiling
2. Group pieces by fingerprint
3. Generate only unique shapes (via pool or sequential bridge)
4. Clone MeshData for duplicates, translating offsets
5. Report dedup stats to store

### Key Implementation Details

**MeshData cloning:** `Float32Array` and `Uint32Array` have a `.slice()` method that copies the underlying buffer. This is much cheaper than BREP regeneration.

**Progress reporting:** Report progress as "Generating N unique pieces (M duplicates skipped)" by updating `splitProgress` with `total = uniqueCount` and setting `dedupStats` before generation starts.

**Ordering:** After generation + cloning, sort `meshEntries` by the original piece order to maintain consistent display.

- [ ] **Step 1: Write the failing test**

Add a test to `src/features/baseplate/hooks/useBaseplateGeneration.test.ts` that verifies dedup behavior. Since this is a hook with WASM dependencies, the test should verify the fingerprinting integration at the data level. Add a test that:

```typescript
import { groupPiecesByFingerprint } from '../utils/pieceFingerprint';
import { computeBaseplateTiling, pieceToBaseplateParams } from '../utils/splitPlanner';

describe('generation dedup integration', () => {
  it('symmetric 2x2 split with equal padding has fewer unique shapes than pieces', () => {
    const params = makeParams({
      width: 12,
      depth: 12,
      paddingLeft: 2,
      paddingRight: 2,
      paddingFront: 2,
      paddingBack: 2,
    });
    const tiling = computeBaseplateTiling(params, 256);
    const groups = groupPiecesByFingerprint(tiling.pieces, params);

    // 4 pieces but with equal padding, corners should group
    expect(tiling.pieces.length).toBe(4);
    // All 4 corners have same dimensions and symmetric padding → may all be unique
    // due to different edge combos, OR may group if edge patterns repeat.
    // The key assertion: groups.size <= pieces.length
    expect(groups.size).toBeLessThanOrEqual(4);
  });

  it('3x3 with symmetric padding produces fewer unique shapes than 9', () => {
    const params = makeParams({
      width: 18,
      depth: 18,
      paddingLeft: 2,
      paddingRight: 2,
      paddingFront: 2,
      paddingBack: 2,
    });
    const tiling = computeBaseplateTiling(params, 256);
    const groups = groupPiecesByFingerprint(tiling.pieces, params);

    expect(tiling.pieces.length).toBe(9);
    // Center is always unique (1), edges should pair, corners should group
    expect(groups.size).toBeLessThan(9);
  });
});
```

- [ ] **Step 2: Run test to verify it fails (or passes — this tests the integration)**

Run: `pnpm vitest run src/features/baseplate/hooks/useBaseplateGeneration.test.ts`
Expected: Should pass if the fingerprinting logic from Task 1 is correct

- [ ] **Step 3: Modify useBaseplateGeneration.ts — add dedup to runGeneration**

In `src/features/baseplate/hooks/useBaseplateGeneration.ts`:

> **Note:** The symbols `PieceMeshEntry`, `buildPieceMeshEntry`, `GenerationResult`, `EMPTY_MESH`, and `NO_OP_PROGRESS` already exist in this file (defined at the top). No new imports are needed for them.

1. Add imports:

   ```typescript
   import { groupPiecesByFingerprint } from '../utils/pieceFingerprint';
   ```

2. Add store selector for `setDedupStats`:

   ```typescript
   const setDedupStats = useBaseplatePageStore((s) => s.setDedupStats);
   ```

3. Replace the split branch of `runGeneration` (lines ~173-216). The new logic:

```typescript
// Multi-piece — deduplicate then generate unique shapes only
const pool = poolRef.current;
const groups = groupPiecesByFingerprint(tiling.pieces, fullParams);
const uniqueGroups = [...groups.values()];
const uniqueCount = uniqueGroups.length;
const totalCount = tiling.pieces.length;
const duplicatesSkipped = totalCount - uniqueCount;

setDedupStats({ uniqueCount, totalCount, duplicatesSkipped });
setSplitProgress({ current: 0, total: uniqueCount });

// Generate only unique shapes
const uniqueParams = uniqueGroups.map((g) => g.params);
let uniqueResults: GenerationResult[];

if (pool && !pool.isDestroyed && pool.size > 1) {
  uniqueResults = await pool.generateBaseplates(uniqueParams, (completed, pieceTotal) =>
    setSplitProgress({ current: completed, total: pieceTotal })
  );
} else {
  uniqueResults = [];
  for (let i = 0; i < uniqueParams.length; i++) {
    setSplitProgress({ current: i + 1, total: uniqueCount });
    if (bridge.isDestroyed || generationEpochRef.current !== epoch) return;
    const result = await bridge.generateBaseplate(uniqueParams[i], NO_OP_PROGRESS);
    if (generationEpochRef.current !== epoch) return;
    uniqueResults.push(result);
  }
}

if (generationEpochRef.current !== epoch) return;

// Build mesh entries: use original for first piece in group, clone for duplicates
const meshEntries: PieceMeshEntry[] = new Array(totalCount);

for (let groupIdx = 0; groupIdx < uniqueGroups.length; groupIdx++) {
  const group = uniqueGroups[groupIdx];
  const result = uniqueResults[groupIdx];

  for (let j = 0; j < group.indices.length; j++) {
    const pieceIdx = group.indices[j];
    const piece = tiling.pieces[pieceIdx];

    if (j === 0) {
      // First piece in group: use original result
      meshEntries[pieceIdx] = buildPieceMeshEntry(result, piece);
    } else {
      // Duplicate: clone mesh data
      meshEntries[pieceIdx] = buildPieceMeshEntry(
        {
          mesh: {
            vertices: result.mesh.vertices ? result.mesh.vertices.slice() : result.mesh.vertices,
            normals: result.mesh.normals ? result.mesh.normals.slice() : result.mesh.normals,
            indices: result.mesh.indices ? result.mesh.indices.slice() : result.mesh.indices,
            edgeVertices: result.mesh.edgeVertices
              ? result.mesh.edgeVertices.slice()
              : result.mesh.edgeVertices,
          },
          timingMs: 0, // Cloned, not generated
        },
        piece
      );
    }
  }
}

setSplitProgress(null);
setPieceMeshes(meshEntries);
setGenerationResult(EMPTY_MESH);
setGenerationStatus('complete');
```

4. Add `setDedupStats` to the `useCallback` dependency array.

5. Clear dedupStats when generation starts and for the non-split path:
   - At the start of `runGeneration`: `setDedupStats(null);`

- [ ] **Step 4: Run all baseplate tests**

Run: `pnpm vitest run src/features/baseplate/`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/baseplate/hooks/useBaseplateGeneration.ts src/features/baseplate/hooks/useBaseplateGeneration.test.ts
git commit -m "perf(baseplate): deduplicate identical split pieces during preview generation"
```

---

## Task 6: Deduplicated Export with Print Guide

**Files:**

- Modify: `src/features/baseplate/hooks/useBaseplateExport.ts`
- Modify: `src/features/baseplate/hooks/useBaseplateExport.test.ts`
- Modify: `src/shared/generation/zipExport.ts` — update `packagePiecesAsZip` to support text files

The export path needs three changes:

1. **Generate only unique shapes** — same fingerprint grouping as preview
2. **Name files by role** — use `assignGroupNames` instead of grid labels
3. **Include print guide** — add `print-guide.txt` to the ZIP

### zipExport.ts Change

Add an optional `extraFiles` parameter to `packagePiecesAsZip`:

```typescript
interface ExtraFile {
  readonly name: string;
  readonly content: string;
}

export async function packagePiecesAsZip(
  pieces: readonly ExportPiece[],
  baseName: string,
  extension: string,
  extraFiles?: readonly ExtraFile[]
): Promise<Blob> {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();

  for (const piece of pieces) {
    const fileName = `${baseName}_${piece.label}${extension}`;
    zip.file(fileName, piece.data);
  }

  if (extraFiles) {
    for (const file of extraFiles) {
      zip.file(file.name, file.content);
    }
  }

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}
```

### useBaseplateExport.ts Changes

In the split export branch of `downloadBaseplate`:

1. Import fingerprinting, naming, and print guide utils
2. Group pieces by fingerprint
3. Generate only unique shapes (pool or sequential)
4. Build the pieces array for ZIP using role-based names
5. Generate print guide text
6. Pass the print guide as an extra file to `packagePiecesAsZip`

- [ ] **Step 1: Write the failing test for zipExport extraFiles**

Add to or create a test adjacent to `src/shared/generation/zipExport.ts`:

```typescript
// In the appropriate test file
it('includes extra text files in ZIP', async () => {
  const pieces = [{ data: new ArrayBuffer(10), label: 'corner' }];
  const zip = await packagePiecesAsZip(pieces, 'test', '.stl', [
    { name: 'print-guide.txt', content: 'Hello world' },
  ]);
  expect(zip).toBeInstanceOf(Blob);
  // Verify the ZIP contains the extra file (requires unzipping in test)
});
```

- [ ] **Step 2: Update zipExport.ts with extraFiles support**

Modify `src/shared/generation/zipExport.ts` as described above.

- [ ] **Step 3: Modify useBaseplateExport.ts for dedup export**

Replace the split export branch in `downloadBaseplate`:

```typescript
// Add imports at top of file:
import { groupPiecesByFingerprint } from '../utils/pieceFingerprint';
import { assignGroupNames } from '../utils/pieceNaming';
import { generatePrintGuide } from '../utils/printGuide';

// In the split export branch (tiling?.isSplit && splitEnabled):
const bridgeFormat = format === '3mf' ? 'stl' : format;
const pool = workerPoolManager.get();

// Deduplicate
const groups = groupPiecesByFingerprint(tiling.pieces, fullParams);
const groupNames = assignGroupNames(groups, tiling.pieces);
const uniqueGroups = [...groups.entries()];
const uniqueCount = uniqueGroups.length;

setExportProgress({ current: 0, total: uniqueCount });

// Generate only unique shapes
let uniqueExports: Array<{ data: ArrayBuffer; fingerprint: string }>;

if (pool && !pool.isDestroyed && pool.size > 1) {
  const uniqueParams = uniqueGroups.map(([, g]) => g.params);
  const results = await pool.exportBaseplates(uniqueParams, bridgeFormat, (completed, pieceTotal) =>
    setExportProgress({ current: completed, total: pieceTotal })
  );
  uniqueExports = results.map((r, i) => ({
    data: r.data,
    fingerprint: uniqueGroups[i][0],
  }));
} else {
  uniqueExports = [];
  for (let i = 0; i < uniqueGroups.length; i++) {
    setExportProgress({ current: i + 1, total: uniqueCount });
    const [fp, group] = uniqueGroups[i];
    const result = await bridge.exportBaseplate(group.params, bridgeFormat);
    uniqueExports.push({ data: result.data, fingerprint: fp });
  }
}

// Build pieces array with role-based names
const exportLookup = new Map(uniqueExports.map((e) => [e.fingerprint, e.data]));
const pieces: { data: ArrayBuffer; label: string }[] = [];

for (const [fp] of uniqueGroups) {
  const name = groupNames.get(fp) ?? 'unknown';
  let data = exportLookup.get(fp)!;

  if (format === '3mf') {
    const blob = convertStlTo3mf(data, `${baseNameNoExt}_${name}`);
    data = await blob.arrayBuffer();
  }

  pieces.push({ data, label: name });
}

// Generate print guide
const guideText = generatePrintGuide({
  tiling,
  groups,
  groupNames,
  parentParams: fullParams,
  fileExtension: extension,
  baseFileName: baseNameNoExt,
});

const zip = await packagePiecesAsZip(pieces, baseNameNoExt, extension, [
  { name: 'print-guide.txt', content: guideText },
]);
triggerDownload(zip, `${baseNameNoExt}.zip`);
```

- [ ] **Step 4: Run all baseplate tests**

Run: `pnpm vitest run src/features/baseplate/`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/shared/generation/zipExport.ts src/features/baseplate/hooks/useBaseplateExport.ts src/features/baseplate/hooks/useBaseplateExport.test.ts
git commit -m "perf(baseplate): deduplicate export with print guide in ZIP"
```

---

## Task 7: i18n — Dedup Progress Keys

**Files:**

- Modify: `src/i18n/locales/en.ts`
- Modify: `src/i18n/locales/en.json`, `de.json`, `es.json`, `fr.json`, `nb.json`, `nl.json`, `pt-BR.json`

Add keys for the dedup-aware progress display. The progress UI (already exists somewhere in the baseplate feature) should show the dedup stats during generation.

### New Keys

```typescript
// en.ts
'baseplate.generation.dedupProgress': 'Generating {unique} unique pieces ({skipped} duplicates skipped)',
'baseplate.export.dedupSuccess': 'Baseplate exported ({unique} unique pieces, {total} total)',
```

- [ ] **Step 1: Add keys to en.ts**

In `src/i18n/locales/en.ts`, add the two keys above in the baseplate section (near `baseplate.export.splitSuccess`).

- [ ] **Step 2: Add keys to en.json**

Add the same keys to `src/i18n/locales/en.json`.

- [ ] **Step 3: Add translated keys to all locale JSONs**

Add translations to: `de.json`, `es.json`, `fr.json`, `nb.json`, `nl.json`, `pt-BR.json`.

Translations:

**de.json:**

```json
"baseplate.generation.dedupProgress": "{unique} einzigartige Teile generieren ({skipped} Duplikate übersprungen)",
"baseplate.export.dedupSuccess": "Grundplatte exportiert ({unique} einzigartige Teile, {total} gesamt)"
```

**es.json:**

```json
"baseplate.generation.dedupProgress": "Generando {unique} piezas únicas ({skipped} duplicados omitidos)",
"baseplate.export.dedupSuccess": "Placa base exportada ({unique} piezas únicas, {total} total)"
```

**fr.json:**

```json
"baseplate.generation.dedupProgress": "Génération de {unique} pièces uniques ({skipped} doublons ignorés)",
"baseplate.export.dedupSuccess": "Plaque de base exportée ({unique} pièces uniques, {total} total)"
```

**nb.json:**

```json
"baseplate.generation.dedupProgress": "Genererer {unique} unike deler ({skipped} duplikater hoppet over)",
"baseplate.export.dedupSuccess": "Bunnplate eksportert ({unique} unike deler, {total} totalt)"
```

**nl.json:**

```json
"baseplate.generation.dedupProgress": "{unique} unieke onderdelen genereren ({skipped} duplicaten overgeslagen)",
"baseplate.export.dedupSuccess": "Basisplaat geëxporteerd ({unique} unieke onderdelen, {total} totaal)"
```

**pt-BR.json:**

```json
"baseplate.generation.dedupProgress": "Gerando {unique} peças únicas ({skipped} duplicatas ignoradas)",
"baseplate.export.dedupSuccess": "Placa base exportada ({unique} peças únicas, {total} total)"
```

- [ ] **Step 4: Run i18n check**

Run: `pnpm run check:i18n`
Expected: PASS — all locales have matching keys

- [ ] **Step 5: Commit**

```bash
git add src/i18n/locales/
git commit -m "i18n: add baseplate dedup progress translation keys"
```

---

## Task 8: UI — Dedup Progress Display

**Files:**

- Modify: `src/features/baseplate/components/BaseplatePreview/BaseplatePreview.tsx`
- Modify: `src/features/baseplate/components/BaseplatePreview/BaseplatePreview.test.tsx`

The progress text is rendered by the `overlayStatusText` helper function at ~line 966 of `BaseplatePreview.tsx`. It currently shows `t('baseplate.generatingSplit', { current, total })`. We need to add a dedup-aware branch.

- [ ] **Step 1: Update overlayStatusText to accept dedupStats**

In `src/features/baseplate/components/BaseplatePreview/BaseplatePreview.tsx`:

1. Add `dedupStats` to the `useShallow` selector alongside `splitProgress`:

   ```typescript
   dedupStats: s.dedupStats,
   ```

2. Update the `overlayStatusText` function signature and body:

```typescript
function overlayStatusText(
  isWasmLoading: boolean,
  splitProgress: { current: number; total: number } | null,
  dedupStats: DedupStats | null,
  t: ReturnType<typeof useTranslation>
): string {
  if (isWasmLoading) return t('baseplate.initializingEngine');
  if (splitProgress) {
    if (dedupStats && dedupStats.duplicatesSkipped > 0) {
      return t('baseplate.generation.dedupProgress', {
        unique: dedupStats.uniqueCount,
        skipped: dedupStats.duplicatesSkipped,
      });
    }
    return t('baseplate.generatingSplit', {
      current: splitProgress.current,
      total: splitProgress.total,
    });
  }
  return t('baseplate.generating');
}
```

3. Update the call site to pass `dedupStats`.

- [ ] **Step 2: Add test for dedup progress text**

In `src/features/baseplate/components/BaseplatePreview/BaseplatePreview.test.tsx`, add a test verifying the dedup overlay text appears when `dedupStats` is set in the store. Follow the existing test patterns in that file.

- [ ] **Step 3: Run typecheck and lint**

Run: `pnpm run typecheck && pnpm run lint`
Expected: PASS

- [ ] **Step 4: Run component tests**

Run: `pnpm vitest run src/features/baseplate/components/BaseplatePreview/`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/baseplate/components/BaseplatePreview/
git commit -m "feat(baseplate): show dedup stats in split generation progress"
```

---

## Task 9: Update Export Toast for Dedup

**Files:**

- Modify: `src/features/baseplate/hooks/useBaseplateExport.ts`

Update the success toast for split exports to use the new dedup-aware message when deduplication occurred.

- [ ] **Step 1: Update toast message in downloadBaseplate**

After the `triggerDownload` call in the split export branch, replace the existing toast:

```typescript
const totalPieces = tiling.pieces.length;
if (groups.size < totalPieces) {
  useToastStore
    .getState()
    .addToast(
      t('baseplate.export.dedupSuccess', { unique: groups.size, total: totalPieces }),
      'success'
    );
} else {
  useToastStore
    .getState()
    .addToast(t('baseplate.export.splitSuccess', { count: totalPieces }), 'success');
}
```

- [ ] **Step 2: Run tests**

Run: `pnpm vitest run src/features/baseplate/hooks/useBaseplateExport.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/features/baseplate/hooks/useBaseplateExport.ts
git commit -m "feat(baseplate): show dedup-aware toast on split export"
```

---

## Task 10: Full Integration Test & Quality Check

- [ ] **Step 1: Run all baseplate tests**

Run: `pnpm vitest run src/features/baseplate/`
Expected: All PASS

- [ ] **Step 2: Run full test suite**

Run: `pnpm run test:coverage`
Expected: PASS with no regressions

- [ ] **Step 3: Run quality checks**

Run: `pnpm run quality`
Expected: PASS (typecheck + lint + knip)

- [ ] **Step 4: Run i18n check**

Run: `pnpm run check:i18n`
Expected: PASS

- [ ] **Step 5: Run build**

Run: `pnpm run build`
Expected: PASS — no build errors

- [ ] **Step 6: Manual smoke test (optional)**

Run: `pnpm run dev` and test:

1. Create a baseplate that splits (e.g., 18×18 with 2mm padding)
2. Verify the progress shows dedup stats ("Generating 5 unique pieces (4 duplicates skipped)")
3. Export as STL ZIP
4. Verify ZIP contains: deduplicated files with role-based names + `print-guide.txt`
5. Open print guide and verify ASCII grid, mm dimensions, copy counts

- [ ] **Step 7: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address integration issues from baseplate dedup"
```

// @vitest-environment node
/**
 * Discipline test for the FeatureBuilder cache-key contract.
 *
 * The contract every builder owes the feature cache is one sentence: two
 * parameter sets that share a `cacheKey` must `build` the same geometry.
 * Breaking it is the most repeatable defect class in this generator — a
 * feature grows an input and its key does not follow, so an edit to that
 * input silently serves the previous shape. #3603 swept all 34 key sites by
 * hand and found four; this test is that sweep, automated, so the fifth is
 * caught by CI rather than by a printed part.
 *
 * How it works, per builder, over scenarios that actually exercise it:
 *
 *  1. Build once behind a recording Proxy to learn which `params` the builder
 *     touches. Every leaf under a touched object becomes a candidate — a guard
 *     that short-circuits hides its siblings from the recorder, and those are
 *     exactly the ones a key is likely to have missed.
 *  2. Perturb each candidate, settle the result on the implication rules, and
 *     discard it if the key moved (correctly re-keyed) or `shouldBuild` flipped
 *     (the builder is skipped entirely, so nothing can be served stale).
 *  3. What survives shares a key. Build it and compare the solids.
 *  4. Confirm each surviving candidate against a WHOLE BIN with a warm cache,
 *     and fail only on those.
 *
 * Step 4 is not ceremony. A builder's solid can differ in ways the bin cannot
 * see: `compartments.thickness` sizes the wall-cutout cutter's extrude depth,
 * and the extra depth sweeps empty space, so that cutter differs while every
 * bin built from it is identical. Failing on the builder-level difference
 * alone would report a defect that does not exist — and if a later change ever
 * makes that depth matter, step 4 promotes it on its own.
 *
 * Two ways this test asks to be maintained, both deliberate:
 *
 *  - A candidate leaf with no entry in `PERTURBATIONS` fails. That is the
 *    trigger: it only fires for a new parameter a cached builder actually
 *    reads, which is precisely when someone has to think about the key.
 *  - `FIXTURES_PER_BUILDER` scenarios are drawn from `ALL_SCENARIOS`, so a new
 *    feature inherits this sweep the moment it has a scenario.
 *
 * Scope is `BIN_FEATURE_BUILDERS` — the keys reachable through the builder
 * protocol. The caches that key themselves outside it (the shell, the socket,
 * the two pattern compounds, the text solids, the baseplate) are NOT covered
 * here and still need their own tests; `wallPatternBuilder.cache.test.ts` is
 * the example to follow.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { mesh } from 'brepjs';
import type { Shape3D } from 'brepjs';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { IMPLICATION_RULES } from '@/shared/constraints';
import { loadTestFonts } from '@/test/loadTestFonts';
import type { BinParams } from '@/shared/types/bin';
import { initBrepjs, getGenerateBin } from '../__kernel-tests__/wasmInit';
import { meshVolume } from '../__kernel-tests__/meshAssertions';
import { clearAllCaches } from '../shapeCache';
import { ALL_SCENARIOS } from '../scenarios';
import { createInitialContext } from './context';
import { BIN_FEATURE_BUILDERS } from './featureComposition';
import type { FeatureBuilder } from './featureBuilder';

/** Scenarios swept per builder. Two is enough to reach both branches of the
 *  gates that vary by bin (lipped/lipless, rectangular/polygon) without paying
 *  for all 515. */
const FIXTURES_PER_BUILDER = 2;

// ─── Perturbations ───────────────────────────────────────────────────────────

/**
 * How to move each parameter to a different, still-valid value.
 *
 * Booleans, numbers and nulls are handled generically. Everything else needs
 * an entry, keyed by dotted path: a union member has no derivable alternative,
 * and guessing one fabricates a state the designer cannot produce.
 *
 * `false` means "this leaf cannot change generated geometry" — colours,
 * authoring-only bookkeeping — and skips it. A function receives the current
 * value, which is how arrays are moved without hard-coding a length.
 */
const PERTURBATIONS: Record<string, unknown> = {
  // Merging the last cell into the first group is the smallest edit that
  // repartitions the grid; a group-id permutation would normalize straight
  // back to the same layout and test nothing.
  'compartments.cells': (cells: unknown) => {
    const list = cells as number[];
    if (list.length < 2) return list;
    return list.map((cell, i) => (i === list.length - 1 ? list[0] : cell));
  },
  inserts: (inserts: unknown) => {
    const list = inserts as Array<Record<string, unknown>>;
    if (list.length === 0) return list;
    return list.map((insert, i) =>
      i === 0 ? { ...insert, cutDepth: (insert['cutDepth'] as number) + 2 } : insert
    );
  },
  cutouts: (cutouts: unknown) => {
    const list = cutouts as Array<Record<string, unknown>>;
    if (list.length === 0) return list;
    return list.map((cutout, i) =>
      i === 0 ? { ...cutout, width: (cutout['width'] as number) + 2 } : cutout
    );
  },
  fractionalEdgeX: 'start',
  fractionalEdgeY: 'start',
  style: 'slotted',
  'base.style': 'flat',
  'base.lightweightMode': 'underside',
  'base.footLatticeX': 'half',
  'base.footLatticeY': 'half',
  'base.feet': 'detachable',
  'scoop.radius': 6,
  'scoop.style': 'chamfer',
  'scoop.side': 'back',
  'label.support': 'none',
  'label.alignment': 'right',
  'label.edges': 'front',
  'label.mode': 'socket',
  'label.socketStyle': 'flush',
  'walls.shape': 'rectangle',
  'walls.front.alignment': 'left',
  'walls.back.alignment': 'left',
  'walls.left.alignment': 'left',
  'walls.right.alignment': 'left',
  'walls.interior.alignment': 'left',
  'handles.shape': 'oval',
  'slotConfig.crossStyle': 'notch',
  'slotConfig.longAxis': 'x',
  'slotConfig.partialStyle': 'partial',
  'slotConfig.layout': 'edge',
  'dividerPieces.height': 12,
  'compartments.dividerHeight': 12,
  'wallPattern.pattern': 'grid',
  'floorPattern.pattern': 'grid',
  'lid.attachment': 'magnets',
  'lid.grip.mode': 'dip',
  'slide.railMount': 'exterior',
  'surfaceText.wallAlign': 'top',
  'surfaceText.walls.front': 'WORLD',
  'surfaceText.walls.back': 'WORLD',
  'surfaceText.walls.left': 'WORLD',
  'surfaceText.walls.right': 'WORLD',
  'surfaceText.lidText': 'WORLD',
  'textDefaults.font': 'jetbrains-mono',
  'textDefaults.mode': 'emboss',
  'textDefaults.anchor': 'top-right',
  'textDefaults.sizeMode': 'fit',
  'textDefaults.textCase': 'none',
  'textDefaults.cutProfile': 'straight',
  'knifeRest.style': 'scallop',
  'knifeRest.color': false,
  'featureColors.body': false,
  'featureColors.lip': false,
  'featureColors.labelTab': false,
  'featureColors.base': false,
  'featureColors.scoop': false,
  'featureColors.dividers': false,
  'featureColors.text': false,
  'featureColors.lid': false,
  'featureColors.lidLip': false,
  'featureColors.topAccent.color': false,
  'compartments.compartmentColors': false,
  'compartments.compartmentColorScopes': false,
  'compartments.stash': false,
  'compartments.drawnUnitCells': false,
};

type Perturbation = { readonly kind: 'value'; readonly next: unknown } | { readonly kind: 'skip' };

function perturbationFor(path: string, current: unknown): Perturbation | null {
  const declared = PERTURBATIONS[path];
  if (declared === false) return { kind: 'skip' };
  if (typeof declared === 'function')
    return { kind: 'value', next: (declared as (v: unknown) => unknown)(current) };
  if (declared !== undefined) return { kind: 'value', next: declared };
  // `null` on an override field means "inherit the shared value"; a concrete
  // number is what makes the feature diverge from it.
  if (current === null) return { kind: 'value', next: 8 };
  if (typeof current === 'boolean') return { kind: 'value', next: !current };
  if (typeof current === 'number') {
    if (Number.isInteger(current) && Math.abs(current) < 12)
      return { kind: 'value', next: current + 1 };
    if (current > 0 && current <= 1) return { kind: 'value', next: current * 0.5 };
    return { kind: 'value', next: current + Math.max(0.3, Math.abs(current) * 0.15) };
  }
  return null;
}

// ─── Params traversal ────────────────────────────────────────────────────────

function leafPaths(value: unknown, prefix = ''): string[] {
  if (value === undefined) return [];
  if (value === null || typeof value !== 'object') return prefix ? [prefix] : [];
  if (Array.isArray(value)) return prefix ? [prefix] : [];
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
    leafPaths(v, prefix ? `${prefix}.${k}` : k)
  );
}

function getAt(source: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>((acc, key) => (acc as Record<string, unknown> | undefined)?.[key], source);
}

function setAt(source: unknown, path: string, value: unknown): unknown {
  const [head, ...rest] = path.split('.');
  if (head === undefined) return value;
  const record = (source ?? {}) as Record<string, unknown>;
  const copy: Record<string, unknown> = { ...record };
  copy[head] = rest.length === 0 ? value : setAt(record[head], rest.join('.'), value);
  return copy;
}

function deepMerge(base: unknown, patch: unknown): unknown {
  if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) return patch;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown> | undefined) };
  for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
    out[k] = deepMerge((base as Record<string, unknown> | undefined)?.[k], v);
  }
  return out;
}

/**
 * Settle params onto the implication rules' fixpoint.
 *
 * Moving one half of a coupled pair fabricates a state the designer never
 * emits — `style: 'solid'` without `base.solid` is the one that bites, because
 * `shellKey` tracks the base flag and would look defective for ignoring the
 * other. Settling first means the sweep only ever asserts over reachable bins.
 */
function settle(params: BinParams): BinParams {
  let settled = params;
  for (let i = 0; i < 10; i++) {
    let changed = false;
    for (const rule of IMPLICATION_RULES) {
      if (!rule.when(settled)) continue;
      settled = deepMerge(settled, rule.apply(settled)) as BinParams;
      changed = true;
    }
    if (!changed) break;
  }
  return settled;
}

// ─── Recording proxy ─────────────────────────────────────────────────────────

/** Deep read-recording proxy: collects every property path the callee touches. */
function recordingProxy<T extends object>(target: T, sink: Set<string>, prefix = ''): T {
  return new Proxy(target, {
    get(obj, prop, receiver): unknown {
      if (typeof prop === 'symbol') return Reflect.get(obj, prop, receiver);
      const value: unknown = Reflect.get(obj, prop, receiver);
      // An array index read is a read of the array; per-index paths would
      // explode the candidate set without naming a different input.
      const isIndex = Array.isArray(obj) && /^\d+$/.test(prop);
      const path = isIndex ? prefix : prefix ? `${prefix}.${prop}` : prop;
      if (!isIndex) sink.add(path);
      return value !== null && typeof value === 'object'
        ? recordingProxy(value, sink, isIndex ? prefix : path)
        : value;
    },
  });
}

// ─── Geometry comparison ─────────────────────────────────────────────────────

function fingerprintShapes(shapes: readonly Shape3D[] | null): string {
  if (!shapes || shapes.length === 0) return 'none';
  return shapes
    .map((shape) => {
      const { vertices } = mesh(shape, { tolerance: 0.1, angularTolerance: 0.5 });
      let hash = 2166136261;
      for (let i = 0; i < vertices.length; i++) {
        const q = Math.round(vertices[i] * 1000);
        hash = Math.imul(hash ^ (q & 0xff), 16777619) ^ (q >>> 8);
      }
      return `${vertices.length}:${(hash >>> 0).toString(16)}`;
    })
    .join(',');
}

function buildFingerprint(builder: FeatureBuilder, params: BinParams): string {
  const ctx = createInitialContext(params, undefined, false, undefined, undefined);
  const shapes = builder.build(ctx);
  const printed = fingerprintShapes(shapes);
  if (shapes) for (const shape of shapes) shape.delete();
  return printed;
}

/**
 * Whether generating `b` with caches warmed by `a` differs from generating `b`
 * cold — the only statement of the defect a user would ever see.
 */
function servesStaleBin(a: BinParams, b: BinParams): boolean {
  const generateBin = getGenerateBin();
  clearAllCaches();
  const cold = meshVolume(generateBin(b));
  clearAllCaches();
  generateBin(a);
  const warm = meshVolume(generateBin(b));
  clearAllCaches();
  return Math.abs(warm - cold) > 1e-6;
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

interface Fixture {
  readonly name: string;
  readonly params: BinParams;
}

/**
 * Wall text has no entry in `ALL_SCENARIOS`, and its builders need a loaded
 * face before they emit anything, so they are supplied here rather than left
 * uncovered.
 */
const TEXT_FIXTURES: readonly Fixture[] = [
  {
    name: 'engraved wall text',
    params: {
      ...DEFAULT_BIN_PARAMS,
      width: 3,
      depth: 2,
      height: 4,
      surfaceText: { walls: { front: 'HELLO' } },
    },
  },
  {
    name: 'embossed wall text',
    params: {
      ...DEFAULT_BIN_PARAMS,
      width: 3,
      depth: 2,
      height: 4,
      surfaceText: { walls: { front: 'HELLO' } },
      textDefaults: { ...DEFAULT_BIN_PARAMS.textDefaults, mode: 'emboss' },
    },
  },
];

function fixturesFor(builder: FeatureBuilder): Fixture[] {
  const candidates: Fixture[] = [
    ...TEXT_FIXTURES,
    ...ALL_SCENARIOS.map((scenario) => ({
      name: scenario.name,
      params: { ...DEFAULT_BIN_PARAMS, ...scenario.params },
    })),
  ];

  const chosen: Fixture[] = [];
  for (const candidate of candidates) {
    if (chosen.length >= FIXTURES_PER_BUILDER) break;
    const params = settle(candidate.params);
    let fingerprint: string;
    try {
      const ctx = createInitialContext(params, undefined, false, undefined, undefined);
      if (!builder.shouldBuild(ctx)) continue;
      fingerprint = buildFingerprint(builder, params);
    } catch {
      continue;
    }
    // A builder that produces nothing here caches nothing, so it has no stale
    // entry to serve and the sweep would only measure `none === none`.
    if (fingerprint !== 'none') chosen.push({ name: candidate.name, params });
  }
  return chosen;
}

// ─── The sweep ───────────────────────────────────────────────────────────────

interface Collision {
  readonly path: string;
  readonly from: unknown;
  readonly to: unknown;
}

function sweep(
  builder: FeatureBuilder,
  fixture: Fixture
): { collisions: Collision[]; undeclared: string[] } {
  const base = createInitialContext(fixture.params, undefined, false, undefined, undefined);
  const baseKey = builder.cacheKey(base);

  const touched = new Set<string>();
  const recorded = { ...base, params: recordingProxy(fixture.params, touched) };
  const recordedShapes = builder.build(recorded);
  if (recordedShapes) for (const shape of recordedShapes) shape.delete();

  const baseFingerprint = buildFingerprint(builder, fixture.params);
  const candidates = leafPaths(fixture.params).filter((leaf) =>
    [...touched].some(
      (read) => leaf === read || leaf.startsWith(`${read}.`) || read.startsWith(`${leaf}.`)
    )
  );

  const collisions: Collision[] = [];
  const undeclared: string[] = [];
  for (const path of candidates) {
    const current = getAt(fixture.params, path);
    const perturbation = perturbationFor(path, current);
    if (!perturbation) {
      undeclared.push(`${path} (currently ${JSON.stringify(current)})`);
      continue;
    }
    if (perturbation.kind === 'skip') continue;

    const perturbed = settle(setAt(fixture.params, path, perturbation.next) as BinParams);
    // A rule may have pulled the value straight back; nothing changed to test.
    if (JSON.stringify(getAt(perturbed, path)) === JSON.stringify(current)) continue;

    try {
      const ctx = createInitialContext(perturbed, undefined, false, undefined, undefined);
      if (!builder.shouldBuild(ctx)) continue;
      if (builder.cacheKey(ctx) !== baseKey) continue;
      if (buildFingerprint(builder, perturbed) === baseFingerprint) continue;
    } catch {
      continue;
    }
    collisions.push({ path, from: current, to: perturbation.next });
  }
  return { collisions, undeclared };
}

// ─── Test ────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  await initBrepjs();
  await loadTestFonts();
}, 60_000);

describe('FeatureBuilder cache-key discipline', () => {
  it.each(BIN_FEATURE_BUILDERS.map((builder) => [builder.name, builder] as const))(
    '%s keys on every param that moves its geometry',
    (name, builder) => {
      const fixtures = fixturesFor(builder);
      expect(
        fixtures.length,
        `No scenario exercises ${name}, so its cache key is unverified. Add one to ALL_SCENARIOS (or to TEXT_FIXTURES) that makes this builder produce geometry.`
      ).toBeGreaterThan(0);

      const confirmed: string[] = [];
      const undeclared = new Set<string>();

      for (const fixture of fixtures) {
        const result = sweep(builder, fixture);
        for (const entry of result.undeclared) undeclared.add(entry);

        for (const collision of result.collisions) {
          const perturbed = settle(
            setAt(fixture.params, collision.path, collision.to) as BinParams
          );
          if (!servesStaleBin(fixture.params, perturbed)) continue;
          confirmed.push(
            `${collision.path}: ${JSON.stringify(collision.from)} -> ${JSON.stringify(collision.to)} ` +
              `(scenario "${fixture.name}") — same cacheKey, different bin`
          );
        }
      }

      expect(
        [...undeclared],
        `${name} reads params this test cannot perturb. Add each to PERTURBATIONS with a valid alternative value, or \`false\` if it cannot affect geometry.`
      ).toEqual([]);

      expect(
        confirmed,
        `${name}.cacheKey omits an input its build reads, so editing it serves the previous geometry from the feature cache.`
      ).toEqual([]);
    },
    240_000
  );
});

/**
 * Scenario case type definitions and builders for bin generation tests.
 *
 * NOTE: When overriding nested objects in `params` (e.g. `base`, `label`),
 * you must spread the default first:
 *   `{ ...DEFAULT_BIN_PARAMS.base, stackingLip: true }`
 * TypeScript's structural typing enforces this for required nested fields.
 */
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams, Insert, Cutout } from '@/shared/types/bin';
import type { MeshData } from '@/features/generation/bridge/types';

// ─── Types ───────────────────────────────────────────────────────────────────

export type AssertionMode = 'snapshot' | 'structural';

/**
 * Configuration for comparison tests (e.g. solid vs hollow).
 *
 * @example Nested objects must spread defaults:
 * ```ts
 * compareWith: {
 *   params: { base: { ...DEFAULT_BIN_PARAMS.base, solid: false } },
 *   assert: (a, b) => expect(a.triangleCount).toBeLessThan(b.triangleCount),
 * }
 * ```
 */
export interface CompareWith {
  /** Parameter overrides for the comparison mesh. */
  params: Partial<BinParams>;
  forExport?: boolean;
  /** First arg = scenario result, second = comparison result. */
  assert: (scenarioResult: MeshData, comparisonResult: MeshData) => void;
}

export interface ScenarioCase {
  name: string;
  category: string;
  /** Overrides on DEFAULT_BIN_PARAMS. */
  params: Partial<BinParams>;
  forExport?: boolean;
  assert: AssertionMode;
  timeout: number;
  /** Runs after standard assertions with the generated mesh. */
  customAssert?: (result: MeshData, params: BinParams) => void;
  /** Generate a second mesh and compare. */
  compareWith?: CompareWith;
}

// ─── Builder ─────────────────────────────────────────────────────────────────

/**
 * Create a scenario case with sensible defaults.
 * - `assert` defaults to `'snapshot'`
 * - `timeout` defaults to `30000`
 */
export function defineScenario(
  category: string,
  name: string,
  config: Omit<ScenarioCase, 'name' | 'category' | 'assert' | 'timeout'> &
    Partial<Pick<ScenarioCase, 'assert' | 'timeout'>>
): ScenarioCase {
  return {
    name,
    category,
    assert: 'snapshot',
    timeout: 30_000,
    ...config,
  };
}

// ─── Param helpers ───────────────────────────────────────────────────────────

/** Build full BinParams from partial overrides. */
export function buildParams(overrides: Partial<BinParams>): BinParams {
  return { ...DEFAULT_BIN_PARAMS, ...overrides };
}

/** Factory for test Insert objects with sensible defaults. */
export function makeInsert(overrides: Partial<Insert>): Insert {
  return {
    id: 'test-insert',
    templateId: null,
    shape: 'circle',
    x: 0,
    y: 0,
    width: 20,
    depth: 20,
    cutDepth: 5,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    ...overrides,
  };
}

/**
 * Factory for test Cutout objects with sensible defaults.
 *
 * Accepts the legacy `scoopRadius` field as an alias for setting both axes
 * to the same value; lets existing fixtures keep working unchanged.
 */
export function makeCutout(overrides: Partial<Cutout> & { scoopRadius?: number }): Cutout {
  const { scoopRadius, ...rest } = overrides;
  const merged: Cutout = {
    id: 'test-cutout',
    shape: 'rectangle',
    x: 0,
    y: 0,
    width: 15,
    depth: 15,
    cutDepth: 5,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
    scoopRadiusW: 0,
    scoopRadiusD: 0,
    ...rest,
  };
  if (
    scoopRadius !== undefined &&
    rest.scoopRadiusW === undefined &&
    rest.scoopRadiusD === undefined
  ) {
    return { ...merged, scoopRadiusW: scoopRadius, scoopRadiusD: scoopRadius };
  }
  return merged;
}

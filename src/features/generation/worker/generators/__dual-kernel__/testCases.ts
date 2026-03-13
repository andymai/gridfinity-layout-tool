/**
 * Shared test case definitions for kernel parity tests.
 *
 * CORE_PARITY_CASES covers the common bin configurations tested by both
 * exportParity and topologyParity. Individual test suites can extend
 * with additional cases specific to their domain.
 */
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';

export interface ParityTestCase {
  readonly name: string;
  readonly overrides: Partial<BinParams>;
}

/** Core parity cases shared across export, topology, and visual parity tests. */
export const CORE_PARITY_CASES: readonly ParityTestCase[] = [
  {
    name: '1×1 standard lip',
    overrides: { width: 1, depth: 1 },
  },
  {
    name: '2×2 standard no-lip',
    overrides: {
      width: 2,
      depth: 2,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
    },
  },
  {
    name: '2×2 magnet+screw lip',
    overrides: {
      width: 2,
      depth: 2,
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet_and_screw', stackingLip: true },
    },
  },
  {
    name: '2×2 compartments + scoop',
    overrides: {
      width: 2,
      depth: 2,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
      compartments: { cols: 2, rows: 2, thickness: 1.2, cells: [0, 1, 2, 3] },
      scoop: { enabled: true, radius: 'auto' },
    },
  },
  {
    name: '1×1 flat no-lip',
    overrides: {
      width: 1,
      depth: 1,
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat', stackingLip: false },
    },
  },
];

/** Extended cases for topology parity (adds half-bin and complex feature combos). */
// ─── Shared Physical Constants ─────────────────────────────────────────────
// Single source of truth for the standard 1×1 bin dimensions used across
// diagnoseShell, diagnoseOps, and future diagnostic tests.

/** Interior width of a 1×1 Gridfinity bin (mm). */
export const STANDARD_BIN_WIDTH = 41.5;

/** Standard bin height: 3 height units (mm). */
export const STANDARD_HEIGHT = 21;

/** Nominal wall / shell thickness (mm). */
export const SHELL_THICKNESS = 1.2;

/** Extended cases for topology parity (adds half-bin and complex feature combos). */
export const TOPOLOGY_EXTENDED_CASES: readonly ParityTestCase[] = [
  {
    name: '1.5×2 half-bin',
    overrides: {
      width: 1.5,
      depth: 2,
    },
  },
  {
    name: '3×3 scoop+label+lip',
    overrides: {
      width: 3,
      depth: 3,
      scoop: { enabled: true, radius: 'auto' },
      label: { enabled: true, support: 'bracket', depth: 12, width: 100, alignment: 'left' },
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
    },
  },
];

import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { defineScenario } from '../__kernel-tests__/scenarioTypes';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';

export const scoop: ScenarioCase[] = [
  defineScenario('scoop', '2\u00d72 scoop disabled', {
    params: { scoop: { enabled: false, radius: 'auto' as const } },
  }),
  defineScenario('scoop', '2\u00d72 scoop auto radius', {
    params: { scoop: { enabled: true, radius: 'auto' as const } },
  }),
  defineScenario('scoop', '2\u00d72 scoop radius 10mm', {
    params: { scoop: { enabled: true, radius: 10 } },
  }),
];

export const scoopTwoVariable: ScenarioCase[] = [
  defineScenario('scoop two-variable', '2×2 steep curved scoop (run < height)', {
    params: { scoop: { enabled: true, radius: 20, run: 8, style: 'curved' as const } },
  }),
  defineScenario('scoop two-variable', '2×2 shallow curved scoop (run > height)', {
    params: { scoop: { enabled: true, radius: 8, run: 20, style: 'curved' as const } },
  }),
  defineScenario('scoop two-variable', '2×2 straight scoop (chamfer)', {
    params: { scoop: { enabled: true, radius: 12, run: 12, style: 'straight' as const } },
  }),
  defineScenario('scoop two-variable', '2×2 steep straight scoop', {
    params: { scoop: { enabled: true, radius: 20, run: 8, style: 'straight' as const } },
  }),
];

export const scoopSides: ScenarioCase[] = [
  defineScenario('scoop side', 'scoop on the back wall', {
    params: { scoop: { enabled: true, radius: 'auto' as const, side: 'back' as const } },
  }),
  defineScenario('scoop side', 'scoop on the left wall', {
    params: { scoop: { enabled: true, radius: 'auto' as const, side: 'left' as const } },
  }),
  defineScenario('scoop side', 'scoop on the right wall', {
    params: { scoop: { enabled: true, radius: 'auto' as const, side: 'right' as const } },
  }),
  // The long-skinny case: the scoop belongs on the long wall, which
  // is only reachable once the side is selectable.
  defineScenario('scoop side', '6×1 bin scooped on the long wall', {
    params: {
      width: 6,
      depth: 1,
      scoop: { enabled: true, radius: 'auto' as const, side: 'back' as const },
    },
  }),
  defineScenario('scoop side', 'side scoop with lip (outer-wall offset active)', {
    params: {
      scoop: { enabled: true, radius: 'auto' as const, side: 'right' as const },
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
    },
  }),
  defineScenario('scoop side', 'left scoop across 2 columns (outer vs interior)', {
    params: {
      scoop: { enabled: true, radius: 'auto' as const, side: 'left' as const },
      compartments: { cols: 2, rows: 1, cells: [0, 1], thickness: 0.8 },
    },
  }),
];

// A socketless base (flat / tray) never gets the export-time deferred-socket
// fuse that heals an additive feature's coincident-face contact, so a scoop's
// wall-hugging faces shipped straight into the STL as a non-manifold gap. These
// exercise the export-integrity manifold/boundary assertions against that class
// directly.
export const scoopFlatBase: ScenarioCase[] = [
  defineScenario('scoop flat base', '1×1 flat base scoop with lip', {
    params: {
      width: 1,
      depth: 1,
      scoop: { enabled: true, radius: 'auto' as const },
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat' as const },
    },
  }),
  defineScenario('scoop flat base', '2×2 flat base scoop with lip', {
    params: {
      scoop: { enabled: true, radius: 'auto' as const },
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat' as const },
    },
  }),
  defineScenario('scoop flat base', '2×2 flat base scoop no lip', {
    params: {
      scoop: { enabled: true, radius: 'auto' as const },
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat' as const, stackingLip: false },
    },
  }),
  defineScenario('scoop flat base', '2×2 flat base thin-wall scoop (corner clip active)', {
    params: {
      wallThickness: 0.8,
      scoop: { enabled: true, radius: 'auto' as const },
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat' as const },
    },
  }),
  defineScenario('scoop flat base', '2×2 tray-bottom (lid) base scoop with lip', {
    params: {
      scoop: { enabled: true, radius: 'auto' as const },
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'lid' as const },
    },
  }),
];

export const scoopLipInteraction: ScenarioCase[] = [
  defineScenario(
    'scoop + lip interaction',
    'scoop with lip (single compartment, front-row offset active)',
    {
      params: {
        scoop: { enabled: true, radius: 'auto' },
        base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
      },
    }
  ),
  defineScenario(
    'scoop + lip interaction',
    'scoop with lip + 2 rows (front-row offset vs interior-row)',
    {
      params: {
        scoop: { enabled: true, radius: 'auto' },
        base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
        compartments: { cols: 1, rows: 2, cells: [0, 1], thickness: 0.8 },
      },
    }
  ),
];

// Multi-compartment GRID scoops (cols > 1 AND rows > 1): the bento-box shape.
// scoopSides only reaches cols > 1 with a single row, and scoopLipInteraction a
// single column with two rows, so a scoop rising from an INTERIOR divider (a
// back-row compartment) with INTERIOR span-ends on both sides went through
// export integrity here for the first time. Covers the socketed default (where
// the deferred-socket fuse heals the floor) and a flat socketless base (which
// does not), plus an irregular layout mixing a tall column with two stacked
// compartments.
export const scoopMultiCompartment: ScenarioCase[] = [
  defineScenario('scoop multi-compartment', '2×2 grid front scoop (standard base + lip)', {
    params: {
      scoop: { enabled: true, radius: 'auto' },
      compartments: { cols: 2, rows: 2, cells: [0, 1, 2, 3], thickness: 1.2 },
    },
  }),
  defineScenario('scoop multi-compartment', '2×2 grid front scoop (flat base)', {
    params: {
      scoop: { enabled: true, radius: 'auto' },
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat' },
      compartments: { cols: 2, rows: 2, cells: [0, 1, 2, 3], thickness: 1.2 },
    },
  }),
  defineScenario('scoop multi-compartment', '2×2 grid left scoop (interior column span-ends)', {
    params: {
      scoop: { enabled: true, radius: 'auto', side: 'left' },
      compartments: { cols: 2, rows: 2, cells: [0, 1, 2, 3], thickness: 1.2 },
    },
  }),
  defineScenario(
    'scoop multi-compartment',
    'irregular grid (tall column + 2 stacked) front scoop',
    {
      params: {
        scoop: { enabled: true, radius: 'auto' },
        compartments: { cols: 2, rows: 2, cells: [0, 1, 0, 2], thickness: 1.2 },
      },
    }
  ),
];

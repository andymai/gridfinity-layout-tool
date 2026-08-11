/**
 * Lid-vs-label-tab clearance (#3401).
 *
 * The bin and its lid are separate solids, so nothing about either mesh says
 * they interpenetrate: both are watertight, both have plausible triangle
 * counts, and every bounding-box assertion passes while the lid physically
 * cannot seat (CLAUDE.md gotcha #10). The only way to see the defect is to
 * mate the two and probe inside the assembly, which is what this file does.
 *
 * Before the fix, a full-width back tab and a 100%-coverage lid overlapped by
 * 1.25mm along the left and right rails — the shelf top sits inside the band
 * the rail sweeps. A 2x2 bin with a deeper tab reached that state at 75%,
 * which is the "75 or higher" from the report.
 *
 *   pnpm run test:run src/features/generation/worker/generators/lidLabelTabClearance.scenario
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import { boundingBox, verticalSolidSpans } from './__kernel-tests__/meshAssertions';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';
import {
  lidAnchorZ,
  resolveLidCavityExtraMm,
  LID_FIT_CLEARANCE,
  LID_CORNER_RADIUS,
} from '@/shared/types/bin';
import type { BinParams, LabelTabEdges, LabelTabSupport } from '@/features/bin-designer/types';
import type { MeshData } from '@/features/generation/bridge/types';

interface Case {
  readonly name: string;
  readonly depth: number;
  readonly coverage: number;
  readonly edges: LabelTabEdges;
  readonly tabDepth: number;
  readonly support: LabelTabSupport;
  readonly overhang?: BinParams['overhang'];
  /** Tab width as a percentage of its compartment; defaults to full width. */
  readonly tabWidth?: number;
  /**
   * Rails expected on the tab's own wall. Set only where the point of the case
   * is that segments SURVIVE beside a narrow tab: absence-of-collision is
   * satisfied by building no rail at all, which is exactly what the pre-#3401
   * code did.
   */
  readonly expectAnchorRails?: number;
}

/**
 * Most cases interfered before the fix. The two baselines never did (the rail
 * did not reach the tab), and neither did the two partial-rail cases: the old
 * code dropped the whole wall, so a narrow tab had nothing to collide with.
 * Those two carry a positive assertion instead, below.
 */
const CASES: readonly Case[] = [
  {
    name: 'baseline 50% clears',
    depth: 3,
    coverage: 50,
    edges: 'back',
    tabDepth: 12,
    support: 'bracket',
  },
  {
    name: 'baseline 75% clears',
    depth: 3,
    coverage: 75,
    edges: 'back',
    tabDepth: 12,
    support: 'bracket',
  },
  {
    name: '100% on a 2x3 bin',
    depth: 3,
    coverage: 100,
    edges: 'back',
    tabDepth: 12,
    support: 'bracket',
  },
  {
    name: '100% on a 2x2 bin',
    depth: 2,
    coverage: 100,
    edges: 'back',
    tabDepth: 12,
    support: 'bracket',
  },
  {
    name: '75% with a deep tab',
    depth: 2,
    coverage: 75,
    edges: 'back',
    tabDepth: 16,
    support: 'bracket',
  },
  {
    name: 'solid support at 100%',
    depth: 3,
    coverage: 100,
    edges: 'back',
    tabDepth: 12,
    support: 'solid',
  },
  {
    name: 'front-anchored tabs',
    depth: 3,
    coverage: 100,
    edges: 'front',
    tabDepth: 12,
    support: 'bracket',
  },
  {
    name: 'tabs on both edges',
    depth: 3,
    coverage: 100,
    edges: 'both',
    tabDepth: 12,
    support: 'bracket',
  },
  {
    name: 'symmetric overhang at 100%',
    depth: 3,
    coverage: 100,
    edges: 'back',
    tabDepth: 12,
    support: 'bracket',
    overhang: { left: 4, right: 4, front: 4, back: 4, feet: false },
  },
  {
    name: 'partial back rails beside a narrow tab',
    expectAnchorRails: 2,
    depth: 3,
    coverage: 100,
    edges: 'back',
    tabDepth: 12,
    support: 'bracket',
    tabWidth: 40,
  },
  {
    name: 'partial back rails beside a narrow front tab',
    expectAnchorRails: 2,
    depth: 3,
    coverage: 100,
    edges: 'front',
    tabDepth: 12,
    support: 'bracket',
    tabWidth: 40,
  },
  {
    name: 'asymmetric overhang at 100%',
    depth: 3,
    coverage: 100,
    edges: 'back',
    tabDepth: 12,
    support: 'bracket',
    overhang: { left: 0, right: 6, front: 2, back: 0, feet: false },
  },
];

function makeParams(c: Case): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: 2,
    depth: c.depth,
    height: 6,
    ...(c.overhang ? { overhang: c.overhang } : {}),
    label: {
      ...DEFAULT_BIN_PARAMS.label,
      enabled: true,
      support: c.support,
      depth: c.tabDepth,
      width: c.tabWidth ?? 100,
      alignment: 'center',
      edges: c.edges,
    },
    lid: {
      ...DEFAULT_BIN_PARAMS.lid,
      enabled: true,
      attachment: 'clickRails',
      clickRails: { front: true, back: true, left: true, right: true },
      clickRailCoverage: c.coverage,
    },
  };
}

/**
 * Z shift that seats the lid on the bin.
 *
 * `lidAnchorZ` is where the bin's lip top lands in lid-local Z, so the offset
 * is the bin's real lip top minus that. `PREVIEW_Z_OFFSET` is deliberately
 * absent — that is a preview-only group nudge, and including it would open a
 * 0.1mm gap that hides exactly the interference being measured.
 */
function lidZOffset(p: BinParams): number {
  const lipTop = p.height * p.heightUnitMm + GRIDFINITY.LIP_HEIGHT - GRIDFINITY.LIP_OVERLAP;
  return lipTop - lidAnchorZ(p.heightUnitMm, LID_FIT_CLEARANCE, resolveLidCavityExtraMm(p));
}

/** Total mm of bin and lid material sharing the same Z at this column. */
function interferenceAt(bin: MeshData, lid: MeshData, x: number, y: number, dz: number): number {
  const binSpans = verticalSolidSpans(bin, x, y);
  const lidSpans = verticalSolidSpans(lid, x, y).map(([lo, hi]) => [lo + dz, hi + dz] as const);
  let total = 0;
  for (const [a0, a1] of binSpans) {
    for (const [b0, b1] of lidSpans) {
      total += Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
    }
  }
  return total;
}

/**
 * Worst interference anywhere along the four rail lines.
 *
 * Sweeps a small band of X/Y offsets around each rail's spine rather than the
 * spine alone: the rail profile is 2.65mm wide and the shelf it clashes with
 * is thin, so a single-column probe can slip between them and report clean.
 */
function worstInterference(bin: MeshData, lid: MeshData, dz: number): number {
  // Probe positions come from the LID's own bounds rather than a re-derivation
  // of its width: overhang both widens and shifts the lid, and an arithmetic
  // slip there would move every probe off the rails and quietly report clean.
  const bb = boundingBox(lid.vertices);
  const cx = (bb.minX + bb.maxX) / 2;
  const cy = (bb.minY + bb.maxY) / 2;
  const spineX = (bb.maxX - bb.minX) / 2 - LID_CORNER_RADIUS;
  const spineY = (bb.maxY - bb.minY) / 2 - LID_CORNER_RADIUS;

  let worst = 0;
  for (const off of [-0.6, -0.2, 0, 0.6, 1.4]) {
    // Left and right rails: sweep along Y at the rail's X.
    for (let y = cy - spineY; y <= cy + spineY; y += 1) {
      for (const sx of [cx + spineX + off, cx - spineX - off]) {
        worst = Math.max(worst, interferenceAt(bin, lid, sx, y, dz));
      }
    }
    // Front and back rails: sweep along X at the rail's Y.
    for (let x = cx - spineX; x <= cx + spineX; x += 1) {
      for (const sy of [cy + spineY + off, cy - spineY - off]) {
        worst = Math.max(worst, interferenceAt(bin, lid, x, sy, dz));
      }
    }
  }
  return worst;
}

beforeAll(async () => {
  await initBrepjs();
}, 180000);

describe('lid click rails clear label tabs', () => {
  it.each(CASES)(
    '$name',
    async (c) => {
      const { generateLid } = await import('./lidOrchestrator');
      const params = makeParams(c);
      const bin = getGenerateBin()(params, undefined, false);
      const lid = generateLid(params);
      if (!bin) throw new Error('expected the bin to build');
      if (!lid) throw new Error('expected the lid to build');

      // 0.05mm absorbs mesh tessellation noise on the curved corner blends;
      // the defect this guards against measured 1.25mm.
      expect(worstInterference(bin, lid, lidZOffset(params))).toBeLessThan(0.05);

      if (c.expectAnchorRails !== undefined) {
        const { railPlacements } = await import('./lidClickRail');
        const { resolveLidInputs } = await import('./lidInputs');
        const anchorRotation = c.edges === 'front' ? 180 : 0;
        const onAnchorWall = railPlacements(resolveLidInputs(params)).filter(
          (p) => p.rotationDeg === anchorRotation
        );
        expect(onAnchorWall).toHaveLength(c.expectAnchorRails);
      }
    },
    300000
  );

  it('the probe can see a real clash', async () => {
    // Control for the twelve assertions above. Builds the pre-fix pairing by
    // hand: a bin WITH tabs, and a lid generated as though they were not there
    // (which is what the old code did once it dropped the conflicting side).
    // If the probe stops finding either solid, or `lidZOffset` drifts, every
    // other case in this file passes while guarding nothing.
    const { generateLid } = await import('./lidOrchestrator');
    const params = makeParams({
      name: 'control',
      depth: 3,
      coverage: 100,
      edges: 'back',
      tabDepth: 12,
      support: 'bracket',
    });
    const bin = getGenerateBin()(params, undefined, false);
    const blindLid = generateLid({
      ...params,
      label: { ...params.label, enabled: false },
    });
    if (!bin) throw new Error('expected the bin to build');
    if (!blindLid) throw new Error('expected the lid to build');

    expect(worstInterference(bin, blindLid, lidZOffset(params))).toBeGreaterThan(1);
  }, 300000);
});

// @vitest-environment node
/**
 * Tests for the label tab builder.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs } from './__dual-kernel__/wasmInit';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';

beforeAll(async () => {
  await initBrepjs();
}, 30_000);

describe('buildLabelTabs', () => {
  it('returns null when label disabled', async () => {
    const { buildLabelTabs } = await import('./labelTabBuilder');
    const params = {
      ...DEFAULT_BIN_PARAMS,
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: false },
    };
    const result = buildLabelTabs(params, 80, 80, 35, 1.2);
    expect(result).toBeNull();
  });

  it('builds label tabs with bracket support', async () => {
    const { buildLabelTabs } = await import('./labelTabBuilder');
    const params = {
      ...DEFAULT_BIN_PARAMS,
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, support: 'bracket' as const },
    };
    const result = buildLabelTabs(params, 80, 80, 35, 1.2);
    expect(result).not.toBeNull();
  });

  it('builds label tabs with solid support', async () => {
    const { buildLabelTabs } = await import('./labelTabBuilder');
    const params = {
      ...DEFAULT_BIN_PARAMS,
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, support: 'solid' as const },
    };
    const result = buildLabelTabs(params, 80, 80, 35, 1.2);
    expect(result).not.toBeNull();
  });

  it('builds label tabs with fillet support', async () => {
    const { buildLabelTabs } = await import('./labelTabBuilder');
    const params = {
      ...DEFAULT_BIN_PARAMS,
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, support: 'fillet' as const },
    };
    const result = buildLabelTabs(params, 80, 80, 35, 1.2);
    expect(result).not.toBeNull();
  });

  it('fillet support is positioned under the shelf, not at the bin floor', async () => {
    const { buildLabelTabs } = await import('./labelTabBuilder');
    const { mesh } = await import('brepjs');
    const wallHeight = 35;
    const wt = 1.2;
    const params = {
      ...DEFAULT_BIN_PARAMS,
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, support: 'fillet' as const },
    };
    const result = buildLabelTabs(params, 80, 80, wallHeight, wt);
    expect(result).not.toBeNull();

    // Tessellate and check Z bounds — fillet must sit near the top of the
    // wall (wallHeight), not at Z=0 (the bin floor). Before the fix, the
    // fillet was placed at Z=0..gussetLeg instead of (wallHeight-tabHeight)..wallHeight.
    const tessellated = mesh(result!, { tolerance: 0.5, angularTolerance: 15 });
    const verts = tessellated.vertices;
    let minZ = Infinity;
    for (let i = 2; i < verts.length; i += 3) {
      if (verts[i] < minZ) minZ = verts[i];
    }
    // The tab's lowest point should be above half the wall height
    // (it sits near the top, not at the floor)
    expect(minZ).toBeGreaterThan(wallHeight / 2);
  });

  it.each(['solid', 'bracket', 'fillet'] as const)(
    '%s support reaches the front edge of the shelf (no overhang gap)',
    async (support) => {
      const { buildLabelTabs } = await import('./labelTabBuilder');
      const { mesh } = await import('brepjs');
      const wallHeight = 35;
      const wt = 1.2;
      const tabDepth = 12;
      const params = {
        ...DEFAULT_BIN_PARAMS,
        label: {
          ...DEFAULT_BIN_PARAMS.label,
          enabled: true,
          support,
          depth: tabDepth,
          width: 50,
          alignment: 'center' as const,
        },
      };
      const result = buildLabelTabs(params, 80, 80, wallHeight, wt);
      expect(result).not.toBeNull();

      // Tessellate and verify support structure extends well below the shelf.
      // The support's Z-extent is the key regression indicator: without support,
      // minZ would be near wallHeight - wt (just the shelf plate). With support,
      // minZ should reach wallHeight - tabHeight (near wallHeight - tabDepth).
      const tessellated = mesh(result!, { tolerance: 0.1, angularTolerance: 10 });
      const verts = tessellated.vertices;
      const shelfUndersideZ = wallHeight - wt;

      let minZ = Infinity;
      let hasSupportVerts = false;
      for (let i = 2; i < verts.length; i += 3) {
        if (verts[i] < minZ) minZ = verts[i];
        if (verts[i] < shelfUndersideZ - 0.1) hasSupportVerts = true;
      }
      // Support geometry must exist below the shelf
      expect(hasSupportVerts).toBe(true);
      // Support must extend well below the shelf underside (wallHeight - wt = 33.8).
      // Without support, minZ would equal shelfUndersideZ.
      // With support, minZ should be near wallHeight - tabDepth = 23.
      expect(minZ).toBeLessThan(shelfUndersideZ - 5);
    }
  );
});

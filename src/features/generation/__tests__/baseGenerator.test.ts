import { describe, it, expect } from 'vitest';
import { generateBaseGeometry, generateStackingLip } from '../worker/generators/baseGenerator';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';
import type { BinParams } from '@/features/bin-designer/types';

describe('baseGenerator', () => {
  describe('generateBaseGeometry', () => {
    it('produces empty mesh for standard base without stacking lip', () => {
      const params: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        base: { ...DEFAULT_BIN_PARAMS.base, style: 'standard', stackingLip: false },
      };
      const mesh = generateBaseGeometry(params);
      expect(mesh.triangleCount).toBe(0);
    });

    it('produces stacking lip geometry when enabled', () => {
      const params: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        base: { ...DEFAULT_BIN_PARAMS.base, style: 'standard', stackingLip: true },
      };
      const mesh = generateBaseGeometry(params);
      expect(mesh.triangleCount).toBeGreaterThan(0);
    });

    it('produces magnet hole geometry for magnet base style', () => {
      const params: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet', stackingLip: false },
      };
      const mesh = generateBaseGeometry(params);
      expect(mesh.triangleCount).toBeGreaterThan(0);
    });

    it('produces screw hole geometry for screw base style', () => {
      const params: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        base: { ...DEFAULT_BIN_PARAMS.base, style: 'screw', stackingLip: false },
      };
      const mesh = generateBaseGeometry(params);
      expect(mesh.triangleCount).toBeGreaterThan(0);
    });

    it('produces empty mesh for weighted style without stacking lip', () => {
      const params: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        base: { ...DEFAULT_BIN_PARAMS.base, style: 'weighted', stackingLip: false },
      };
      const mesh = generateBaseGeometry(params);
      expect(mesh.triangleCount).toBe(0);
    });

    it('magnet holes are within the base height', () => {
      const params: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet', stackingLip: false },
      };
      const mesh = generateBaseGeometry(params);

      for (let i = 2; i < mesh.vertices.length; i += 3) {
        const z = mesh.vertices[i];
        expect(z).toBeGreaterThanOrEqual(-0.001);
        expect(z).toBeLessThanOrEqual(params.base.magnetDepth + 0.001);
      }
    });

    it('screw holes respect screw depth', () => {
      const params: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        base: { ...DEFAULT_BIN_PARAMS.base, style: 'screw', stackingLip: false },
      };
      const mesh = generateBaseGeometry(params);

      for (let i = 2; i < mesh.vertices.length; i += 3) {
        const z = mesh.vertices[i];
        expect(z).toBeGreaterThanOrEqual(-0.001);
        expect(z).toBeLessThanOrEqual(GRIDFINITY.SCREW_DEPTH + 0.001);
      }
    });

    it('larger bins produce more magnet hole geometry', () => {
      const small: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        width: 1,
        depth: 1,
        base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet', stackingLip: false },
      };
      const large: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        width: 3,
        depth: 3,
        base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet', stackingLip: false },
      };

      const smallMesh = generateBaseGeometry(small);
      const largeMesh = generateBaseGeometry(large);

      expect(largeMesh.triangleCount).toBeGreaterThan(smallMesh.triangleCount);
    });
  });

  describe('magnet_and_screw base style', () => {
    it('produces geometry for magnet_and_screw style', () => {
      const params: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet_and_screw', stackingLip: false },
      };
      const mesh = generateBaseGeometry(params);
      expect(mesh.triangleCount).toBeGreaterThan(0);
    });

    it('produces more geometry than magnet-only style', () => {
      const magnetOnly: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet', stackingLip: false },
      };
      const combo: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet_and_screw', stackingLip: false },
      };

      const magnetMesh = generateBaseGeometry(magnetOnly);
      const comboMesh = generateBaseGeometry(combo);

      // Combo has both magnet AND screw holes = more triangles
      expect(comboMesh.triangleCount).toBeGreaterThan(magnetMesh.triangleCount);
    });

    it('produces more geometry than screw-only style', () => {
      const screwOnly: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        base: { ...DEFAULT_BIN_PARAMS.base, style: 'screw', stackingLip: false },
      };
      const combo: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet_and_screw', stackingLip: false },
      };

      const screwMesh = generateBaseGeometry(screwOnly);
      const comboMesh = generateBaseGeometry(combo);

      expect(comboMesh.triangleCount).toBeGreaterThan(screwMesh.triangleCount);
    });

    it('combo holes stay within base height', () => {
      const params: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet_and_screw', stackingLip: false },
      };
      const mesh = generateBaseGeometry(params);

      const maxHoleDepth = Math.max(params.base.magnetDepth, GRIDFINITY.SCREW_DEPTH);
      for (let i = 2; i < mesh.vertices.length; i += 3) {
        expect(mesh.vertices[i]).toBeGreaterThanOrEqual(-0.001);
        expect(mesh.vertices[i]).toBeLessThanOrEqual(maxHoleDepth + 0.001);
      }
    });

    it('larger bins produce proportionally more combo hole geometry', () => {
      const small: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        width: 1,
        depth: 1,
        base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet_and_screw', stackingLip: false },
      };
      const large: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        width: 3,
        depth: 3,
        base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet_and_screw', stackingLip: false },
      };

      const smallMesh = generateBaseGeometry(small);
      const largeMesh = generateBaseGeometry(large);

      expect(largeMesh.triangleCount).toBeGreaterThan(smallMesh.triangleCount);
    });

    it('half-unit bins still get corner holes in combo style', () => {
      const params: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        width: 0.5,
        depth: 0.5,
        base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet_and_screw', stackingLip: false },
      };
      const mesh = generateBaseGeometry(params);
      // Sub-1-unit bins should still get 4 corner holes (8 holes total for combo)
      expect(mesh.triangleCount).toBeGreaterThan(0);
    });
  });

  describe('generateStackingLip', () => {
    it('generates geometry above the bin height', () => {
      const outerWidth = 83.5; // 2-unit bin
      const outerDepth = 83.5;
      const totalHeight = 26; // 3-unit height + base

      const mesh = generateStackingLip(outerWidth, outerDepth, totalHeight);

      expect(mesh.triangleCount).toBeGreaterThan(0);

      // All vertices should be at or above totalHeight
      for (let i = 2; i < mesh.vertices.length; i += 3) {
        expect(mesh.vertices[i]).toBeGreaterThanOrEqual(totalHeight - 0.001);
      }
    });

    it('lip height matches Gridfinity spec', () => {
      const totalHeight = 26;
      const mesh = generateStackingLip(84, 84, totalHeight);

      let maxZ = -Infinity;
      for (let i = 2; i < mesh.vertices.length; i += 3) {
        maxZ = Math.max(maxZ, mesh.vertices[i]);
      }

      const lipHeight = maxZ - totalHeight;
      expect(lipHeight).toBeCloseTo(GRIDFINITY.LIP_HEIGHT, 1);
    });

    it('lip does not extend beyond outer bin footprint', () => {
      const w = 83.5;
      const d = 83.5;
      const mesh = generateStackingLip(w, d, 26);

      for (let i = 0; i < mesh.vertices.length; i += 3) {
        expect(Math.abs(mesh.vertices[i])).toBeLessThanOrEqual(w / 2 + 0.001);
        expect(Math.abs(mesh.vertices[i + 1])).toBeLessThanOrEqual(d / 2 + 0.001);
      }
    });
  });
});

import { describe, it, expect } from 'vitest';
import {
  getVisibleBins,
  getGridBins,
  getStagingBins,
  getLayerBins,
  splitBinsByLocation,
} from '@/shared/utils';
import { STAGING_ID } from '@/core/constants';
import type { Bin } from '@/core/types';

// Test data factory
function createBin(id: string, layerId: string): Bin {
  return {
    id,
    x: 0,
    y: 0,
    width: 1,
    depth: 1,
    height: 6,
    layerId,
    category: 'default',
  };
}

describe('bins utilities', () => {
  const layer1Id = 'layer-1';
  const layer2Id = 'layer-2';

  const bins: Bin[] = [
    createBin('bin1', layer1Id),
    createBin('bin2', layer1Id),
    createBin('bin3', layer2Id),
    createBin('bin4', STAGING_ID),
    createBin('bin5', STAGING_ID),
  ];

  describe('getGridBins', () => {
    it('should return only bins on the grid (not staging)', () => {
      const result = getGridBins(bins);
      expect(result).toHaveLength(3);
      expect(result.every((b) => b.layerId !== STAGING_ID)).toBe(true);
      expect(result.map((b) => b.id)).toEqual(['bin1', 'bin2', 'bin3']);
    });

    it('should return empty array when all bins are staging', () => {
      const stagingOnly = [createBin('s1', STAGING_ID), createBin('s2', STAGING_ID)];
      expect(getGridBins(stagingOnly)).toEqual([]);
    });

    it('should return all bins when none are staging', () => {
      const gridOnly = [createBin('g1', layer1Id), createBin('g2', layer2Id)];
      expect(getGridBins(gridOnly)).toHaveLength(2);
    });
  });

  describe('getStagingBins', () => {
    it('should return only staging bins', () => {
      const result = getStagingBins(bins);
      expect(result).toHaveLength(2);
      expect(result.every((b) => b.layerId === STAGING_ID)).toBe(true);
      expect(result.map((b) => b.id)).toEqual(['bin4', 'bin5']);
    });

    it('should return empty array when no staging bins', () => {
      const gridOnly = [createBin('g1', layer1Id), createBin('g2', layer2Id)];
      expect(getStagingBins(gridOnly)).toEqual([]);
    });
  });

  describe('getLayerBins', () => {
    it('should return bins on specific layer excluding staging', () => {
      const result = getLayerBins(bins, layer1Id);
      expect(result).toHaveLength(2);
      expect(result.map((b) => b.id)).toEqual(['bin1', 'bin2']);
    });

    it('should return empty array for STAGING_ID layer', () => {
      // Even if layerId === STAGING_ID, the function excludes staging
      const result = getLayerBins(bins, STAGING_ID);
      expect(result).toEqual([]);
    });

    it('should return empty array for non-existent layer', () => {
      const result = getLayerBins(bins, 'non-existent');
      expect(result).toEqual([]);
    });
  });

  describe('splitBinsByLocation', () => {
    it('should split bins into grid and staging groups', () => {
      const { gridBins, stagingBins } = splitBinsByLocation(bins);
      expect(gridBins).toHaveLength(3);
      expect(stagingBins).toHaveLength(2);
      expect(gridBins.map((b) => b.id)).toEqual(['bin1', 'bin2', 'bin3']);
      expect(stagingBins.map((b) => b.id)).toEqual(['bin4', 'bin5']);
    });

    it('should handle all staging bins', () => {
      const allStaging = [createBin('s1', STAGING_ID), createBin('s2', STAGING_ID)];
      const { gridBins, stagingBins } = splitBinsByLocation(allStaging);
      expect(gridBins).toEqual([]);
      expect(stagingBins).toHaveLength(2);
    });

    it('should handle all grid bins', () => {
      const allGrid = [createBin('g1', layer1Id), createBin('g2', layer2Id)];
      const { gridBins, stagingBins } = splitBinsByLocation(allGrid);
      expect(gridBins).toHaveLength(2);
      expect(stagingBins).toEqual([]);
    });

    it('should handle empty array', () => {
      const { gridBins, stagingBins } = splitBinsByLocation([]);
      expect(gridBins).toEqual([]);
      expect(stagingBins).toEqual([]);
    });
  });

  describe('getVisibleBins', () => {
    it('should return all grid bins by default', () => {
      const result = getVisibleBins(bins);
      expect(result).toHaveLength(3);
      expect(result.every((b) => b.layerId !== STAGING_ID)).toBe(true);
    });

    it('should filter by layerIds when provided', () => {
      const result = getVisibleBins(bins, { layerIds: [layer1Id] });
      expect(result).toHaveLength(2);
      expect(result.map((b) => b.id)).toEqual(['bin1', 'bin2']);
    });

    it('should exclude staging even if STAGING_ID is in layerIds', () => {
      const result = getVisibleBins(bins, { layerIds: [layer1Id, STAGING_ID] });
      expect(result).toHaveLength(2);
      expect(result.map((b) => b.id)).toEqual(['bin1', 'bin2']);
    });

    it('should include staging with includeStaging option', () => {
      const result = getVisibleBins(bins, { includeStaging: true });
      expect(result).toHaveLength(5);
    });

    it('should return only staging bins when includeStaging and layerIds=[STAGING_ID]', () => {
      const result = getVisibleBins(bins, {
        includeStaging: true,
        layerIds: [STAGING_ID],
      });
      expect(result).toHaveLength(2);
      expect(result.map((b) => b.id)).toEqual(['bin4', 'bin5']);
    });

    it('should filter by multiple layers', () => {
      const result = getVisibleBins(bins, { layerIds: [layer1Id, layer2Id] });
      expect(result).toHaveLength(3);
      expect(result.map((b) => b.id)).toEqual(['bin1', 'bin2', 'bin3']);
    });

    it('should return empty array when layerIds is empty', () => {
      const result = getVisibleBins(bins, { layerIds: [] });
      expect(result).toEqual([]);
    });

    it('should include staging when includeStaging and layerIds includes both grid and staging', () => {
      const result = getVisibleBins(bins, {
        includeStaging: true,
        layerIds: [layer1Id, STAGING_ID],
      });
      expect(result).toHaveLength(4);
      expect(result.map((b) => b.id)).toEqual(['bin1', 'bin2', 'bin4', 'bin5']);
    });
  });
});

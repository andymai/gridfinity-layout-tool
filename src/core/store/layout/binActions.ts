import type { Bin, BinId, GridUnits, LayerId } from '@/core/types';
import type { Result, LayoutError, ValidationError } from '@/core/result';
import { ok, err, OK, isOk, validationInvalidLayer } from '@/core/result';
import { generateBinId, STAGING_ID } from '@/core/constants';
import { canPlaceBin } from '@/shared/utils/validation';
import { trackBinCreated } from '@/shared/analytics/posthog';
import { requireBin, toPlacementError } from './helpers';
import type { SetLocal, GetState } from './types';

export function createBinActions(setLocal: SetLocal, get: GetState) {
  return {
    addBin: (binData: Omit<Bin, 'id'>): Result<BinId, ValidationError> => {
      const { layout } = get();
      const id = generateBinId();
      const bin: Bin = { ...binData, id };

      if (bin.layerId !== STAGING_ID) {
        const layer = layout.layers.find((l) => l.id === bin.layerId);
        if (!layer) {
          return err(validationInvalidLayer(bin.layerId));
        }

        const rect = { x: bin.x, y: bin.y, width: bin.width, depth: bin.depth };
        const validationResult = canPlaceBin({ ...rect, height: bin.height }, bin.layerId, layout);
        if (!validationResult.valid) {
          return err(toPlacementError(validationResult.reason, rect));
        }
      }

      setLocal((state) => {
        state.layout.bins.push(bin);
      });

      return ok(id);
    },

    updateBin: (id: BinId, updates: Partial<Bin>): Result<void, LayoutError | ValidationError> => {
      const { layout } = get();
      const found = requireBin(layout.bins, id, 'updateBin');
      if (!isOk(found)) return found;
      const bin = found.value;

      // Strip id to prevent identity corruption
      const { id: _stripId, ...safeUpdates } = updates;

      // Validate placement when spatial properties change for on-grid bins
      const merged = { ...bin, ...safeUpdates };
      if (
        merged.layerId !== STAGING_ID &&
        (updates.x !== undefined ||
          updates.y !== undefined ||
          updates.width !== undefined ||
          updates.depth !== undefined ||
          updates.layerId !== undefined)
      ) {
        const rect = { x: merged.x, y: merged.y, width: merged.width, depth: merged.depth };
        const validationResult = canPlaceBin(
          { ...rect, height: merged.height },
          merged.layerId,
          layout,
          id
        );
        if (!validationResult.valid) {
          return err(toPlacementError(validationResult.reason, rect));
        }
      }

      setLocal((state) => {
        const b = state.layout.bins.find((b) => b.id === id);
        if (b) Object.assign(b, safeUpdates);
      });

      return OK;
    },

    deleteBin: (id: BinId): Result<void, LayoutError> => {
      const { layout } = get();
      const found = requireBin(layout.bins, id, 'deleteBin');
      if (!isOk(found)) return found;

      setLocal((state) => {
        state.layout.bins = state.layout.bins.filter((b) => b.id !== id);
      });

      return OK;
    },

    deleteBins: (ids: BinId[]): Result<void, LayoutError> => {
      if (ids.length === 0) {
        return OK;
      }

      setLocal((state) => {
        const idsSet = new Set(ids);
        state.layout.bins = state.layout.bins.filter((b) => !idsSet.has(b.id));
      });

      return OK;
    },

    duplicateBin: (id: BinId): Result<BinId, ValidationError | LayoutError> => {
      const { layout, addBin } = get();
      const found = requireBin(layout.bins, id, 'duplicateBin');
      if (!isOk(found)) return found;
      const bin = found.value;

      const copyAt = (layerId: LayerId, x: GridUnits, y: GridUnits) => ({
        width: bin.width,
        depth: bin.depth,
        height: bin.height,
        clearanceHeight: bin.clearanceHeight,
        category: bin.category,
        label: bin.label,
        notes: bin.notes,
        customProperties: bin.customProperties,
        layerId,
        x,
        y,
      });

      const addAndTrack = (layerId: LayerId, x: GridUnits, y: GridUnits) => {
        const result = addBin(copyAt(layerId, x, y));
        if (isOk(result)) {
          trackBinCreated({
            method: 'duplicate',
            count: 1,
            width: bin.width,
            depth: bin.depth,
            height: bin.height,
          });
        }
        return result;
      };

      if (bin.layerId === STAGING_ID) {
        return addAndTrack(STAGING_ID, 0 as GridUnits, 0 as GridUnits);
      }

      const offsets: Array<{ dx: number; dy: number }> = [
        { dx: bin.width, dy: 0 }, // right
        { dx: 0, dy: -(bin.depth as number) }, // below (y decreases going down visually)
        { dx: -(bin.width as number), dy: 0 }, // left
        { dx: 0, dy: bin.depth }, // above
      ];

      for (const { dx, dy } of offsets) {
        const placement = canPlaceBin(
          {
            x: (bin.x + dx) as GridUnits,
            y: (bin.y + dy) as GridUnits,
            width: bin.width,
            depth: bin.depth,
            height: bin.height,
          },
          bin.layerId,
          layout
        );
        if (placement.valid) {
          return addAndTrack(bin.layerId, (bin.x + dx) as GridUnits, (bin.y + dy) as GridUnits);
        }
      }

      return addAndTrack(STAGING_ID, 0 as GridUnits, 0 as GridUnits);
    },

    moveBinToStaging: (id: BinId): Result<void, LayoutError> => {
      const { layout } = get();
      const found = requireBin(layout.bins, id, 'moveBinToStaging');
      if (!isOk(found)) return found;

      setLocal((state) => {
        const b = state.layout.bins.find((b) => b.id === id);
        if (b) b.layerId = STAGING_ID;
      });

      return OK;
    },

    moveBinFromStaging: (
      id: BinId,
      layerId: LayerId,
      x: number,
      y: number
    ): Result<void, ValidationError | LayoutError> => {
      const { layout } = get();
      const found = requireBin(layout.bins, id, 'moveBinFromStaging');
      if (!isOk(found)) return found;
      const bin = found.value;

      const layer = layout.layers.find((l) => l.id === layerId);
      if (!layer) {
        return err(validationInvalidLayer(layerId));
      }

      const rect = { x: x as GridUnits, y: y as GridUnits, width: bin.width, depth: bin.depth };
      const validationResult = canPlaceBin({ ...rect, height: layer.height }, layerId, layout, id);
      if (!validationResult.valid) {
        return err(toPlacementError(validationResult.reason, rect));
      }

      setLocal((state) => {
        const b = state.layout.bins.find((b) => b.id === id);
        if (b) {
          b.layerId = layerId;
          b.x = x as GridUnits;
          b.y = y as GridUnits;
          b.height = layer.height;
        }
      });

      return OK;
    },
  };
}

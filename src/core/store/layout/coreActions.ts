import type {
  Layout,
  StoredBaseplateParams,
  LayoutId,
  GridUnits,
  MagnetAnchor,
  Mm,
  BaseplateDesignId,
} from '@/core/types';
import { CONSTRAINTS } from '@/core/constants';
import { migrateBaseplateParams } from '@/core/baseplateDefaults';
import { clamp } from '@/shared/utils/validation';
import { GRID_PITCH_MM_MAX, gridPitchFloors } from '@/shared/utils/drawerOutline';
import type { EditSource, SetLocal, ImmerSet, GetState } from './types';

export function createCoreActions(setLocal: SetLocal, set: ImmerSet, _get: GetState) {
  return {
    importLayout: (newLayout: Layout, layoutId?: LayoutId, source: EditSource = 'local'): void => {
      set((state) => {
        state.layout = newLayout;
        // Migrate old baseplateParams format (paddingMm → ratio-based) on load
        if (newLayout.baseplateParams) {
          state.layout.baseplateParams = migrateBaseplateParams(newLayout.baseplateParams);
        }
        state.activeLayoutId = layoutId ?? null;
        state.lastEditSource = source;
      });
    },

    setActiveLayoutId: (id: LayoutId | null): void => {
      set((state) => {
        state.activeLayoutId = id;
      });
    },

    setName: (name: string): void => {
      setLocal((state) => {
        state.layout.name = name.slice(0, CONSTRAINTS.NAME_MAX_LENGTH);
      });
    },

    setBaseplateParams: (params: StoredBaseplateParams): void => {
      setLocal((state) => {
        state.layout.baseplateParams = {
          ...params,
          paddingLeft: Math.max(0, params.paddingLeft) as Mm,
          paddingRight: Math.max(0, params.paddingRight) as Mm,
          paddingFront: Math.max(0, params.paddingFront) as Mm,
          paddingBack: Math.max(0, params.paddingBack) as Mm,
          magnetDiameter: clamp(params.magnetDiameter, 0.5, 20) as Mm,
          magnetDepth: clamp(params.magnetDepth, 0.5, 10) as Mm,
          ...(params.baseplateWidth !== undefined
            ? { baseplateWidth: clamp(params.baseplateWidth, 0.5, 50) as GridUnits }
            : {}),
          ...(params.baseplateDepth !== undefined
            ? { baseplateDepth: clamp(params.baseplateDepth, 0.5, 50) as GridUnits }
            : {}),
        };
      });
    },

    setActiveBaseplateLocal: (
      designId: BaseplateDesignId | null,
      params: StoredBaseplateParams
    ): void => {
      setLocal((state) => {
        state.layout.activeBaseplateId = designId;
        state.layout.baseplateParams = params;
      });
    },

    setPrintBedSize: (size: number, depth?: number): void => {
      setLocal((state) => {
        state.layout.printBedSize = clamp(
          size,
          CONSTRAINTS.PRINT_BED_MM_MIN,
          CONSTRAINTS.PRINT_BED_MM_MAX
        ) as Mm;
        state.layout.printBedDepth =
          depth !== undefined
            ? (clamp(depth, CONSTRAINTS.PRINT_BED_MM_MIN, CONSTRAINTS.PRINT_BED_MM_MAX) as Mm)
            : undefined;
      });
    },

    // With a custom outline active the pitch floors rise so the mm extent
    // keeps containing the shape — same rule as the CQRS commands.
    setGridUnitMm: (mm: number): void => {
      setLocal((state) => {
        const floorX = gridPitchFloors(state.layout).x;
        state.layout.gridUnitMm = clamp(mm, floorX, GRID_PITCH_MM_MAX) as Mm;
      });
    },

    setGridUnitMmY: (mm: number | null): void => {
      setLocal((state) => {
        const floorY = gridPitchFloors(state.layout).y;
        if (mm === null) {
          // Clearing to a square grid is refused when the square pitch would
          // leave the shape overhanging (the normalizer would clip it).
          if ((state.layout.gridUnitMm as number) < floorY) return;
          state.layout.gridUnitMmY = undefined;
          return;
        }
        state.layout.gridUnitMmY = clamp(mm, floorY, GRID_PITCH_MM_MAX) as Mm;
      });
    },

    setMagnetAnchor: (anchor: MagnetAnchor): void => {
      setLocal((state) => {
        state.layout.magnetAnchor = anchor;
      });
    },

    setHeightUnitMm: (mm: number): void => {
      setLocal((state) => {
        state.layout.heightUnitMm = clamp(mm, 1, 50) as Mm;
      });
    },

    restoreLayout: (layout: Layout): void => {
      set((state) => {
        state.layout = layout;
        state.lastEditSource = 'local';
      });
    },
  };
}

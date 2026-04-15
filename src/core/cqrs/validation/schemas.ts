/**
 * Zod Schemas for Command Payload Validation
 *
 * Maps each command type to a Zod schema that validates the payload shape
 * and basic bounds. Uses constraints from core constants for consistency.
 *
 * These schemas validate structure and ranges — business rules (e.g., collision
 * detection, layer existence) are handled by command handlers.
 */

import * as z from 'zod';
import { CONSTRAINTS } from '@/core/constants';
import type { CommandType } from '../commands';
import {
  libraryCreateEntrySchema,
  libraryDeleteEntrySchema,
  libraryDuplicateEntrySchema,
  librarySwitchActiveSchema,
  libraryUpdateEntrySchema,
  librarySetAuthorNameSchema,
  librarySetCloudShareSchema,
  libraryClearCloudShareSchema,
  libraryRenameEntrySchema,
  libraryImportLayoutSchema,
} from './librarySchemas';
import { designerSaveSchema } from './designerSchemas';
/** Branded string IDs are strings at runtime */
const binIdSchema = z.string().min(1);
const layerIdSchema = z.string().min(1);
const categoryIdSchema = z.string().min(1);

/** Grid coordinate (>= 0, supports half-bin 0.5 increments) */
const gridCoord = z.number().min(0);

/** Grid dimension (> 0, supports half-bin 0.5 increments) */
const gridDim = z.number().gt(0).max(CONSTRAINTS.GRID_MAX);

/** Height in height units (>= MIN_BIN_HEIGHT) */
const heightDim = z.number().min(CONSTRAINTS.MIN_BIN_HEIGHT);

/** Drawer dimension (grid units, 0.5-50) */
const drawerDim = z.number().min(CONSTRAINTS.GRID_MIN).max(CONSTRAINTS.GRID_MAX);

/** Label string (max 24 chars) */
const labelStr = z.string().max(CONSTRAINTS.LABEL_MAX_LENGTH);

/** Notes string (max 256 chars) */
const notesStr = z.string().max(CONSTRAINTS.NOTES_MAX_LENGTH);

/** Name string (max 64 chars, non-empty) */
const nameStr = z.string().min(1).max(CONSTRAINTS.NAME_MAX_LENGTH);

/** Hex color string (#RRGGBB format) */
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

/** Positive number (for mm values) */
const positiveMm = z.number().gt(0);
/** bin.add: Omit<Bin, 'id'> */
const binAddSchema = z.object({
  layerId: layerIdSchema,
  x: gridCoord,
  y: gridCoord,
  width: gridDim,
  depth: gridDim,
  height: heightDim,
  clearanceHeight: z.number().min(0).optional(),
  category: categoryIdSchema,
  label: labelStr,
  notes: notesStr,
  customProperties: z.record(z.string(), z.string()).optional(),
  linkedDesignId: z.string().optional(),
});

/** Partial bin fields for updates */
const binPartialSchema = z
  .object({
    layerId: layerIdSchema,
    x: gridCoord,
    y: gridCoord,
    width: gridDim,
    depth: gridDim,
    height: heightDim,
    clearanceHeight: z.number().min(0),
    category: categoryIdSchema,
    label: labelStr,
    notes: notesStr,
    customProperties: z.record(z.string(), z.string()),
    linkedDesignId: z.string(),
    id: binIdSchema,
  })
  .partial();

/** bin.update */
const binUpdateSchema = z.object({
  id: binIdSchema,
  updates: binPartialSchema,
});

/** bin.delete */
const binDeleteSchema = z.object({ id: binIdSchema });

/** bin.deleteBatch */
const binDeleteBatchSchema = z.object({
  ids: z.array(binIdSchema).min(1),
});

/** bin.duplicate */
const binDuplicateSchema = z.object({ id: binIdSchema });

/** bin.moveToStaging */
const binMoveToStagingSchema = z.object({ id: binIdSchema });

/** bin.moveFromStaging */
const binMoveFromStagingSchema = z.object({
  id: binIdSchema,
  layerId: layerIdSchema,
  x: z.number().min(0),
  y: z.number().min(0),
});

/** bin.fillLayer */
const binFillLayerSchema = z.object({
  layerId: layerIdSchema,
  width: gridDim,
  depth: gridDim,
  categoryId: categoryIdSchema,
  halfBinMode: z.boolean().optional(),
});

/** bin.fillGaps */
const binFillGapsSchema = z.object({
  layerId: layerIdSchema,
  categoryId: categoryIdSchema,
  halfBinMode: z.boolean().optional(),
});

/** bin.clearLayer */
const binClearLayerSchema = z.object({ layerId: layerIdSchema });
/** layer.add: empty payload */
const layerAddSchema = z.object({});

/** Partial layer fields for updates */
const layerPartialSchema = z
  .object({
    name: labelStr,
    height: z.number().min(CONSTRAINTS.MIN_LAYER_HEIGHT),
    id: layerIdSchema,
  })
  .partial();

/** layer.update */
const layerUpdateSchema = z.object({
  id: layerIdSchema,
  updates: layerPartialSchema,
});

/** layer.delete */
const layerDeleteSchema = z.object({ id: layerIdSchema });

/** layer.reorder */
const layerReorderSchema = z.object({
  fromIndex: z.number().int().min(0),
  toIndex: z.number().int().min(0),
});
/** category.add: Omit<Category, 'id'> */
const categoryAddSchema = z.object({
  name: labelStr.min(1),
  color: hexColor,
});

/** Partial category fields for updates */
const categoryPartialSchema = z
  .object({
    name: labelStr.min(1),
    color: hexColor,
    id: categoryIdSchema,
  })
  .partial();

/** category.update */
const categoryUpdateSchema = z.object({
  id: categoryIdSchema,
  updates: categoryPartialSchema,
});

/** category.delete */
const categoryDeleteSchema = z.object({ id: categoryIdSchema });
/** drawer.update: Partial<Drawer> */
const drawerUpdateSchema = z
  .object({
    width: drawerDim,
    depth: drawerDim,
    height: z.number().min(CONSTRAINTS.MIN_LAYER_HEIGHT),
    fractionalEdgeX: z.union([z.literal('start'), z.literal('end')]),
    fractionalEdgeY: z.union([z.literal('start'), z.literal('end')]),
  })
  .partial();

/** layout.setName */
const layoutSetNameSchema = z.object({ name: nameStr });

/** layout.setPrintBedSize */
const layoutSetPrintBedSizeSchema = z.object({ size: positiveMm, depth: positiveMm.optional() });

/** layout.setGridUnitMm */
const layoutSetGridUnitMmSchema = z.object({ mm: positiveMm });

/** layout.setHeightUnitMm */
const layoutSetHeightUnitMmSchema = z.object({ mm: positiveMm });

/** Baseplate params schema */
const baseplateParamsSchema = z.object({
  magnetHoles: z.boolean(),
  magnetDiameter: z.number().min(0.5).max(20),
  magnetDepth: z.number().min(0.5).max(10),
  paddingLeft: z.number().min(0).max(100),
  paddingRight: z.number().min(0).max(100),
  paddingFront: z.number().min(0).max(100),
  paddingBack: z.number().min(0).max(100),
  connectorNubs: z.boolean().optional(),
  invertDovetails: z.boolean().optional(),
  syncWithLayout: z.boolean().optional(),
  baseplateWidth: z.number().min(CONSTRAINTS.GRID_MIN).max(CONSTRAINTS.GRID_MAX).optional(),
  baseplateDepth: z.number().min(CONSTRAINTS.GRID_MIN).max(CONSTRAINTS.GRID_MAX).optional(),
});

/** layout.setBaseplateParams */
const layoutSetBaseplateParamsSchema = z.object({ params: baseplateParamsSchema });
/**
 * Maps command type strings to their payload Zod schemas.
 * UI and restore commands are excluded (validation=false in their middleware profiles).
 */
export const COMMAND_SCHEMAS: Readonly<Partial<Record<CommandType, z.ZodType>>> = {
  // Bin commands (9)
  'bin.add': binAddSchema,
  'bin.update': binUpdateSchema,
  'bin.delete': binDeleteSchema,
  'bin.deleteBatch': binDeleteBatchSchema,
  'bin.duplicate': binDuplicateSchema,
  'bin.moveToStaging': binMoveToStagingSchema,
  'bin.moveFromStaging': binMoveFromStagingSchema,
  'bin.fillLayer': binFillLayerSchema,
  'bin.fillGaps': binFillGapsSchema,
  'bin.clearLayer': binClearLayerSchema,

  // Layer commands (4)
  'layer.add': layerAddSchema,
  'layer.update': layerUpdateSchema,
  'layer.delete': layerDeleteSchema,
  'layer.reorder': layerReorderSchema,

  // Category commands (3)
  'category.add': categoryAddSchema,
  'category.update': categoryUpdateSchema,
  'category.delete': categoryDeleteSchema,

  // Drawer/layout commands (6)
  'drawer.update': drawerUpdateSchema,
  'layout.setName': layoutSetNameSchema,
  'layout.setPrintBedSize': layoutSetPrintBedSizeSchema,
  'layout.setGridUnitMm': layoutSetGridUnitMmSchema,
  'layout.setHeightUnitMm': layoutSetHeightUnitMmSchema,
  'layout.setBaseplateParams': layoutSetBaseplateParamsSchema,

  // Library commands (10)
  'library.createEntry': libraryCreateEntrySchema,
  'library.deleteEntry': libraryDeleteEntrySchema,
  'library.duplicateEntry': libraryDuplicateEntrySchema,
  'library.switchActive': librarySwitchActiveSchema,
  'library.updateEntry': libraryUpdateEntrySchema,
  'library.setAuthorName': librarySetAuthorNameSchema,
  'library.setCloudShare': librarySetCloudShareSchema,
  'library.clearCloudShare': libraryClearCloudShareSchema,
  'library.renameEntry': libraryRenameEntrySchema,
  'library.importLayout': libraryImportLayoutSchema,

  // Designer commands (1)
  'designer.save': designerSaveSchema,
};

/**
 * Look up the Zod schema for a given command type.
 * Returns undefined for unregistered command types (forward-compatible).
 */
export function getCommandSchema(commandType: string): z.ZodType | undefined {
  return COMMAND_SCHEMAS[commandType as CommandType];
}

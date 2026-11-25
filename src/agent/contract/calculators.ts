import { z } from 'zod';
import { CONSTRAINTS } from '@/core/constants';

const halfStep = (value: number): boolean => Number.isInteger(value * 2);
const gridSize = (max: number) =>
  z.number().min(0.5).max(max).refine(halfStep, 'Use whole or half grid units.');

export const splitPlanInput = z
  .object({
    grid: z
      .object({ width: gridSize(CONSTRAINTS.GRID_MAX), depth: gridSize(CONSTRAINTS.GRID_MAX) })
      .strict()
      .describe('The baseplate grid in units of 42 mm, whole or half.'),
    bed: z
      .object({
        width: z.number().positive(),
        depth: z.number().positive().optional(),
        unit: z.enum(['mm', 'cm', 'in']),
      })
      .strict()
      .describe('The print bed. Without a depth, the bed is square.'),
  })
  .strict();
export type SplitPlanInput = z.infer<typeof splitPlanInput>;

export const binSizeForInput = z
  .object({
    labels: z
      .array(z.string().trim().min(1).max(CONSTRAINTS.LABEL_MAX_LENGTH))
      .min(1)
      .max(20)
      .describe('What each bin holds, as a maker would label it, such as "M3 screws".'),
  })
  .strict();
export type BinSizeForInput = z.infer<typeof binSizeForInput>;

export const printEstimateInput = z
  .object({
    bins: z
      .array(
        z
          .object({
            label: z.string().trim().min(1).max(CONSTRAINTS.LABEL_MAX_LENGTH).optional(),
            width: gridSize(16).describe('Width in grid units of 42 mm, whole or half.'),
            depth: gridSize(16).describe('Depth in grid units of 42 mm, whole or half.'),
            height: z.number().int().min(2).max(50).describe('In height units of 7 mm.'),
            count: z
              .number()
              .int()
              .min(1)
              .max(60)
              .optional()
              .describe('How many of this bin. Default 1.'),
          })
          .strict()
      )
      .min(1)
      .max(60),
    printer: z
      .object({
        nozzleMm: z.number().min(0.1).max(2),
        layerHeightMm: z.number().min(0.04).max(1),
        infillPercent: z.number().min(0).max(100),
        filamentCostPerKg: z.number().min(0).max(1000),
      })
      .partial()
      .strict()
      .optional()
      .describe(
        "The reader's printer, from read_my_settings when known. The app's defaults fill gaps."
      ),
  })
  .strict();
export type PrintEstimateInput = z.infer<typeof printEstimateInput>;

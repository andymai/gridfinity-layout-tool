import { z } from 'zod';
import { CONSTRAINTS } from '@/core/constants';

export const PLAN_LIMITS = {
  BINS_MAX: 60,
  CATEGORIES_MAX: 20,
  LAYERS_MAX: 10,
  ITEMS_MAX: 20,
  HEIGHT_UNITS_MAX: 50,
} as const;

const isHalfStep = (value: number): boolean => Number.isInteger(value * 2);

const gridSize = z
  .number()
  .min(CONSTRAINTS.GRID_MIN)
  .max(CONSTRAINTS.GRID_MAX)
  .refine(isHalfStep, 'Use whole or half grid units.');

const heightUnits = z
  .number()
  .int()
  .min(CONSTRAINTS.MIN_BIN_HEIGHT)
  .max(PLAN_LIMITS.HEIGHT_UNITS_MAX);

const shortName = z.string().trim().min(1).max(CONSTRAINTS.LABEL_MAX_LENGTH);

const planBin = z
  .object({
    label: shortName,
    items: z
      .array(z.string().trim().min(1).max(CONSTRAINTS.ITEM_NAME_MAX_LENGTH))
      .max(PLAN_LIMITS.ITEMS_MAX)
      .optional(),
    width: gridSize,
    depth: gridSize,
    height: heightUnits,
    category: shortName.optional(),
    layer: z.number().int().min(1).max(PLAN_LIMITS.LAYERS_MAX).optional(),
    count: z.number().int().min(1).max(PLAN_LIMITS.BINS_MAX).optional(),
  })
  .strict();

export const planInput = z
  .object({
    title: z.string().trim().min(1).max(CONSTRAINTS.NAME_MAX_LENGTH).optional(),
    drawer: z
      .object({
        width: z.number().positive(),
        depth: z.number().positive(),
        height: z.number().positive().optional(),
        unit: z.enum(['mm', 'cm', 'in']),
      })
      .strict()
      .optional(),
    grid: z
      .object({ width: gridSize, depth: gridSize, height: heightUnits.optional() })
      .strict()
      .optional(),
    categories: z.array(shortName).min(1).max(PLAN_LIMITS.CATEGORIES_MAX).optional(),
    bins: z.array(planBin).min(1).max(PLAN_LIMITS.BINS_MAX),
  })
  .strict()
  .superRefine((plan, ctx) => {
    if ((plan.drawer === undefined) === (plan.grid === undefined)) {
      ctx.addIssue({ code: 'custom', message: 'Give either a measured drawer or a grid size.' });
    }
    const total = plan.bins.reduce((sum, bin) => sum + (bin.count ?? 1), 0);
    if (total > PLAN_LIMITS.BINS_MAX) {
      ctx.addIssue({
        code: 'custom',
        message: `A plan holds at most ${PLAN_LIMITS.BINS_MAX} bins after counts; this one has ${total}.`,
      });
    }
    const names = (plan.categories ?? []).map((name) => name.toLowerCase());
    if (new Set(names).size !== names.length) {
      ctx.addIssue({ code: 'custom', message: 'Category names must differ.' });
    }
    for (const bin of plan.bins) {
      if (bin.category !== undefined && !names.includes(bin.category.toLowerCase())) {
        ctx.addIssue({
          code: 'custom',
          message: `Bin "${bin.label}" names category "${bin.category}", which is not in categories.`,
        });
      }
    }
    const layers = new Set(plan.bins.map((bin) => bin.layer ?? 1));
    for (let layer = 1; layer <= Math.max(...layers); layer++) {
      if (!layers.has(layer)) {
        ctx.addIssue({
          code: 'custom',
          message: `Layers must be filled from 1 up; no bin is on layer ${layer}.`,
        });
      }
    }
  });

export type PlanInput = z.infer<typeof planInput>;
export type PlanBin = PlanInput['bins'][number];

import {
  CATEGORY_COLOR_PALETTE,
  CONSTRAINTS,
  DEFAULT_CATEGORIES,
  STAGING_ID,
} from '@/core/constants';
import { err, isOk, ok, validationImportFailed } from '@/core/result';
import type { Result, ValidationError } from '@/core/result';
import { binId, categoryId, gridUnits, heightUnits, layerId, mm } from '@/core/types';
import type { Bin, Category, Layer, LayerId, Layout } from '@/core/types';
import { buildDrawerLinkLayout } from '@/shared/utils/drawerLink';
import { findFirstFit } from '@/shared/utils/findFirstFit';
import type { FitRect } from '@/shared/utils/findFirstFit';
import { findUnevenlySupported, resolveRestingStack } from '@/shared/utils/restingStack';
import type { PlanBin, PlanInput } from './planInput';

const GRID_UNIT_MM = 42;
const HEIGHT_UNIT_MM = 7;
const DEFAULT_DRAWER_HEIGHT = 12;
const DEFAULT_TITLE = 'Drawer plan';
const MM_PER_UNIT = { mm: 1, cm: 10, in: 25.4 } as const;

export type StashReason = 'too-tall' | 'no-room' | 'no-support';

export interface PlannedBin {
  readonly label: string;
  readonly layer: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly depth: number;
  readonly height: number;
  readonly category: string;
  readonly color: string;
}

export interface StashedBin {
  readonly label: string;
  readonly layer: number;
  readonly reason: StashReason;
}

export interface PlanResult {
  readonly layout: Layout;
  readonly placed: readonly PlannedBin[];
  readonly stashed: readonly StashedBin[];
  readonly half: boolean;
}

function planCategories(input: PlanInput): Category[] {
  if (input.categories === undefined)
    return DEFAULT_CATEGORIES.map((category) => ({ ...category }));
  return input.categories.map((name, index) => ({
    id: categoryId(`plan-category-${index + 1}`),
    name,
    color: CATEGORY_COLOR_PALETTE[index % CATEGORY_COLOR_PALETTE.length].color,
  }));
}

function planLayers(bins: readonly PlanBin[]): Layer[] {
  const count = Math.max(...bins.map((bin) => bin.layer ?? 1));
  return Array.from({ length: count }, (_, index) => {
    const heights = bins.filter((bin) => (bin.layer ?? 1) === index + 1).map((bin) => bin.height);
    return {
      id: layerId(`plan-layer-${index + 1}`),
      name: `Layer ${index + 1}`,
      height: heightUnits(Math.max(CONSTRAINTS.MIN_LAYER_HEIGHT, Math.min(...heights))),
    };
  });
}

const toMm = (value: number, unit: keyof typeof MM_PER_UNIT): number =>
  Math.round(value * MM_PER_UNIT[unit] * 10) / 10;

function baseLayout(input: PlanInput, categories: Category[], layers: Layer[], half: boolean) {
  const name = input.title ?? DEFAULT_TITLE;
  const base: Layout = {
    version: '1.0',
    name,
    drawer: {
      width: gridUnits(input.grid?.width ?? 1),
      depth: gridUnits(input.grid?.depth ?? 1),
      height: heightUnits(input.grid?.height ?? DEFAULT_DRAWER_HEIGHT),
    },
    printBedSize: mm(CONSTRAINTS.PRINT_BED_MM_DEFAULT),
    gridUnitMm: mm(GRID_UNIT_MM),
    heightUnitMm: mm(HEIGHT_UNIT_MM),
    categories,
    layers: layers.slice(0, 1),
    bins: [],
  };
  if (input.drawer === undefined) return ok({ ...base, layers });
  const { width, depth, height, unit } = input.drawer;
  const heightMm = height === undefined ? undefined : toMm(height, unit);
  if (
    heightMm !== undefined &&
    !(heightMm >= CONSTRAINTS.MEASURED_MM_MIN && heightMm <= CONSTRAINTS.MEASURED_MM_MAX)
  ) {
    return err(
      validationImportFailed([
        `A drawer height must be from ${CONSTRAINTS.MEASURED_MM_MIN} to ${CONSTRAINTS.MEASURED_MM_MAX} mm.`,
      ])
    );
  }
  const built = buildDrawerLinkLayout(
    base,
    {
      widthMm: toMm(width, unit),
      depthMm: toMm(depth, unit),
      ...(heightMm === undefined ? {} : { heightMm }),
    },
    name,
    { allowHalf: half }
  );
  if (!isOk(built)) return built;
  const cap = built.value.drawer.height;
  return ok({
    ...built.value,
    layers: layers.map((layer) => ({
      ...layer,
      height: heightUnits(Math.max(CONSTRAINTS.MIN_LAYER_HEIGHT, Math.min(layer.height, cap))),
    })),
  });
}

/**
 * The layout that a plan describes: the grid for the drawer, and the bins
 * placed largest first. A bin above layer 1 must rest on bins below it, which
 * is stricter than the app, where such a bin may rest on the plate. Bins that
 * do not fit go to the stash. The same input always gives the same layout, so
 * the server and the app that opens a `#plan=` link build the same thing.
 */
export function buildPlanLayout(input: PlanInput): Result<PlanResult, ValidationError> {
  const categories = planCategories(input);
  const layers = planLayers(input.bins);
  const half =
    input.bins.some((bin) => !Number.isInteger(bin.width) || !Number.isInteger(bin.depth)) ||
    (input.grid !== undefined &&
      (!Number.isInteger(input.grid.width) || !Number.isInteger(input.grid.depth)));
  const base = baseLayout(input, categories, layers, half);
  if (!isOk(base)) return base;

  const categoryOf = (bin: PlanBin): Category =>
    categories.find((c) => c.name.toLowerCase() === bin.category?.toLowerCase()) ?? categories[0];
  const expanded = input.bins.flatMap((bin) => Array.from({ length: bin.count ?? 1 }, () => bin));
  const order = expanded
    .map((bin, index) => ({ bin, index }))
    .sort(
      (a, b) =>
        (a.bin.layer ?? 1) - (b.bin.layer ?? 1) ||
        b.bin.width * b.bin.depth - a.bin.width * a.bin.depth ||
        a.index - b.index
    );

  let layout = base.value;
  const placed: PlannedBin[] = [];
  const stashed: StashedBin[] = [];
  const stash: Bin[] = [];

  for (const { bin, index } of order) {
    const layer = bin.layer ?? 1;
    const layerIdOf: LayerId = layout.layers[layer - 1].id;
    const category = categoryOf(bin);
    const id = binId(`plan-bin-${index + 1}`);
    const binAt = (rect: FitRect, on: LayerId): Bin => ({
      id,
      layerId: on,
      ...rect,
      height: heightUnits(bin.height),
      category: category.id,
      label: bin.label,
      notes: '',
      ...(bin.items?.length
        ? { items: bin.items.map((name, k) => ({ id: `item-${k + 1}`, name })) }
        : {}),
    });
    const supported = (rect: FitRect): boolean => {
      const candidate = binAt(rect, layerIdOf);
      const bins = [...layout.bins, candidate];
      const stack = resolveRestingStack(bins, layout.layers);
      const rest = stack.bins.get(id);
      return (
        rest !== undefined && rest.restsOn.length > 0 && !findUnevenlySupported(bins, stack).has(id)
      );
    };
    const step = half ? 0.5 : 1;
    const fit =
      bin.height > layout.drawer.height
        ? null
        : findFirstFit(layout, layerIdOf, bin.width, bin.depth, heightUnits(bin.height), {
            step,
            ...(layer > 1 ? { accept: supported } : {}),
          });
    if (fit === null) {
      const reason: StashReason =
        bin.height > layout.drawer.height
          ? 'too-tall'
          : layer > 1 &&
              findFirstFit(layout, layerIdOf, bin.width, bin.depth, heightUnits(bin.height), {
                step,
              }) !== null
            ? 'no-support'
            : 'no-room';
      stashed.push({ label: bin.label, layer, reason });
      stash.push(
        binAt(
          {
            x: gridUnits(0),
            y: gridUnits(0),
            width: gridUnits(bin.width),
            depth: gridUnits(bin.depth),
          },
          STAGING_ID
        )
      );
      continue;
    }
    layout = { ...layout, bins: [...layout.bins, binAt(fit, layerIdOf)] };
    placed.push({
      label: bin.label,
      layer,
      x: fit.x,
      y: fit.y,
      width: fit.width,
      depth: fit.depth,
      height: bin.height,
      category: category.name,
      color: category.color,
    });
  }

  return ok({ layout: { ...layout, bins: [...layout.bins, ...stash] }, placed, stashed, half });
}

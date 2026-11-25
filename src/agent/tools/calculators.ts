import { splitDefaultBaseplate } from '@/features/baseplate/domain';
import { estimateStandardBin } from '@/features/bin-designer/domain';
import { suggestBinSize } from '@/features/bin-recommender/domain';
import type {
  BinSizeForInput,
  PrintEstimateInput,
  SplitPlanInput,
  ToolOutput,
} from '@/agent/contract';

const GRID_UNIT_MM = 42;
const MM_PER = { mm: 1, cm: 10, in: 25.4 } as const;
const BED_MIN_MM = 42;

const round = (value: number, places = 0): number => {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
};
const size = (w: number, d: number): string => `${w} x ${d}`;
const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

function duration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** The default baseplate for a grid, split for a print bed as the baseplate generator splits it. */
export function runSplitPlan(input: SplitPlanInput): ToolOutput {
  const per = MM_PER[input.bed.unit];
  const bed = {
    width: round(input.bed.width * per, 1),
    depth: round((input.bed.depth ?? input.bed.width) * per, 1),
  };
  if (bed.width < BED_MIN_MM || bed.depth < BED_MIN_MM) {
    return {
      isError: true,
      content: `A print bed must be at least ${BED_MIN_MM} mm on each side.`,
    };
  }
  const tiling = splitDefaultBaseplate(input.grid, bed, GRID_UNIT_MM);
  const plateMm = size(input.grid.width * GRID_UNIT_MM, input.grid.depth * GRID_UNIT_MM);
  const lines = [
    `A ${size(input.grid.width, input.grid.depth)} unit baseplate (${plateMm} mm) on a ${size(bed.width, bed.depth)} mm bed, with the default plate: no padding, magnets or connectors.`,
  ];
  if (!tiling.isSplit) {
    lines.push('It prints in one piece.');
    return { isError: false, content: lines.join('\n') };
  }
  const groups = new Map<string, number>();
  for (const piece of tiling.pieces) {
    const key = size(piece.widthUnits, piece.depthUnits);
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  lines.push(
    `It splits into ${plural(tiling.pieces.length, 'piece', 'pieces')}, ${tiling.cols} across and ${tiling.rows} deep: ${[
      ...groups,
    ]
      .map(([key, n]) => `${n} of ${key} units`)
      .join(', ')}.`,
    `That is ${plural(tiling.bedLoads, 'bed load', 'bed loads')}.`
  );
  return { isError: false, content: lines.join('\n') };
}

/** The size that makers most often gave bins with each label, learned from bins drawn in the app. */
export function runBinSizeFor(input: BinSizeForInput): ToolOutput {
  const lines = input.labels.map((label) => {
    const hit = suggestBinSize(label);
    const name = JSON.stringify(label);
    if (hit === null) return `- ${name}: no common size. Size it from what it holds.`;
    const share = Math.round(hit.p * 100);
    const basis = hit.source === 'label' ? 'bins with this label' : 'bins with similar labels';
    return `- ${name}: ${size(hit.size.width, hit.size.depth)} units, ${hit.size.height}u (${share}% of ${basis}).`;
  });
  return {
    isError: false,
    content: [
      'The bin size that makers most often gave each label in the app. It is a habit, not a rule: check it against what the bin holds.',
      ...lines,
    ].join('\n'),
  };
}

/** Filament and print time for standard bins, as the bin designer estimates them. */
export function runPrintEstimate(input: PrintEstimateInput): ToolOutput {
  const settings = {
    ...(input.printer?.nozzleMm === undefined ? {} : { nozzleSizeMm: input.printer.nozzleMm }),
    ...(input.printer?.layerHeightMm === undefined
      ? {}
      : { layerHeightMm: input.printer.layerHeightMm }),
    ...(input.printer?.infillPercent === undefined
      ? {}
      : { infillPercent: input.printer.infillPercent }),
    ...(input.printer?.filamentCostPerKg === undefined
      ? {}
      : { filamentCostPerKg: input.printer.filamentCostPerKg }),
  };
  let grams = 0;
  let meters = 0;
  let minutes = 0;
  let cost = 0;
  let count = 0;
  const lines = input.bins.map((bin) => {
    const n = bin.count ?? 1;
    const each = estimateStandardBin(bin, settings);
    grams += each.gramsFilament * n;
    meters += each.metersFilament * n;
    minutes += each.printTimeMinutes * n;
    cost += each.costUSD * n;
    count += n;
    const name = bin.label === undefined ? 'bin' : JSON.stringify(bin.label);
    return `- ${n > 1 ? `${n} x ` : ''}${name} (${size(bin.width, bin.depth)} units, ${bin.height}u): ${round(each.gramsFilament)} g and ${duration(each.printTimeMinutes)}${n > 1 ? ' each' : ''}.`;
  });
  return {
    isError: false,
    content: [
      'Estimates for standard bins: the designer defaults, with a stacking lip and no dividers, magnets or patterns. Features change them. The baseplate is not included.',
      ...lines,
      `Total for ${plural(count, 'bin', 'bins')}: ${round(grams)} g, ${round(meters, 1)} m of filament, ${duration(minutes)} of printing, about $${round(cost, 2).toFixed(2)} of filament.`,
    ].join('\n'),
  };
}

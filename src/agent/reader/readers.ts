import { STAGING_ID } from '@/core/constants';
import type { PrinterSettings } from '@/core/storage/readOnly';
import type { Layout, LayoutLibrary } from '@/core/types';
import { effectiveGridUnitMmY } from '@/core/types';
import { createFootprintCellSet } from '@/shared/utils/fill';
import { drawerFrameOutline } from '@/shared/utils/outlineFrame';
import {
  READER_LIMITS,
  listMyLayoutsInput,
  readMyLayoutInput,
  readMySettingsInput,
} from '@/agent/contract';
import type {
  MyLayoutData,
  MyLayoutsData,
  MySettingsData,
  ReadMyLayoutData,
  ReaderToolName,
} from '@/agent/contract';

/**
 * Where a browser read gets the reader's data: the stores in the app, or the
 * app's saved data on the docs pages.
 */
export interface ReaderSource {
  library(): Promise<LayoutLibrary | null>;
  layout(id: string): Promise<Layout | null>;
  settings(): Promise<PrinterSettings>;
}

const clip = (text: string, max: number): string => text.slice(0, max);
const day = (ms: number | undefined): string | null =>
  ms !== undefined && Number.isFinite(ms) && ms > 0
    ? new Date(ms).toISOString().slice(0, 10)
    : null;

// The app opens the first entry when the stored active id matches none.
function activeId(library: LayoutLibrary): string | undefined {
  return library.entries.some((entry) => entry.id === library.activeLayoutId)
    ? library.activeLayoutId
    : library.entries[0]?.id;
}

export function summarizeLibrary(library: LayoutLibrary | null): MyLayoutsData {
  if (library === null) return { total: 0, layouts: [] };
  const active = activeId(library);
  const recent = [...library.entries]
    .sort((a, b) => b.modifiedAt - a.modifiedAt)
    .slice(0, READER_LIMITS.LAYOUTS);
  return {
    total: library.entries.length,
    layouts: recent.map((entry) => ({
      id: clip(entry.id, 64),
      name: clip(entry.name, 64),
      active: entry.id === active,
      grid: {
        width: entry.preview.drawerWidth,
        depth: entry.preview.drawerDepth,
        height: entry.preview.drawerHeight,
      },
      bins: entry.preview.binCount,
      layers: entry.preview.layerCount,
      modified: day(entry.modifiedAt),
    })),
  };
}

function freeCellsOnFirstLayer(layout: Layout): number {
  const first = layout.layers[0];
  const cells = Math.round(layout.drawer.width * 2) * Math.round(layout.drawer.depth * 2);
  const taken = createFootprintCellSet(layout.bins, first.id, layout, 0.5).size;
  return Math.max(0, cells - taken) / 4;
}

export function summarizeLayout(layout: Layout, modifiedAt?: number): MyLayoutData {
  const layerOf = new Map(layout.layers.map((layer, i) => [layer.id, i + 1]));
  const categoryOf = new Map(layout.categories.map((category) => [category.id, category.name]));
  const placed = layout.bins
    .filter((bin) => layerOf.has(bin.layerId))
    .map((bin) => ({ bin, layer: layerOf.get(bin.layerId) ?? 1 }))
    .sort((a, b) => a.layer - b.layer || a.bin.y - b.bin.y || a.bin.x - b.bin.x);
  const stashed = layout.bins.filter((bin) => bin.layerId === STAGING_ID);
  const measured = layout.drawer.measuredMm;
  return {
    name: clip(layout.name, 64),
    modified: day(modifiedAt),
    grid: { width: layout.drawer.width, depth: layout.drawer.depth, height: layout.drawer.height },
    pitchMm: {
      x: layout.gridUnitMm,
      y: effectiveGridUnitMmY(layout),
      height: layout.heightUnitMm,
    },
    ...(measured
      ? {
          drawerMm: {
            width: measured.width,
            depth: measured.depth,
            ...(measured.height === undefined ? {} : { height: measured.height }),
          },
        }
      : {}),
    shaped:
      drawerFrameOutline(
        layout.drawer,
        layout.baseplateParams,
        layout.gridUnitMm,
        effectiveGridUnitMmY(layout)
      ) !== undefined,
    printBedMm: { width: layout.printBedSize, depth: layout.printBedDepth ?? layout.printBedSize },
    magnets: layout.baseplateParams?.magnetHoles ?? null,
    layers: layout.layers.map((layer) => ({
      name: clip(layer.name, 24),
      height: layer.height,
      bins: placed.filter((entry) => entry.bin.layerId === layer.id).length,
    })),
    freeCells: freeCellsOnFirstLayer(layout),
    bins: placed.slice(0, READER_LIMITS.BINS).map(({ bin, layer }) => {
      const items = bin.items ?? [];
      return {
        label: clip(bin.label, 24),
        layer,
        x: bin.x,
        y: bin.y,
        width: bin.width,
        depth: bin.depth,
        height: bin.height,
        category: clip(categoryOf.get(bin.category) ?? '', 24),
        items: items.slice(0, READER_LIMITS.ITEMS_PER_BIN).map((item) => clip(item.name, 48)),
        moreItems: Math.max(0, items.length - READER_LIMITS.ITEMS_PER_BIN),
      };
    }),
    moreBins: Math.max(0, placed.length - READER_LIMITS.BINS),
    stashed: stashed.slice(0, READER_LIMITS.STASHED).map((bin) => ({
      label: clip(bin.label, 24),
      width: bin.width,
      depth: bin.depth,
      height: bin.height,
    })),
    moreStashed: Math.max(0, stashed.length - READER_LIMITS.STASHED),
  };
}

export function summarizeSettings(settings: PrinterSettings): MySettingsData {
  return {
    measureUnit: settings.measureUnit,
    printBedMm: settings.printBedMm,
    gridUnitMm: settings.gridUnitMm,
    heightUnitMm: settings.heightUnitMm,
    nozzleMm: settings.print.nozzleSizeMm,
    layerHeightMm: settings.print.layerHeightMm,
    maxPrintHeightMm: settings.print.maxPrintHeightMm,
  };
}

export type ReaderRun =
  | { readonly ok: true; readonly data: MyLayoutsData | ReadMyLayoutData | MySettingsData }
  | { readonly ok: false; readonly error: string };

/** Runs one browser read on the reader's data, for the panel to show and then send once allowed. */
export async function runReaderTool(
  source: ReaderSource,
  name: ReaderToolName,
  input: unknown
): Promise<ReaderRun> {
  if (name === 'list_my_layouts') {
    if (!listMyLayoutsInput.safeParse(input).success) return { ok: false, error: 'No input.' };
    return { ok: true, data: summarizeLibrary(await source.library()) };
  }
  if (name === 'read_my_layout') {
    const parsed = readMyLayoutInput.safeParse(input);
    if (!parsed.success) return { ok: false, error: 'Give a layoutId or nothing.' };
    const library = await source.library();
    const id = parsed.data.layoutId ?? (library === null ? undefined : activeId(library));
    const entry = library?.entries.find((candidate) => candidate.id === id);
    const layout = id === undefined || entry === undefined ? null : await source.layout(id);
    return {
      ok: true,
      data: { layout: layout === null ? null : summarizeLayout(layout, entry?.modifiedAt) },
    };
  }
  if (!readMySettingsInput.safeParse(input).success) return { ok: false, error: 'No input.' };
  return { ok: true, data: summarizeSettings(await source.settings()) };
}

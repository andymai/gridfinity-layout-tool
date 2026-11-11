/**
 * Sample layouts for docs shots, written in the layout file format
 * (docs/schemas/layout.md). The app's own importer validates each one, so a
 * format change fails the capture instead of producing a wrong picture.
 */

export interface FixtureBin {
  x: number;
  y: number;
  w: number;
  d: number;
  /** Height units. */
  h: number;
  label?: string;
  /** A category name from the layout. Defaults to the first. */
  cat?: string;
  /** Index into `layers`, bottom first. Defaults to 0. */
  layer?: number;
}

export interface FixtureLayout {
  name: string;
  width: number;
  depth: number;
  /** Drawer height in height units. */
  height: number;
  layers?: { name: string; height: number }[];
  categories?: { name: string; color: string }[];
  bins?: FixtureBin[];
  stash?: FixtureBin[];
  measuredMm?: { width: number; depth: number; height?: number };
  printBedSize?: number;
}

/** The app's five default categories. */
export const DEFAULT_CATEGORIES = [
  { name: 'Coral', color: '#f87171' },
  { name: 'Sky', color: '#38bdf8' },
  { name: 'Green', color: '#4ade80' },
  { name: 'Cloud', color: '#e2e8f0' },
  { name: 'Charcoal', color: '#334155' },
];

export const WORKSHOP_CATEGORIES = [
  { name: 'Fasteners', color: '#f87171' },
  { name: 'Hand tools', color: '#38bdf8' },
  { name: 'Electrical', color: '#4ade80' },
  { name: 'Bits', color: '#fbbf24' },
  { name: 'Spares', color: '#94a3b8' },
];

const slug = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');

export function layoutFile(f: FixtureLayout): object {
  const categories = (f.categories ?? DEFAULT_CATEGORIES).map((c) => ({
    id: `cat-${slug(c.name)}`,
    ...c,
  }));
  const layers = (f.layers ?? [{ name: 'Layer 1', height: 3 }]).map((l, i) => ({
    id: `layer-${i + 1}`,
    ...l,
  }));
  const category = (name?: string): string => {
    const found = name ? categories.find((c) => c.name === name) : categories[0];
    if (!found) throw new Error(`no category ${name ?? ''} in ${f.name}`);
    return found.id;
  };
  const bin = (b: FixtureBin, i: number, layerId: string) => ({
    id: `bin-${i + 1}`,
    layerId,
    x: b.x,
    y: b.y,
    width: b.w,
    depth: b.d,
    height: b.h,
    category: category(b.cat),
    label: b.label ?? '',
    notes: '',
  });
  const placed = (f.bins ?? []).map((b, i) => {
    const layer = layers[b.layer ?? 0];
    if (!layer) throw new Error(`no layer ${b.layer ?? 0} in ${f.name}`);
    return bin(b, i, layer.id);
  });
  const stashed = (f.stash ?? []).map((b, i) => bin(b, placed.length + i, '__staging__'));
  return {
    version: '1.0',
    name: f.name,
    drawer: {
      width: f.width,
      depth: f.depth,
      height: f.height,
      ...(f.measuredMm ? { measuredMm: f.measuredMm } : {}),
    },
    printBedSize: f.printBedSize ?? 256,
    gridUnitMm: 42,
    heightUnitMm: 7,
    categories,
    layers,
    bins: [...placed, ...stashed],
  };
}

/** A tidy workbench drawer: the default sample for layout editor shots. */
export const WORKBENCH: FixtureLayout = {
  name: 'Workbench',
  width: 9,
  depth: 7,
  height: 12,
  categories: WORKSHOP_CATEGORIES,
  layers: [{ name: 'Layer 1', height: 6 }],
  bins: [
    { x: 0, y: 0, w: 2, d: 3, h: 6, label: 'Hex keys', cat: 'Hand tools' },
    { x: 2, y: 0, w: 1, d: 1, h: 6, label: 'M3', cat: 'Fasteners' },
    { x: 3, y: 0, w: 1, d: 1, h: 6, label: 'M4', cat: 'Fasteners' },
    { x: 4, y: 0, w: 1, d: 1, h: 6, label: 'M5', cat: 'Fasteners' },
    { x: 2, y: 1, w: 3, d: 2, h: 6, label: 'Washers', cat: 'Fasteners' },
    { x: 5, y: 0, w: 4, d: 2, h: 6, label: 'Screwdrivers', cat: 'Hand tools' },
    { x: 0, y: 3, w: 3, d: 2, h: 6, label: 'Drill bits', cat: 'Bits' },
    { x: 3, y: 3, w: 2, d: 2, h: 6, label: 'Driver bits', cat: 'Bits' },
    { x: 5, y: 2, w: 2, d: 3, h: 6, label: 'Wire nuts', cat: 'Electrical' },
    { x: 7, y: 2, w: 2, d: 3, h: 6, label: 'Zip ties', cat: 'Electrical' },
    { x: 0, y: 5, w: 4, d: 2, h: 6, label: 'Tape measure', cat: 'Hand tools' },
    { x: 4, y: 5, w: 2, d: 2, h: 6, label: 'Fuses', cat: 'Spares' },
  ],
};

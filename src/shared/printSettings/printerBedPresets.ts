export interface PrinterBedPreset {
  readonly id: string;
  readonly brand: string;
  readonly model: string;
  /** Printable X extent from the maker's build volume, not the plate size */
  readonly widthMm: number;
  /** Printable Y extent */
  readonly depthMm: number;
}

// Grouped by brand: the picker renders one optgroup per consecutive run.
export const PRINTER_BED_PRESETS: readonly PrinterBedPreset[] = [
  { id: 'bambu-a1-mini', brand: 'Bambu Lab', model: 'A1 mini', widthMm: 180, depthMm: 180 },
  { id: 'bambu-a1', brand: 'Bambu Lab', model: 'A1', widthMm: 256, depthMm: 256 },
  { id: 'bambu-p1s', brand: 'Bambu Lab', model: 'P1S', widthMm: 256, depthMm: 256 },
  { id: 'bambu-p2s', brand: 'Bambu Lab', model: 'P2S', widthMm: 256, depthMm: 256 },
  { id: 'bambu-x1-carbon', brand: 'Bambu Lab', model: 'X1 Carbon', widthMm: 256, depthMm: 256 },
  // Single-nozzle volume: a one-material baseplate prints from one nozzle, and
  // the dual-nozzle volume is narrower (300 × 320).
  { id: 'bambu-h2d', brand: 'Bambu Lab', model: 'H2D', widthMm: 325, depthMm: 320 },
  { id: 'bambu-h2s', brand: 'Bambu Lab', model: 'H2S', widthMm: 340, depthMm: 320 },
  { id: 'prusa-mini-plus', brand: 'Prusa', model: 'MINI+', widthMm: 180, depthMm: 180 },
  { id: 'prusa-mk4s', brand: 'Prusa', model: 'MK4S', widthMm: 250, depthMm: 210 },
  { id: 'prusa-core-one', brand: 'Prusa', model: 'Core One', widthMm: 250, depthMm: 220 },
  { id: 'prusa-xl', brand: 'Prusa', model: 'XL', widthMm: 360, depthMm: 360 },
  {
    id: 'creality-ender-3-v3-se',
    brand: 'Creality',
    model: 'Ender-3 V3 SE',
    widthMm: 220,
    depthMm: 220,
  },
  { id: 'creality-k1c', brand: 'Creality', model: 'K1C', widthMm: 220, depthMm: 220 },
  { id: 'creality-k1-max', brand: 'Creality', model: 'K1 Max', widthMm: 300, depthMm: 300 },
  { id: 'creality-k2-plus', brand: 'Creality', model: 'K2 Plus', widthMm: 350, depthMm: 350 },
  {
    id: 'elegoo-centauri-carbon',
    brand: 'Elegoo',
    model: 'Centauri Carbon',
    widthMm: 256,
    depthMm: 256,
  },
  {
    id: 'elegoo-neptune-4-pro',
    brand: 'Elegoo',
    model: 'Neptune 4 Pro',
    widthMm: 225,
    depthMm: 225,
  },
  { id: 'anycubic-kobra-3', brand: 'Anycubic', model: 'Kobra 3', widthMm: 250, depthMm: 250 },
  { id: 'anycubic-kobra-s1', brand: 'Anycubic', model: 'Kobra S1', widthMm: 250, depthMm: 250 },
  { id: 'qidi-q1-pro', brand: 'Qidi', model: 'Q1 Pro', widthMm: 245, depthMm: 245 },
  { id: 'qidi-plus4', brand: 'Qidi', model: 'Plus4', widthMm: 305, depthMm: 305 },
];

export function findPrinterBedPreset(id: string): PrinterBedPreset | undefined {
  return PRINTER_BED_PRESETS.find((preset) => preset.id === id);
}

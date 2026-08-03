/**
 * Curated printer list for the print-report form.
 *
 * A closed list keeps the data aggregatable: free text turns "X1C", "x1
 * carbon" and "Bambu X1C" into three unrelated values, so "12 people printed
 * this, 5 on an X1C" would never be computable. The `other` escape hatch plus a
 * length-capped free-text field means nobody with an uncommon machine is locked
 * out of reporting a print.
 *
 * Labels are hardware model names, so they are NOT translated: a Prusa MK4 is a
 * Prusa MK4 in every locale. Only the "Other" option's label comes from i18n.
 *
 * Maintained by PR. Adding an id is safe; removing one is not, because stored
 * prints reference it (`printerLabel` falls back to the raw id).
 *
 * MIRROR: the id list must match `COMMUNITY_PRINTER_IDS` in
 * `api/lib/communityPrinters.ts` (api/ cannot import from src/). The
 * cross-boundary equality test in `communityPrint.test.ts` guards against drift.
 */

export interface CommunityPrinterOption {
  readonly id: string;
  readonly label: string;
}

/** The sentinel that pairs with the free-text `printerOther` field. */
export const COMMUNITY_PRINTER_OTHER = 'other';

export const COMMUNITY_PRINTERS: readonly CommunityPrinterOption[] = [
  { id: 'bambu-a1', label: 'Bambu Lab A1' },
  { id: 'bambu-a1-mini', label: 'Bambu Lab A1 mini' },
  { id: 'bambu-p1p', label: 'Bambu Lab P1P' },
  { id: 'bambu-p1s', label: 'Bambu Lab P1S' },
  { id: 'bambu-x1c', label: 'Bambu Lab X1 Carbon' },
  { id: 'bambu-h2d', label: 'Bambu Lab H2D' },
  { id: 'prusa-mk3s', label: 'Prusa MK3S+' },
  { id: 'prusa-mk4', label: 'Prusa MK4 / MK4S' },
  { id: 'prusa-mini', label: 'Prusa MINI+' },
  { id: 'prusa-xl', label: 'Prusa XL' },
  { id: 'prusa-core-one', label: 'Prusa CORE One' },
  { id: 'creality-ender3', label: 'Creality Ender 3 / Pro / V2' },
  { id: 'creality-ender3-v3', label: 'Creality Ender 3 V3' },
  { id: 'creality-k1', label: 'Creality K1 / K1 Max' },
  { id: 'creality-k2', label: 'Creality K2 Plus' },
  { id: 'elegoo-neptune4', label: 'Elegoo Neptune 4' },
  { id: 'elegoo-centauri-carbon', label: 'Elegoo Centauri Carbon' },
  { id: 'anycubic-kobra', label: 'Anycubic Kobra' },
  { id: 'sovol-sv06', label: 'Sovol SV06 / SV06 Plus' },
  { id: 'qidi-plus4', label: 'Qidi Plus4' },
  { id: 'voron-trident', label: 'Voron Trident' },
  { id: 'voron-24', label: 'Voron 2.4' },
  { id: 'ratrig-vcore', label: 'RatRig V-Core' },
  { id: COMMUNITY_PRINTER_OTHER, label: 'Other' },
] as const;

const PRINTER_LABELS = new Map(COMMUNITY_PRINTERS.map((printer) => [printer.id, printer.label]));

/**
 * Display label for a stored print's printer id. An id retired from the list
 * still renders as itself rather than vanishing, so old records stay readable.
 */
export function printerLabel(id: string): string {
  return PRINTER_LABELS.get(id) ?? id;
}

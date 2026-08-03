/**
 * Curated printer ids accepted on a print report.
 *
 * MIRROR: must match the `id` fields of `COMMUNITY_PRINTERS` in
 * `src/shared/types/communityPrinters.ts`, in order (api/ cannot import from
 * src/). That file carries the display labels and the rationale for keeping the
 * list closed; this side only needs the ids to validate. The cross-boundary
 * equality test in `src/shared/types/communityPrint.test.ts` guards the mirror.
 */

export const COMMUNITY_PRINTER_OTHER = 'other';

export const COMMUNITY_PRINTER_IDS = [
  'bambu-a1',
  'bambu-a1-mini',
  'bambu-p1p',
  'bambu-p1s',
  'bambu-x1c',
  'bambu-h2d',
  'prusa-mk3s',
  'prusa-mk4',
  'prusa-mini',
  'prusa-xl',
  'prusa-core-one',
  'creality-ender3',
  'creality-ender3-v3',
  'creality-k1',
  'creality-k2',
  'elegoo-neptune4',
  'elegoo-centauri-carbon',
  'anycubic-kobra',
  'sovol-sv06',
  'qidi-plus4',
  'voron-trident',
  'voron-24',
  'ratrig-vcore',
  COMMUNITY_PRINTER_OTHER,
] as const;

export type CommunityPrinterId = (typeof COMMUNITY_PRINTER_IDS)[number];

export function isCommunityPrinterId(value: string): value is CommunityPrinterId {
  return (COMMUNITY_PRINTER_IDS as readonly string[]).includes(value);
}

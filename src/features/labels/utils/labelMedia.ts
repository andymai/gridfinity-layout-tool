/**
 * Label printers and the media they take, in printer dots.
 *
 * The printable height is the number of head dots the printer fires across the
 * tape, which is narrower than the tape: a 12mm Brother tape prints 70 dots
 * (9.9mm). An image of exactly that many pixels maps one pixel to one dot.
 *
 * Sources: Brother's PT-E550W/P750W/P710BT raster command reference (the pin
 * table), and the open drivers niimbluelib (Niimbot), labelle (DYMO) and
 * phomemo-tools (Phomemo D30). Brother is the only vendor that publishes one.
 */

import { labelPlateWidthMm, LABEL_PLATE_WIDTHS_U } from '@/shared/constants/labelPlates';
import type { LabelPlateWidthU } from '@/shared/constants/labelPlates';
import type { LabelBox } from './planLabel';

const MM_PER_INCH = 25.4;

export type LabelPrinterId = 'brother-pt' | 'dymo-d1' | 'niimbot-d' | 'phomemo-d30';

export const LABEL_PRINTER_IDS: readonly LabelPrinterId[] = [
  'brother-pt',
  'dymo-d1',
  'niimbot-d',
  'phomemo-d30',
];

export interface LabelMedia {
  /** Stable within its printer: `12` for tape, `12x40` for a die-cut label. */
  readonly id: string;
  /** Tape width or label width across the head, in mm. */
  readonly widthMm: number;
  readonly printDots: number;
  /** Die-cut label length along the feed; tape has none. */
  readonly lengthMm?: number;
}

export interface LabelPrinter {
  readonly id: LabelPrinterId;
  readonly dpi: number;
  readonly kind: 'tape' | 'die-cut';
  readonly media: readonly LabelMedia[];
  readonly defaultMediaId: string;
}

const tape = (widthMm: number, printDots: number): LabelMedia => ({
  id: String(widthMm),
  widthMm,
  printDots,
});

/** The D-series head is 96 dots, so a wider label still prints 12mm of it. */
const dieCut96 = (widthMm: number, lengthMm: number): LabelMedia => ({
  id: `${widthMm}x${lengthMm}`,
  widthMm,
  printDots: 96,
  lengthMm,
});

export const LABEL_PRINTERS: Readonly<Record<LabelPrinterId, LabelPrinter>> = {
  'brother-pt': {
    id: 'brother-pt',
    dpi: 180,
    kind: 'tape',
    media: [tape(6, 32), tape(9, 50), tape(12, 70), tape(18, 112), tape(24, 128)],
    defaultMediaId: '12',
  },
  'dymo-d1': {
    id: 'dymo-d1',
    dpi: 180,
    kind: 'tape',
    media: [tape(6, 32), tape(9, 48), tape(12, 64), tape(19, 96)],
    defaultMediaId: '12',
  },
  'niimbot-d': {
    id: 'niimbot-d',
    dpi: 203,
    kind: 'die-cut',
    media: [
      dieCut96(12, 22),
      dieCut96(12, 40),
      dieCut96(14, 40),
      dieCut96(15, 30),
      dieCut96(15, 50),
    ],
    defaultMediaId: '12x40',
  },
  'phomemo-d30': {
    id: 'phomemo-d30',
    dpi: 203,
    kind: 'die-cut',
    media: [dieCut96(12, 40), dieCut96(14, 30)],
    defaultMediaId: '12x40',
  },
};

/** How long a tape label runs: to fit its text, or the width of a bin. */
export type TapeLength = 'fit' | LabelPlateWidthU;

export const TAPE_LENGTHS: readonly TapeLength[] = ['fit', ...LABEL_PLATE_WIDTHS_U];

export function isLabelPrinterId(value: unknown): value is LabelPrinterId {
  return (LABEL_PRINTER_IDS as readonly unknown[]).includes(value);
}

export function isTapeLength(value: unknown): value is TapeLength {
  return (TAPE_LENGTHS as readonly unknown[]).includes(value);
}

/** The printer's media with this id, or its default when the id is stale. */
export function resolveLabelMedia(printer: LabelPrinter, mediaId: string): LabelMedia {
  return (
    printer.media.find((media) => media.id === mediaId) ??
    printer.media.find((media) => media.id === printer.defaultMediaId) ??
    printer.media[0]
  );
}

/**
 * The printable box a label is planned in. A bin-width tape label is as long
 * as a swappable label plate for that bin, so the two read as one family.
 */
export function labelBoxFor(
  printer: LabelPrinter,
  media: LabelMedia,
  tapeLength: TapeLength
): LabelBox {
  const heightMm = (media.printDots / printer.dpi) * MM_PER_INCH;
  if (printer.kind === 'die-cut') return { heightMm, lengthMm: media.lengthMm ?? null };
  return { heightMm, lengthMm: tapeLength === 'fit' ? null : labelPlateWidthMm(tapeLength) };
}

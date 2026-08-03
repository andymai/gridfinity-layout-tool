/**
 * Cross-boundary equality tests for the print-report mirrors. api/ cannot
 * import from src/, so the material/verdict tuples, the printer id list and
 * every limit constant exist twice and only stay in lockstep via these tests.
 */
import { describe, expect, it } from 'vitest';

import {
  COMMUNITY_PRINT_FIT_VERDICTS as API_FIT_VERDICTS,
  COMMUNITY_PRINT_MATERIALS as API_MATERIALS,
  COMMUNITY_PRINT_MAX_PHOTOS as API_MAX_PHOTOS,
  COMMUNITY_PRINT_NOTE_MAX_LENGTH as API_NOTE_MAX_LENGTH,
  COMMUNITY_PRINT_PHOTO_MAX_BYTES as API_PHOTO_MAX_BYTES,
  COMMUNITY_PRINT_PHOTO_MAX_EDGE_PX as API_PHOTO_MAX_EDGE_PX,
  COMMUNITY_PRINT_PRINTER_OTHER_MAX_LENGTH as API_PRINTER_OTHER_MAX_LENGTH,
  COMMUNITY_PRINT_RANGES as API_RANGES,
} from '../../../api/lib/communityPrintValidation.js';
import {
  COMMUNITY_PRINTER_IDS as API_PRINTER_IDS,
  COMMUNITY_PRINTER_OTHER as API_PRINTER_OTHER,
} from '../../../api/lib/communityPrinters.js';

import {
  COMMUNITY_PRINT_FIT_VERDICTS,
  COMMUNITY_PRINT_MATERIALS,
  COMMUNITY_PRINT_MAX_PHOTOS,
  COMMUNITY_PRINT_NOTE_MAX_LENGTH,
  COMMUNITY_PRINT_PHOTO_MAX_BYTES,
  COMMUNITY_PRINT_PHOTO_MAX_EDGE_PX,
  COMMUNITY_PRINT_PRINTER_OTHER_MAX_LENGTH,
  COMMUNITY_PRINT_RANGES,
  communityPrintId,
} from './communityPrint';
import { COMMUNITY_PRINTER_OTHER, COMMUNITY_PRINTERS, printerLabel } from './communityPrinters';

describe('print vocabulary (cross-boundary mirror)', () => {
  it('materials match the api tuple exactly, including order', () => {
    expect([...COMMUNITY_PRINT_MATERIALS]).toEqual([...API_MATERIALS]);
  });

  it('fit verdicts match the api tuple exactly, including order', () => {
    expect([...COMMUNITY_PRINT_FIT_VERDICTS]).toEqual([...API_FIT_VERDICTS]);
  });

  it('printer ids match the api tuple exactly, including order', () => {
    expect(COMMUNITY_PRINTERS.map((printer) => printer.id)).toEqual([...API_PRINTER_IDS]);
  });

  it('shares the "other" sentinel across the boundary', () => {
    expect(COMMUNITY_PRINTER_OTHER).toBe(API_PRINTER_OTHER);
  });
});

describe('print limits (cross-boundary mirror)', () => {
  it('matches every scalar limit', () => {
    expect(COMMUNITY_PRINT_MAX_PHOTOS).toBe(API_MAX_PHOTOS);
    expect(COMMUNITY_PRINT_NOTE_MAX_LENGTH).toBe(API_NOTE_MAX_LENGTH);
    expect(COMMUNITY_PRINT_PRINTER_OTHER_MAX_LENGTH).toBe(API_PRINTER_OTHER_MAX_LENGTH);
    expect(COMMUNITY_PRINT_PHOTO_MAX_EDGE_PX).toBe(API_PHOTO_MAX_EDGE_PX);
    expect(COMMUNITY_PRINT_PHOTO_MAX_BYTES).toBe(API_PHOTO_MAX_BYTES);
  });

  it('matches every numeric range', () => {
    expect(COMMUNITY_PRINT_RANGES).toEqual(API_RANGES);
  });
});

describe('printer list hygiene', () => {
  it('has no duplicate ids', () => {
    const ids = COMMUNITY_PRINTERS.map((printer) => printer.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('ends with the "other" escape hatch so the picker can render it last', () => {
    expect(COMMUNITY_PRINTERS[COMMUNITY_PRINTERS.length - 1].id).toBe(COMMUNITY_PRINTER_OTHER);
  });

  it('renders a retired id as itself rather than dropping it', () => {
    expect(printerLabel('bambu-x1c')).toBe('Bambu Lab X1 Carbon');
    expect(printerLabel('some-retired-id')).toBe('some-retired-id');
  });
});

describe('communityPrintId', () => {
  it('pairs the design and author ids, matching the server response', () => {
    expect(communityPrintId('abc123def456', 'f'.repeat(32))).toBe(`abc123def456:${'f'.repeat(32)}`);
  });
});

import { describe, expect, it } from 'vitest';
import {
  LABEL_PRINTER_IDS,
  LABEL_PRINTERS,
  isLabelPrinterId,
  isTapeLength,
  labelBoxFor,
  resolveLabelMedia,
} from './labelMedia';

describe('LABEL_PRINTERS', () => {
  it('lists every printer once, each with its default media', () => {
    expect(Object.keys(LABEL_PRINTERS).sort()).toEqual([...LABEL_PRINTER_IDS].sort());
    for (const printer of Object.values(LABEL_PRINTERS)) {
      const ids = printer.media.map((media) => media.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids).toContain(printer.defaultMediaId);
      for (const media of printer.media) {
        // 96 dots at 203 dpi is 12.01mm: the head spans a 12mm label to within a dot.
        expect((media.printDots / printer.dpi) * 25.4).toBeLessThanOrEqual(media.widthMm + 0.05);
        expect(media.lengthMm !== undefined).toBe(printer.kind === 'die-cut');
      }
    }
  });
});

describe('labelBoxFor', () => {
  it('prints 70 dots of 12mm Brother tape, 9.9mm, at the length asked for', () => {
    const printer = LABEL_PRINTERS['brother-pt'];
    const media = resolveLabelMedia(printer, '12');

    expect(labelBoxFor(printer, media, 'fit')).toEqual({
      heightMm: expect.closeTo(9.88, 2) as number,
      lengthMm: null,
    });
    expect(labelBoxFor(printer, media, 1).lengthMm).toBe(36);
    expect(labelBoxFor(printer, media, 3).lengthMm).toBe(120);
  });

  it('gives a die-cut label its own length whatever the tape length says', () => {
    const printer = LABEL_PRINTERS['niimbot-d'];
    const box = labelBoxFor(printer, resolveLabelMedia(printer, '15x30'), 2);

    expect(box.lengthMm).toBe(30);
    expect(box.heightMm).toBeCloseTo(12.01, 2);
  });
});

describe('resolveLabelMedia', () => {
  it('falls back to the default media for an id the printer does not take', () => {
    expect(resolveLabelMedia(LABEL_PRINTERS['dymo-d1'], '24').id).toBe('12');
  });
});

describe('guards', () => {
  it('accept only known printers and tape lengths', () => {
    expect(isLabelPrinterId('brother-pt')).toBe(true);
    expect(isLabelPrinterId('zebra')).toBe(false);
    expect(isTapeLength('fit')).toBe(true);
    expect(isTapeLength(2)).toBe(true);
    expect(isTapeLength(4)).toBe(false);
  });
});

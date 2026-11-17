import { beforeEach, describe, expect, it, vi } from 'vitest';
import { unzipSync } from 'fflate';
import type { TypeMeasurer } from '@/shared/utils/typePlan';
import type { LabelEntry } from '../store/labelListStore';
import { LABEL_PRINTERS, resolveLabelMedia } from './labelMedia';
import type { LabelPlan } from './planLabel';
import { downloadLabels } from './downloadLabels';

const mocks = vi.hoisted(() => ({
  deliverExport: vi.fn<(blob: Blob, fileName: string) => Promise<boolean>>(),
  renderLabelPng: vi.fn<(plan: unknown, paths: unknown, dpi: number) => Promise<Uint8Array>>(),
}));

vi.mock('@/shared/exportDestination/deliverExport', () => ({
  deliverExport: mocks.deliverExport,
}));
vi.mock('./labelPng', () => ({ renderLabelPng: mocks.renderLabelPng }));

const measurer = { outline: () => null } as unknown as TypeMeasurer;
const printer = LABEL_PRINTERS['niimbot-d'];
const media = resolveLabelMedia(printer, '12x40');

function entry(id: string, name: string, copies = 1): LabelEntry {
  return { id, name, detail: '', copies };
}

function plan(printable: boolean): LabelPlan {
  return { widthMm: 40, heightMm: 12, blocks: [], problem: printable ? null : 'tooLong' };
}

beforeEach(() => {
  mocks.deliverExport.mockReset().mockResolvedValue(true);
  mocks.renderLabelPng.mockReset().mockImplementation(() => Promise.resolve(new Uint8Array([1])));
});

describe('downloadLabels', () => {
  it('saves a lone label as a PNG at the printer dpi', async () => {
    const saved = await downloadLabels(
      [entry('a', 'Hex nut', 3)],
      new Map([['a', plan(true)]]),
      measurer,
      printer,
      media
    );

    expect(saved).toBe(1);
    expect(mocks.renderLabelPng.mock.calls[0][2]).toBe(203);
    const [blob, name] = mocks.deliverExport.mock.calls[0];
    expect(name).toBe('1-hex-nut-x3.png');
    expect(blob.type).toBe('image/png');
  });

  it('zips the labels that fit and leaves the rest out', async () => {
    const saved = await downloadLabels(
      [entry('a', 'Nuts'), entry('b', 'Too long'), entry('c', 'Washers')],
      new Map([
        ['a', plan(true)],
        ['b', plan(false)],
        ['c', plan(true)],
      ]),
      measurer,
      printer,
      media
    );

    expect(saved).toBe(2);
    const [blob, name] = mocks.deliverExport.mock.calls[0];
    expect(name).toBe('labels-niimbot-d-12x40.zip');
    const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    expect(Object.keys(files)).toEqual(['1-nuts.png', '2-washers.png']);
  });

  it('reports nothing saved when the destination saved nothing', async () => {
    mocks.deliverExport.mockResolvedValue(false);
    const saved = await downloadLabels(
      [entry('a', 'Nuts')],
      new Map([['a', plan(true)]]),
      measurer,
      printer,
      media
    );
    expect(saved).toBe(0);
  });

  it('does nothing when no label fits', async () => {
    const saved = await downloadLabels(
      [entry('a', 'Nuts')],
      new Map([['a', plan(false)]]),
      measurer,
      printer,
      media
    );
    expect(saved).toBe(0);
    expect(mocks.deliverExport).not.toHaveBeenCalled();
  });
});

import { describe, expect, it } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import type { BinParams } from '@/shared/types/bin';
import { attachmentFromBase, binParamsToItem, itemToBinParams } from '@/shared/types/itemAdapter';

describe('itemAdapter', () => {
  it('round-trips DEFAULT_BIN_PARAMS to identity', () => {
    const item = binParamsToItem(DEFAULT_BIN_PARAMS);
    expect(itemToBinParams(item)).toEqual(DEFAULT_BIN_PARAMS);
  });

  it('round-trips a magnet+screw bin (attachment-derived fields survive)', () => {
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 4,
      depth: 2,
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet_and_screw' },
    };
    const item = binParamsToItem(params);
    expect(item.envelope.width).toBe(4);
    expect(item.envelope.depth).toBe(2);
    expect(item.envelope.attachment.magnetHoles).toBe(true);
    expect(item.envelope.attachment.screwHoles).toBe(true);
    expect(itemToBinParams(item)).toEqual(params);
  });

  it('hoists footprint/units/colors into the envelope, not the structure', () => {
    const item = binParamsToItem(DEFAULT_BIN_PARAMS);
    expect(item.structure.kind).toBe('bin');
    const structure = item.structure as Record<string, unknown>;
    expect(structure.width).toBeUndefined();
    expect(structure.depth).toBeUndefined();
    expect(structure.gridUnitMm).toBeUndefined();
    expect(structure.heightUnitMm).toBeUndefined();
    expect(structure.featureColors).toBeUndefined();
  });

  it('attachmentFromBase reflects the base style', () => {
    expect(attachmentFromBase({ ...DEFAULT_BIN_PARAMS.base, style: 'standard' }).magnetHoles).toBe(
      false
    );
    expect(attachmentFromBase({ ...DEFAULT_BIN_PARAMS.base, style: 'magnet' }).magnetHoles).toBe(
      true
    );
    expect(attachmentFromBase({ ...DEFAULT_BIN_PARAMS.base, style: 'screw' }).screwHoles).toBe(
      true
    );
  });

  it('itemToBinParams throws on a non-bin item', () => {
    const item = binParamsToItem(DEFAULT_BIN_PARAMS);
    const rack = { envelope: item.envelope, structure: { kind: 'toolRack' } } as never;
    expect(() => itemToBinParams(rack)).toThrow(/expected kind 'bin'/);
  });
});

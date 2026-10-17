import { describe, expect, it } from 'vitest';
import { binId, layerId, layoutId } from '@/core/types';
import { matchBins, searchField } from './matchBins';
import type { BinSearchRecord, SearchField } from './matchBins';

function record(id: string, fields: SearchField[], label = ''): BinSearchRecord {
  return {
    layoutId: layoutId('lay-1'),
    binId: binId(id),
    layerId: layerId('layer-1'),
    layerName: 'Layer 1',
    label,
    fields,
  };
}

const ids = (query: string, records: BinSearchRecord[]): string[] =>
  matchBins(query, records).map((m) => m.record.binId);

describe('matchBins', () => {
  const screws = record('screws', [searchField('item', 'M3x8 screws')]);
  const nuts = record('nuts', [searchField('label', 'M3 nuts')], 'M3 nuts');
  const drivers = record('drivers', [searchField('label', 'Screwdrivers')], 'Screwdrivers');
  const tape = record('tape', [searchField('note', 'washi tape, two rolls')]);

  it('needs every word, matching each as a word start', () => {
    expect(ids('m3 screws', [screws, nuts, drivers])).toEqual(['screws']);
    expect(ids('m3', [screws, nuts, tape])).toEqual(expect.arrayContaining(['screws', 'nuts']));
    expect(ids('crew', [screws])).toEqual([]);
  });

  it('meets singular and plural', () => {
    expect(ids('screw', [screws])).toEqual(['screws']);
    expect(ids('nut', [nuts])).toEqual(['nuts']);
  });

  it('ignores case and accents', () => {
    const cafe = record('cafe', [searchField('label', 'Café spoons')], 'Café spoons');
    expect(ids('CAFE', [cafe])).toEqual(['cafe']);
  });

  it('ranks a whole word above a prefix, and a label above a note', () => {
    const prefix = record('prefix', [searchField('label', 'Tapestry needles')], 'Tapestry needles');
    expect(ids('tape', [prefix, tape])[0]).toBe('tape');
    const labelled = record('labelled', [searchField('label', 'Tape')], 'Tape');
    expect(ids('tape', [tape, labelled])[0]).toBe('labelled');
  });

  it('keeps a whole-word note above a label prefix for a longer query too', () => {
    const driver = record('driver', [searchField('label', 'Wood screwdriver')], 'Wood screwdriver');
    const note = record('note', [searchField('note', 'wood screws, 40 mm')]);
    expect(ids('wood screw', [driver, note])).toEqual(['note', 'driver']);
  });

  it('keeps every qualifier, so a size never falls back to the bare concept', () => {
    expect(ids('M8 screws', [screws])).toEqual([]);
    expect(ids('wood screws', [screws])).toEqual([]);
  });

  it('finds a bin by the vocabulary term behind another language’s word', () => {
    expect(ids('Schrauben', [screws, tape])).toEqual(['screws']);
    const mixed = record('mixed', [searchField('label', 'screws,nuts')], 'screws,nuts');
    expect(ids('Schrauben', [mixed])).toEqual(['mixed']);
  });

  it('never reaches a concept through part of a word', () => {
    const shells = record('shells', [searchField('label', 'Snail shells')], 'Snail shells');
    expect(ids('nail', [shells])).toEqual([]);
    expect(ids('M8screws', [screws])).toEqual([]);
  });

  it('caps the list and returns nothing for an empty query', () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      record(`b${i}`, [searchField('label', `Bit ${i}`)], `Bit ${i}`)
    );
    expect(matchBins('bit', many)).toHaveLength(8);
    expect(matchBins('   ', many)).toEqual([]);
  });
});

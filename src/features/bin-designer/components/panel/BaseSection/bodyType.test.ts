import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { BinParams } from '@/features/bin-designer/types';
import { BODY_TYPES, bodyTypeParams, deriveBodyType } from './bodyType';

function withBase(patch: Partial<BinParams['base']>): BinParams {
  return { ...DEFAULT_BIN_PARAMS, base: { ...DEFAULT_BIN_PARAMS.base, ...patch } };
}

describe('deriveBodyType', () => {
  it('reads an ordinary bin as standard', () => {
    expect(deriveBodyType(DEFAULT_BIN_PARAMS.base)).toBe('standard');
  });

  it('reads each archetype off the flag that stores it', () => {
    expect(deriveBodyType(withBase({ style: 'flat' }).base)).toBe('flat');
    expect(deriveBodyType(withBase({ spacer: true }).base)).toBe('spacer');
    expect(deriveBodyType(withBase({ tile: true }).base)).toBe('tile');
    expect(deriveBodyType(withBase({ style: 'lid' }).base)).toBe('tray');
  });

  it('does not treat magnet or screw holes as an archetype', () => {
    expect(deriveBodyType(withBase({ style: 'magnet' }).base)).toBe('standard');
    expect(deriveBodyType(withBase({ style: 'magnet_and_screw' }).base)).toBe('standard');
  });

  it('reads an inert tile flag as the socketless base it actually is', () => {
    // `{ style: 'flat', tile: true }` builds a flat base. The flag has no
    // socket to stand on. Showing the base-only card would name geometry the
    // generator never produces.
    expect(deriveBodyType(withBase({ style: 'flat', tile: true }).base)).toBe('flat');
    expect(deriveBodyType(withBase({ style: 'lid', tile: true }).base)).toBe('tray');
  });
});

describe('bodyTypeParams', () => {
  it('is a no-op when the type is already selected', () => {
    const params = withBase({ spacer: true });
    expect(bodyTypeParams(params, 'spacer')).toBe(params);
  });

  it.each(BODY_TYPES)('reaches %s from every other archetype', (target) => {
    for (const from of BODY_TYPES) {
      const start = bodyTypeParams(DEFAULT_BIN_PARAMS, from);
      expect(deriveBodyType(start.base)).toBe(from);

      const next = bodyTypeParams(start, target);
      expect(deriveBodyType(next.base)).toBe(target);
    }
  });

  it('clears the outgoing archetype rather than leaving two set', () => {
    const spacer = bodyTypeParams(DEFAULT_BIN_PARAMS, 'spacer');
    const flat = bodyTypeParams(spacer, 'flat');

    expect(flat.base.spacer).toBe(false);
    expect(flat.base.style).toBe('flat');
  });

  it('returns to standard by turning the current archetype off', () => {
    const tile = bodyTypeParams(DEFAULT_BIN_PARAMS, 'tile');
    const standard = bodyTypeParams(tile, 'standard');

    expect(deriveBodyType(standard.base)).toBe('standard');
    expect(standard.base.style).toBe('standard');
  });

  it('materialises the tray mating config only while the tray is selected', () => {
    const tray = bodyTypeParams(DEFAULT_BIN_PARAMS, 'tray');
    expect(tray.base.trayBottom).toBeDefined();

    const back = bodyTypeParams(tray, 'standard');
    expect('trayBottom' in back.base).toBe(false);
  });

  it('leaves no trayBottom residue on a bin that visited the tray and left', () => {
    // The community fingerprint hashes `params` wholesale, so a round trip has
    // to be byte-identical to a bin that never made it.
    const roundTrip = bodyTypeParams(bodyTypeParams(DEFAULT_BIN_PARAMS, 'tray'), 'standard');
    expect(roundTrip.base).toEqual(
      expect.not.objectContaining({ trayBottom: expect.anything() as unknown })
    );
  });

  it('clears mounting hardware the archetype cannot hold', () => {
    const magnet = withBase({ style: 'magnet' });
    const spacer = bodyTypeParams(magnet, 'spacer');

    // A spacer has no floor to hold a magnet; the engine clears it rather than
    // leaving a setting the geometry ignores.
    expect(spacer.base.style).not.toBe('magnet');
  });
});

import { describe, it, expect } from 'vitest';
import { expectedEnvelopeDelta } from '../lib/delta';

describe('expectedEnvelopeDelta', () => {
  it('layouts: 32 + digit-count of modifiedAt', () => {
    expect(expectedEnvelopeDelta('layouts', 1_700_000_000_000)).toBe(45);
    expect(expectedEnvelopeDelta('layouts', 1_000_000_000_000)).toBe(45);
    expect(expectedEnvelopeDelta('layouts', 100_000)).toBe(38);
  });

  it('designs: 13 + digit-count of modifiedAt', () => {
    expect(expectedEnvelopeDelta('designs', 1_700_000_000_000)).toBe(26);
    expect(expectedEnvelopeDelta('designs', 100_000)).toBe(19);
  });

  it('matches actual blob/index difference for canonical layout envelope', () => {
    const layout = { drawer: { width: 5, depth: 5, height: 3 }, bins: [] };
    const modifiedAt = 1_780_000_000_000;
    const indexBody = JSON.stringify({ layout });
    const blobBody = JSON.stringify({ layout, modifiedAt, schemaVersion: 1 });
    const actual = Buffer.byteLength(blobBody) - Buffer.byteLength(indexBody);
    expect(actual).toBe(expectedEnvelopeDelta('layouts', modifiedAt));
  });

  it('matches actual blob/index difference for canonical design envelope', () => {
    const params = { width: 1, depth: 2, height: 6, base: {} };
    const name = 'My design';
    const modifiedAt = 1_780_000_000_000;
    const indexBody = JSON.stringify({ name, type: 'designer', version: 1, params });
    const blobBody = JSON.stringify({ design: { name, params }, modifiedAt, schemaVersion: 1 });
    const actual = Buffer.byteLength(blobBody) - Buffer.byteLength(indexBody);
    expect(actual).toBe(expectedEnvelopeDelta('designs', modifiedAt));
  });
});

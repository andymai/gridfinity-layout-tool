import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  MAX_DISPLAY_NAME_LENGTH,
  deriveDonorId,
  normalizeDisplayName,
  parseKofiPayload,
  readSupporters,
} from './supporters.js';

const kofiBody = (data: Record<string, unknown>) => ({ data: JSON.stringify(data) });

describe('parseKofiPayload', () => {
  it('parses the form-encoded data field', () => {
    const payload = parseKofiPayload(
      kofiBody({ verification_token: 'tok', message_id: 'm1', from_name: 'Jo' })
    );
    expect(payload).toMatchObject({ verification_token: 'tok', message_id: 'm1', from_name: 'Jo' });
  });

  it.each([
    ['no body', undefined],
    ['no data field', {}],
    ['data is not a string', { data: { verification_token: 'tok' } }],
    ['data is not JSON', { data: 'not json' }],
    ['data is a JSON scalar', { data: '"hello"' }],
    ['missing verification_token', kofiBody({ message_id: 'm1' })],
    ['missing message_id', kofiBody({ verification_token: 'tok' })],
    ['empty message_id', kofiBody({ verification_token: 'tok', message_id: '' })],
  ])('returns null for %s', (_label, body) => {
    expect(parseKofiPayload(body)).toBeNull();
  });
});

describe('deriveDonorId', () => {
  const original = process.env.TOKEN_SALT;
  beforeEach(() => {
    process.env.TOKEN_SALT = 'test-salt';
  });
  afterEach(() => {
    if (original === undefined) delete process.env.TOKEN_SALT;
    else process.env.TOKEN_SALT = original;
  });

  it('is stable for the same email', () => {
    expect(deriveDonorId('jo@example.com')).toBe(deriveDonorId('jo@example.com'));
  });

  it('ignores case and surrounding whitespace so one person maps to one bin', () => {
    expect(deriveDonorId('  JO@Example.COM ')).toBe(deriveDonorId('jo@example.com'));
  });

  it('differs between emails', () => {
    expect(deriveDonorId('jo@example.com')).not.toBe(deriveDonorId('sam@example.com'));
  });

  it('never contains the email', () => {
    const id = deriveDonorId('jo@example.com');
    expect(id).not.toContain('jo');
    expect(id).toMatch(/^[a-f0-9]{32}$/);
  });

  it('changes with the salt, so the digest is not a bare email hash', () => {
    const withTestSalt = deriveDonorId('jo@example.com');
    process.env.TOKEN_SALT = 'different-salt';
    expect(deriveDonorId('jo@example.com')).not.toBe(withTestSalt);
  });

  it('refuses to derive an id without a salt rather than emit a reversible digest', () => {
    delete process.env.TOKEN_SALT;
    expect(deriveDonorId('jo@example.com')).toBeNull();
  });
});

describe('normalizeDisplayName', () => {
  it('keeps a public name', () => {
    expect(normalizeDisplayName('Jo Example', true)).toBe('Jo Example');
  });

  it('treats an undefined is_public as public (Ko-fi omits it on some events)', () => {
    expect(normalizeDisplayName('Jo', undefined)).toBe('Jo');
  });

  it('anonymises when the supporter opted out of a public shout-out', () => {
    expect(normalizeDisplayName('Jo Example', false)).toBeNull();
  });

  it.each([
    ['blank', '   '],
    ['empty', ''],
    ['missing', null],
  ])('anonymises a %s name', (_label, name) => {
    expect(normalizeDisplayName(name, true)).toBeNull();
  });

  it('anonymises a name the content filter rejects', () => {
    expect(normalizeDisplayName('<script>alert(1)</script>', true)).toBeNull();
  });

  it('anonymises a name carrying a URL', () => {
    expect(normalizeDisplayName('buy at https://spam.example', true)).toBeNull();
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeDisplayName('  Jo  ', true)).toBe('Jo');
  });

  it('caps an overlong name rather than dropping the supporter', () => {
    const name = normalizeDisplayName('Bartholomew Cuthbert Wellington-Smythe III of Kent', true);
    expect(name).toHaveLength(MAX_DISPLAY_NAME_LENGTH);
    expect(name).toBe('Bartholomew Cuthbert Wellington-');
  });

  // The filter runs before the length cap, so character-spam anonymises rather
  // than being truncated into a tidy-looking 'aaaa…' tape.
  it('anonymises repeated-character spam instead of truncating it', () => {
    expect(normalizeDisplayName('a'.repeat(200), true)).toBeNull();
  });
});

describe('readSupporters', () => {
  const fakeRedis = (donors: Record<string, string>) =>
    ({ hgetall: async () => donors }) as unknown as Parameters<typeof readSupporters>[0];

  it('splits named from anonymous', async () => {
    const result = await readSupporters(fakeRedis({ a: 'Jo', b: '', c: 'Sam', d: '' }));
    expect(result.named.sort()).toEqual(['Jo', 'Sam']);
    expect(result.anonymousCount).toBe(2);
  });

  it('handles an empty store', async () => {
    expect(await readSupporters(fakeRedis({}))).toEqual({ named: [], anonymousCount: 0 });
  });

  it('keeps duplicate names — two people really can both be Max', async () => {
    const result = await readSupporters(fakeRedis({ a: 'Max', b: 'Max' }));
    expect(result.named).toEqual(['Max', 'Max']);
  });
});

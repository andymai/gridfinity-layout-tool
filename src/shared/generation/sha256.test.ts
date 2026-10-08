import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sha256, sha256Hex } from './sha256';

const encoder = new TextEncoder();

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function nodeSha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function pseudoRandomBytes(length: number, seed: number): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(length);
  let state = seed >>> 0;
  for (let i = 0; i < length; i++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    out[i] = state >>> 24;
  }
  return out;
}

describe('sha256 (pure JS)', () => {
  it.each([
    ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
    ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
    [
      'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq',
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    ],
  ])('matches the FIPS 180-2 vector for %j', (input, expected) => {
    expect(hex(sha256(encoder.encode(input)))).toBe(expected);
  });

  it('matches the million-a vector', () => {
    const input = new Uint8Array(1_000_000).fill(0x61);
    expect(hex(sha256(input))).toBe(
      'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0'
    );
  });

  it('matches node:crypto across every padding boundary', () => {
    for (let length = 0; length <= 200; length++) {
      const input = pseudoRandomBytes(length, length + 1);
      expect(hex(sha256(input)), `length ${length}`).toBe(nodeSha256(input));
    }
  });

  it('matches WebCrypto on a mesh-file-sized buffer', async () => {
    const input = pseudoRandomBytes(745_000, 7);
    const web = new Uint8Array(await crypto.subtle.digest('SHA-256', input));
    expect(hex(sha256(input))).toBe(hex(web));
  });

  it('hashes only the bytes a view covers', () => {
    const backing = pseudoRandomBytes(300, 3);
    const view = backing.subarray(17, 250);
    expect(hex(sha256(view))).toBe(nodeSha256(view));
  });
});

describe('sha256Hex', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('names bytes by their lowercase hex SHA-256', async () => {
    const input = pseudoRandomBytes(1000, 11);
    expect(await sha256Hex(input)).toBe(nodeSha256(input));
  });

  it('falls back to the pure-JS digest where crypto.subtle is missing', async () => {
    const input = pseudoRandomBytes(5000, 13);
    const expected = await sha256Hex(input);
    // An insecure context (plain HTTP on a LAN address) has crypto without subtle.
    vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) });
    expect(globalThis.crypto.subtle).toBeUndefined();
    expect(await sha256Hex(input)).toBe(expected);
  });
});

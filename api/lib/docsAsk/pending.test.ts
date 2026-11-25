import { describe, expect, it, vi } from 'vitest';
import type { Redis } from 'ioredis';
import { PENDING_TTL_MS, claimNonce, pendingCheck, pendingSignature } from './pending.js';

const KEY = 'pending-key';
const fields = {
  question: 'What is in my drawer?',
  page: '/layouts/layers',
  locale: 'en',
  messages: [[{ type: 'tool_use', id: 'toolu_b', name: 'read_my_layout', input: {} }]],
  results: [],
  rounds: 1,
  issuedAt: 1_000_000,
  nonce: '6f1c1a9e-8f53-4a43-9b4e-3c2a8a6d1f00',
};
const signed = { ...fields, signature: pendingSignature(KEY, fields) };

describe('the pending envelope', () => {
  it('holds for 15 minutes, and not after an edit or with another key', () => {
    expect(pendingCheck(KEY, signed, fields.issuedAt + PENDING_TTL_MS)).toBe('ok');
    expect(pendingCheck(KEY, signed, fields.issuedAt + PENDING_TTL_MS + 1)).toBe('expired');
    expect(pendingCheck(KEY, signed, fields.issuedAt - 1)).toBe('expired');
    expect(pendingCheck(KEY, { ...signed, rounds: 0 }, fields.issuedAt)).toBe('forged');
    expect(pendingCheck(KEY, { ...signed, question: 'Other?' }, fields.issuedAt)).toBe('forged');
    expect(pendingCheck('other-key', signed, fields.issuedAt)).toBe('forged');
  });

  it('claims a nonce once through Redis', async () => {
    const held = new Set<string>();
    const set = vi.fn((key: string) => {
      if (held.has(key)) return Promise.resolve(null);
      held.add(key);
      return Promise.resolve('OK');
    });
    const redis = { set } as unknown as Redis;
    expect(await claimNonce(redis, fields.nonce, true, 0)).toBe('claimed');
    expect(await claimNonce(redis, fields.nonce, true, 0)).toBe('used');
    expect(set).toHaveBeenCalledWith(`docsAsk:resume:${fields.nonce}`, '1', 'EX', 960, 'NX');
  });

  it('refuses in production without Redis, and holds nonces in memory in development', async () => {
    expect(await claimNonce(null, 'n-1', true, 0)).toBe('unavailable');
    expect(await claimNonce(null, 'n-2', false, 0)).toBe('claimed');
    expect(await claimNonce(null, 'n-2', false, 1000)).toBe('used');
    expect(await claimNonce(null, 'n-2', false, 2 * PENDING_TTL_MS)).toBe('claimed');
  });
});

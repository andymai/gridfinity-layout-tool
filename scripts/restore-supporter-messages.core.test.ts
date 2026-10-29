import { describe, it, expect } from 'vitest';
import { parseDonorRecord, serializeDonorRecord } from '../api/lib/supporters.js';
import { PREVIOUS_MESSAGE_LENGTH, planMessageRestores } from './restore-supporter-messages.core.js';
import type { TransactionRow } from './seed-supporters.core.js';

const row = (message: string, from = 'Jo'): TransactionRow => ({
  dateTime: '2026-07-01T13:04:30Z',
  from,
  message,
  received: '3.00',
  currency: 'USD',
  email: 'jo@example.com',
});

const full = `${'Thank you for building this, '.repeat(9)}it is great.`;
const cut = full.slice(0, PREVIOUS_MESSAGE_LENGTH);
const stored = (message?: string, name: string | null = 'Jo') =>
  serializeDonorRecord({ name, joinedAt: '2026-07-01T13:04:30.000Z', message });

describe('planMessageRestores', () => {
  it('restores a message the old cap cut, keeping the rest of the record', () => {
    const { restores, unmatched } = planMessageRestores({ 'donor-1': stored(cut) }, [row(full)]);
    expect(unmatched).toBe(0);
    expect(restores).toHaveLength(1);
    expect(restores[0]).toMatchObject({
      field: 'donor-1',
      storedLength: PREVIOUS_MESSAGE_LENGTH,
      restoredLength: full.length,
    });
    expect(parseDonorRecord(restores[0].value)).toEqual({
      name: 'Jo',
      joinedAt: '2026-07-01T13:04:30.000Z',
      message: full,
    });
  });

  it('restores a cut that dropped half an emoji at the cap', () => {
    const emoji = `${full.slice(0, PREVIOUS_MESSAGE_LENGTH - 1)}🎉 and many more thanks`;
    const shortened = emoji.slice(0, PREVIOUS_MESSAGE_LENGTH - 1);
    const { restores } = planMessageRestores({ 'donor-1': stored(shortened) }, [row(emoji)]);
    expect(restores.map((r) => r.restoredLength)).toEqual([emoji.length]);
  });

  it('leaves a message shorter than the old cap alone, even when it starts a longer one', () => {
    const { restores, unmatched } = planMessageRestores(
      { 'donor-1': stored('Thank you for building this') },
      [row(full)]
    );
    expect(restores).toEqual([]);
    expect(unmatched).toBe(0);
  });

  it('counts a cut with no full text, or with two, as unmatched', () => {
    const other = `${cut} but a different ending entirely.`;
    expect(planMessageRestores({ 'donor-1': stored(cut) }, []).unmatched).toBe(1);
    expect(planMessageRestores({ 'donor-1': stored(cut) }, [row(full), row(other)]).unmatched).toBe(
      1
    );
  });

  it('never restores a full text the content filter rejects', () => {
    const blocked = `${cut} visit https://spam.example`;
    const { restores, unmatched } = planMessageRestores({ 'donor-1': stored(cut) }, [row(blocked)]);
    expect(restores).toEqual([]);
    expect(unmatched).toBe(1);
  });

  it('skips anonymous records and records without a message', () => {
    const { restores, unmatched } = planMessageRestores(
      { 'anon-1': stored(undefined, null), 'donor-2': stored() },
      [row(full)]
    );
    expect(restores).toEqual([]);
    expect(unmatched).toBe(0);
  });
});

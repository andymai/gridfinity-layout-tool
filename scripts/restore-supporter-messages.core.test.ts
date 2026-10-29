import { describe, it, expect } from 'vitest';
import { parseDonorRecord, serializeDonorRecord } from '../api/lib/supporters.js';
import { PREVIOUS_MESSAGE_LENGTH, planMessageRestores } from './restore-supporter-messages.core.js';
import type { TransactionRow } from './seed-supporters.core.js';

const row = (message: string, email = 'jo@example.com', from = 'Jo'): TransactionRow => ({
  dateTime: '2026-07-01T13:04:30Z',
  from,
  message,
  received: '3.00',
  currency: 'USD',
  email,
});

const idFor = (email: string): string => `id:${email}`;
const JO = idFor('jo@example.com');

const full = `${'Thank you for building this, '.repeat(9)}it is great.`;
const cut = full.slice(0, PREVIOUS_MESSAGE_LENGTH);
const stored = (message?: string, name: string | null = 'Jo') =>
  serializeDonorRecord({ name, joinedAt: '2026-07-01T13:04:30.000Z', message });

describe('planMessageRestores', () => {
  it('restores a message the old cap cut, keeping the rest of the record', () => {
    const before = stored(cut);
    const { restores, unmatched } = planMessageRestores({ [JO]: before }, [row(full)], idFor);
    expect(unmatched).toBe(0);
    expect(restores).toHaveLength(1);
    expect(restores[0]).toMatchObject({
      field: JO,
      previous: before,
      storedLength: PREVIOUS_MESSAGE_LENGTH,
      restoredLength: full.length,
    });
    expect(parseDonorRecord(restores[0].value)).toEqual({
      name: 'Jo',
      joinedAt: '2026-07-01T13:04:30.000Z',
      message: full,
    });
  });

  it('restores a seed record from the transactions under its public name', () => {
    const { restores } = planMessageRestores(
      { 'seed:named:0': stored(cut) },
      [row(full, 'someone@example.com')],
      idFor
    );
    expect(restores.map((r) => r.restoredLength)).toEqual([full.length]);
  });

  it('restores a cut that dropped half an emoji at the cap', () => {
    const emoji = `${full.slice(0, PREVIOUS_MESSAGE_LENGTH - 1)}🎉 and many more thanks`;
    const shortened = emoji.slice(0, PREVIOUS_MESSAGE_LENGTH - 1);
    const { restores } = planMessageRestores({ [JO]: stored(shortened) }, [row(emoji)], idFor);
    expect(restores.map((r) => r.restoredLength)).toEqual([emoji.length]);
  });

  it("never takes another donor's words, even when they start the same way", () => {
    const { restores, unmatched } = planMessageRestores(
      { [JO]: stored(cut) },
      [row(full, 'bob@example.com', 'Bob')],
      idFor
    );
    expect(restores).toEqual([]);
    expect(unmatched).toBe(1);
  });

  it.each([
    ['shortened to 200 characters', 200, 0],
    ['shortened to 139 plain characters', PREVIOUS_MESSAGE_LENGTH - 1, 1],
    ['shortened well under the old cap', 30, 0],
  ])('leaves a message a supporter %s alone', (_label, length, unmatchedCount) => {
    const long = `${full} ${full}`.slice(0, 280);
    const { restores, unmatched } = planMessageRestores(
      { [JO]: stored(long.slice(0, length)) },
      [row(long)],
      idFor
    );
    expect(restores).toEqual([]);
    expect(unmatched).toBe(unmatchedCount);
  });

  it('counts a cut with no full text, or with two, as unmatched', () => {
    const other = `${cut} but a different ending entirely.`;
    expect(planMessageRestores({ [JO]: stored(cut) }, [], idFor).unmatched).toBe(1);
    expect(
      planMessageRestores({ [JO]: stored(cut) }, [row(full), row(other)], idFor).unmatched
    ).toBe(1);
  });

  it('never restores a full text the content filter rejects', () => {
    const blocked = `${cut} visit https://spam.example`;
    const { restores, unmatched } = planMessageRestores(
      { [JO]: stored(cut) },
      [row(blocked)],
      idFor
    );
    expect(restores).toEqual([]);
    expect(unmatched).toBe(1);
  });

  it('skips anonymous records and records without a message', () => {
    const { restores, unmatched } = planMessageRestores(
      { 'anon-1': stored(undefined, null), [JO]: stored() },
      [row(full)],
      idFor
    );
    expect(restores).toEqual([]);
    expect(unmatched).toBe(0);
  });
});

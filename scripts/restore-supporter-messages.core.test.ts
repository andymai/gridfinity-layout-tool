import { describe, it, expect } from 'vitest';
import { parseDonorRecord, serializeDonorRecord } from '../api/lib/supporters.js';
import { PREVIOUS_MESSAGE_LENGTH, planBackfill } from './restore-supporter-messages.core.js';
import type { TransactionRow } from './seed-supporters.core.js';

const row = (
  message: string,
  email = 'jo@example.com',
  from = 'Jo',
  dateTime = '2026-07-01T13:04:30Z'
): TransactionRow => ({ dateTime, from, message, received: '3.00', currency: 'USD', email });

const idFor = (email: string): string => `id:${email}`;
const JO = idFor('jo@example.com');

const full = `${'Thank you for building this, '.repeat(9)}it is great.`;
const cut = full.slice(0, PREVIOUS_MESSAGE_LENGTH);
const stored = (
  message?: string,
  name: string | null = 'Jo',
  joinedAt = '2026-07-01T13:04:30.000Z'
) => serializeDonorRecord({ name, joinedAt, message });
const after = (value: string) => parseDonorRecord(value);

describe('planBackfill: messages the old cap cut', () => {
  it('restores the full text, keeping the rest of the record', () => {
    const before = stored(cut);
    const { fixes, unmatched } = planBackfill({ [JO]: before }, [row(full)], idFor);
    expect(unmatched).toBe(0);
    expect(fixes).toHaveLength(1);
    expect(fixes[0]).toMatchObject({ field: JO, previous: before, message: 'restored' });
    expect(fixes[0].date).toBeUndefined();
    expect(after(fixes[0].value)).toEqual({
      name: 'Jo',
      joinedAt: '2026-07-01T13:04:30.000Z',
      message: full,
    });
  });

  it('restores a seed record from the transactions under its public name', () => {
    const { fixes } = planBackfill(
      { 'seed:named:0': stored(cut) },
      [row(full, 'someone@example.com')],
      idFor
    );
    expect(fixes.map((f) => after(f.value).message)).toEqual([full]);
  });

  it('restores a cut that dropped half an emoji at the cap', () => {
    const emoji = `${full.slice(0, PREVIOUS_MESSAGE_LENGTH - 1)}🎉 and many more thanks`;
    const shortened = emoji.slice(0, PREVIOUS_MESSAGE_LENGTH - 1);
    const { fixes } = planBackfill({ [JO]: stored(shortened) }, [row(emoji)], idFor);
    expect(fixes.map((f) => after(f.value).message)).toEqual([emoji]);
  });

  it("never takes another donor's words, even when they start the same way", () => {
    const { fixes, unmatched } = planBackfill(
      { [JO]: stored(cut) },
      [row(full, 'bob@example.com', 'Bob')],
      idFor
    );
    expect(fixes).toEqual([]);
    expect(unmatched).toBe(1);
  });

  it.each([
    ['shortened to 200 characters', 200, 0],
    ['shortened to 139 plain characters', PREVIOUS_MESSAGE_LENGTH - 1, 1],
    ['shortened well under the old cap', 30, 0],
  ])('leaves a message a supporter %s alone', (_label, length, unmatchedCount) => {
    const long = `${full} ${full}`.slice(0, 280);
    const { fixes, unmatched } = planBackfill(
      { [JO]: stored(long.slice(0, length)) },
      [row(long)],
      idFor
    );
    expect(fixes).toEqual([]);
    expect(unmatched).toBe(unmatchedCount);
  });

  it('counts a cut with no full text, or with two, as unmatched', () => {
    const other = `${cut} but a different ending entirely.`;
    expect(planBackfill({ [JO]: stored(cut) }, [], idFor).unmatched).toBe(1);
    expect(planBackfill({ [JO]: stored(cut) }, [row(full), row(other)], idFor).unmatched).toBe(1);
  });

  it('never restores a full text the content filter rejects', () => {
    const blocked = `${cut} visit https://spam.example`;
    const { fixes, unmatched } = planBackfill({ [JO]: stored(cut) }, [row(blocked)], idFor);
    expect(fixes).toEqual([]);
    expect(unmatched).toBe(1);
  });
});

describe('planBackfill: messages that were never stored', () => {
  it("adds the longest of a live supporter's own messages that passes the filter", () => {
    const { fixes } = planBackfill(
      { [JO]: stored() },
      [
        row('thanks!'),
        row('thanks for this tool, it saved my drawers'),
        row('see https://spam.example now'),
      ],
      idFor
    );
    expect(fixes).toHaveLength(1);
    expect(fixes[0].message).toBe('added');
    expect(after(fixes[0].value).message).toBe('thanks for this tool, it saved my drawers');
  });

  it('never gives an anonymous supporter a message', () => {
    const { fixes } = planBackfill(
      { [JO]: stored(undefined, null) },
      [row('private words')],
      idFor
    );
    expect(fixes).toEqual([]);
  });

  it('adds a seed message by name, skipping rows that belong to a live supporter of the same name', () => {
    const donors = {
      'seed:named:0': stored(undefined, 'John'),
      [idFor('other-john@example.com')]: stored('their own words', 'John'),
    };
    const rows = [
      row('the early words', 'john@example.com', 'John'),
      row('a much longer message from a different John', 'other-john@example.com', 'John'),
    ];
    const { fixes } = planBackfill(donors, rows, idFor);
    expect(fixes.map((f) => [f.field, after(f.value).message])).toEqual([
      ['seed:named:0', 'the early words'],
    ]);
  });

  it('touches nothing on a record whose donor has no transactions', () => {
    const donors = { 'anon-1': stored(undefined, null), [JO]: stored() };
    expect(planBackfill(donors, [row(full, 'bob@example.com', 'Bob')], idFor).fixes).toEqual([]);
  });
});

describe('planBackfill: join dates', () => {
  it("adds the donor's first tip to an undated record", () => {
    const undated = serializeDonorRecord({ name: 'Jo' });
    const rows = [
      row('', 'jo@example.com', 'Jo', '2026-07-20T10:00:00Z'),
      row('', 'jo@example.com', 'Jo', '2026-07-16T09:30:00Z'),
    ];
    const { fixes } = planBackfill({ [JO]: undated }, rows, idFor);
    expect(fixes[0].date).toBe('added');
    expect(after(fixes[0].value).joinedAt).toBe('2026-07-16T09:30:00.000Z');
  });

  it('moves a date a repeat tip pushed forward back to the first tip', () => {
    const rows = [
      row('', 'jo@example.com', 'Jo', '2026-07-01T13:04:00Z'),
      row('', 'jo@example.com', 'Jo', '2026-09-01T10:00:00Z'),
    ];
    const { fixes } = planBackfill(
      { [JO]: stored('hi', 'Jo', '2026-09-01T10:00:12.000Z') },
      rows,
      idFor
    );
    expect(fixes[0].date).toBe('moved');
    expect(after(fixes[0].value)).toMatchObject({
      joinedAt: '2026-07-01T13:04:00.000Z',
      message: 'hi',
    });
  });

  it('leaves a date that only differs from the export by its dropped seconds', () => {
    const rows = [row('hi', 'jo@example.com', 'Jo', '2026-07-01T13:04:00Z')];
    expect(planBackfill({ [JO]: stored('hi') }, rows, idFor).fixes).toEqual([]);
  });

  it("dates an anonymous seed slot from the seed's own assignment, never with a message", () => {
    const { fixes } = planBackfill(
      { 'seed:anon:0': serializeDonorRecord({ name: null }) },
      [row('words', 'x@example.com', 'X')],
      idFor,
      { 'seed:anon:0': '2026-02-01T00:00:00.000Z' }
    );
    expect(fixes).toHaveLength(1);
    expect(after(fixes[0].value)).toEqual({ name: null, joinedAt: '2026-02-01T00:00:00.000Z' });
  });
});

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

  it('restores no cut message on a seed whose name two donors share', () => {
    const { fixes, unmatched } = planBackfill(
      { 'seed:named:0': stored(cut) },
      [row(full, 'jo@example.com'), row('hello', 'other-jo@example.com')],
      idFor
    );
    expect(fixes).toEqual([]);
    expect(unmatched).toBe(1);
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
  /** How the webhook stored a supporter before it kept messages. */
  const BARE_JO = 'Jo';

  it("adds the message from a bare-name supporter's single tip", () => {
    const { fixes } = planBackfill({ [JO]: BARE_JO }, [row('it saved my drawers')], idFor);
    expect(fixes).toHaveLength(1);
    expect(fixes[0].message).toBe('added');
    expect(after(fixes[0].value)).toMatchObject({ name: 'Jo', message: 'it saved my drawers' });
  });

  it('adds nothing for a donor with several tips, since the export cannot show which were public', () => {
    const { fixes } = planBackfill(
      { [JO]: BARE_JO },
      [row('a private note'), row('', 'jo@example.com', 'Jo', '2026-07-01T13:04:30Z')],
      idFor
    );
    expect(fixes.map((f) => f.message)).toEqual([undefined]);
  });

  it('never adds a message the content filter rejects', () => {
    const { fixes } = planBackfill({ [JO]: BARE_JO }, [row('see https://spam.example now')], idFor);
    expect(fixes.map((f) => f.message)).toEqual([undefined]);
  });

  it('never gives a message to a JSON record, which a supporter may have cleared from the panel', () => {
    const { fixes } = planBackfill({ [JO]: stored() }, [row('it saved my drawers')], idFor);
    expect(fixes).toEqual([]);
  });

  it('gives a seed name two donors share neither a message nor a date', () => {
    const { fixes } = planBackfill(
      { 'seed:named:0': serializeDonorRecord({ name: 'Sam' }) },
      [
        row('one Sam', 'sam1@example.com', 'Sam', '2026-05-01T00:00:00Z'),
        row('', 'sam2@example.com', 'Sam', '2026-06-01T00:00:00Z'),
      ],
      idFor
    );
    expect(fixes).toEqual([]);
  });

  it("dates a seed by its donor's first tip under any name, and adds no message for two tips", () => {
    const { fixes } = planBackfill(
      { 'seed:named:0': serializeDonorRecord({ name: 'Ada' }) },
      [
        row('early words', 'ada@example.com', 'Ada Lovelace', '2026-03-01T00:00:00Z'),
        row('later words', 'ada@example.com', 'Ada', '2026-07-01T00:00:00Z'),
      ],
      idFor
    );
    expect(after(fixes[0].value)).toEqual({ name: 'Ada', joinedAt: '2026-03-01T00:00:00.000Z' });
  });

  it('gives a seed nothing when its donor also has a webhook record', () => {
    const donors = {
      'seed:named:0': serializeDonorRecord({ name: 'John' }),
      [idFor('john@example.com')]: stored(undefined, 'John', '2026-09-01T00:00:00.000Z'),
    };
    const rows = [
      row('early words, later cleared', 'john@example.com', 'John', '2026-05-01T00:00:00Z'),
    ];
    expect(planBackfill(donors, rows, idFor).fixes.map((f) => f.field)).not.toContain(
      'seed:named:0'
    );
  });

  it('adds a seed message from the one donor under its name', () => {
    const { fixes } = planBackfill(
      { 'seed:named:0': serializeDonorRecord({ name: 'Ada' }) },
      [row('love it', 'ada@example.com', 'Ada', '2026-05-01T00:00:00Z')],
      idFor
    );
    expect(after(fixes[0].value)).toEqual({
      name: 'Ada',
      joinedAt: '2026-05-01T00:00:00.000Z',
      message: 'love it',
    });
  });

  it('never gives an anonymous supporter a message', () => {
    const { fixes } = planBackfill(
      { [JO]: stored(undefined, null) },
      [row('private words')],
      idFor
    );
    expect(fixes).toEqual([]);
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
      { seedAnonDates: { 'seed:anon:0': '2026-02-01T00:00:00.000Z' } }
    );
    expect(fixes).toHaveLength(1);
    expect(after(fixes[0].value)).toEqual({ name: null, joinedAt: '2026-02-01T00:00:00.000Z' });
  });
});

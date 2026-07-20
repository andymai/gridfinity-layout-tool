import { describe, it, expect } from 'vitest';
import {
  buildSeedEntries,
  parseCsv,
  parseCsvDate,
  parseTransactionCsv,
  type TransactionRow,
} from './seed-supporters.core.js';

const parse = (v: string) => JSON.parse(v);

describe('parseCsv', () => {
  it('handles quoted fields with embedded commas and newlines', () => {
    const text = 'a,b,c\n1,"hello, world","line1\nline2"\n';
    expect(parseCsv(text)).toEqual([
      ['a', 'b', 'c'],
      ['1', 'hello, world', 'line1\nline2'],
    ]);
  });

  it('unescapes doubled quotes', () => {
    expect(parseCsv('"she said ""hi"""')).toEqual([['she said "hi"']]);
  });
});

describe('parseTransactionCsv', () => {
  it('maps the Ko-fi columns by header name', () => {
    const text =
      'DateTime (UTC),From,Message,Item,Received,Given,Currency,TransactionType,TransactionId,Reference,SalesTax,SalesTaxPercentage,SalesTaxIncludesShipping,BuyerCountry,BuyerStateOrProvince,BuyerEmail,PaymentProvider\n' +
      '2026-07-01T13:04:30Z,Jo,Thanks!,Ko-fi Support,3.00,2.90,USD,Tip,tx1,,0,0,false,,,JO@Example.com,PayPal\n';
    const rows = parseTransactionCsv(text);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      dateTime: '2026-07-01T13:04:30Z',
      from: 'Jo',
      message: 'Thanks!',
      received: '3.00',
      currency: 'USD',
      email: 'jo@example.com',
    });
  });
});

describe('parseCsvDate', () => {
  it('returns ISO for a parseable timestamp', () => {
    expect(parseCsvDate('2026-07-01T13:04:30Z')).toBe('2026-07-01T13:04:30.000Z');
  });

  it('returns undefined (never now) for garbage', () => {
    expect(parseCsvDate('not a date')).toBeUndefined();
  });
});

describe('buildSeedEntries', () => {
  const rows: TransactionRow[] = [
    {
      dateTime: '2026-03-01T00:00:00Z',
      from: 'Ada',
      message: 'love it',
      received: '5.00',
      currency: 'USD',
      email: 'ada@x.com',
    },
    {
      dateTime: '2026-01-01T00:00:00Z',
      from: 'Ada',
      message: 'great tool, seriously',
      received: '3.00',
      currency: 'USD',
      email: 'ada@x.com',
    },
    {
      dateTime: '2026-02-01T00:00:00Z',
      from: 'SecretGiver',
      message: 'shh',
      received: '10.00',
      currency: 'USD',
      email: 'anon@x.com',
    },
    {
      dateTime: '2026-04-01T00:00:00Z',
      from: 'AnotherAnon',
      message: 'hi',
      received: '2.00',
      currency: 'EUR',
      email: 'anon2@x.com',
    },
  ];

  it('attributes a name only if it is in the public list, with earliest date and best message', () => {
    const { entries } = buildSeedEntries(['Ada'], 2, rows);
    expect(parse(entries['seed:named:0'])).toEqual({
      n: 'Ada',
      t: '2026-01-01T00:00:00.000Z', // earliest of Ada's two tips
      m: 'great tool, seriously', // longest of her messages
    });
  });

  it('seeds anonymous slots with dates only, oldest first, no name or message', () => {
    const { entries } = buildSeedEntries(['Ada'], 2, rows);
    expect(parse(entries['seed:anon:0'])).toEqual({ n: '', t: '2026-02-01T00:00:00.000Z' });
    expect(parse(entries['seed:anon:1'])).toEqual({ n: '', t: '2026-04-01T00:00:00.000Z' });
  });

  it('leaves surplus anonymous slots undated rather than inventing data', () => {
    const { entries } = buildSeedEntries(['Ada'], 3, rows);
    expect(parse(entries['seed:anon:2'])).toEqual({ n: '' });
  });

  it('sums a per-currency totals baseline across every transaction', () => {
    const { totals } = buildSeedEntries(['Ada'], 2, rows);
    expect(totals).toEqual({ USD: 1800, EUR: 200 });
  });

  it('never emits a message for an anonymous supporter', () => {
    const { entries } = buildSeedEntries([], 1, rows);
    const seeded = Object.values(entries).map(parse);
    expect(seeded.every((r) => r.m === undefined)).toBe(true);
  });

  it('degrades to names-only when given no rows', () => {
    const { entries, stats } = buildSeedEntries(['Ada', 'Grace'], 1, []);
    expect(parse(entries['seed:named:0'])).toEqual({ n: 'Ada' });
    expect(parse(entries['seed:anon:0'])).toEqual({ n: '' });
    expect(stats).toMatchObject({ named: 2, anon: 1, withDate: 0, withMessage: 0 });
  });
});

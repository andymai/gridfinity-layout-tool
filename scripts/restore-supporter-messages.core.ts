import {
  filterMessage,
  parseDonorRecord,
  serializeDonorRecord,
  sliceWhole,
} from '../api/lib/supporters.js';
import { parseCsvDate, type TransactionRow } from './seed-supporters.core.js';

export const PREVIOUS_MESSAGE_LENGTH = 140;

/** Further than this past the donor's first tip, a stored date was moved by a repeat tip. */
const MOVED_DATE_MS = 24 * 60 * 60 * 1000;

export interface RecordFix {
  field: string;
  previous: string;
  value: string;
  message?: 'restored' | 'added';
  date?: 'added' | 'moved';
}

export interface BackfillPlan {
  fixes: RecordFix[];
  /** Messages at the old cap with no single full text from their own donor; left as they are. */
  unmatched: number;
}

function earliest(dates: (string | undefined)[]): string | undefined {
  return dates.reduce<string | undefined>((a, b) => (b && (!a || b < a) ? b : a), undefined);
}

export interface BackfillContext {
  /** The seed's own date assignment for `seed:anon:*`, which have no transactions of their own. */
  seedAnonDates?: Record<string, string | undefined>;
}

/** A bare display name, as the webhook stored one before it kept messages. The panel only writes JSON records. */
function isBareName(raw: string): boolean {
  try {
    const value: unknown = JSON.parse(raw);
    return !(typeof value === 'object' && value !== null && 'n' in value);
  } catch {
    return true;
  }
}

/**
 * What a Ko-fi export can still add to the stored records: a message the old
 * cap cut, a message or join date that was never stored, and a join date a
 * repeat tip moved forward. A webhook record takes rows by its salted email
 * id; a `seed:named` record by its public name, and only when every row under
 * that name comes from one donor with no webhook record of their own.
 *
 * The export has no public/private flag, so a missing message is added only
 * from a donor's single tip: a record showing a public name that one tip wrote
 * proves the tip was public. It goes only to records no supporter can have
 * edited: seed records, which no account can link to, and bare-name webhook
 * records, since any panel save rewrites a record as JSON. A cut message is
 * restored only when it is exactly what the old cap would have cut that full
 * text to, so an edited message never matches.
 */
export function planBackfill(
  donors: Record<string, string>,
  rows: TransactionRow[],
  donorIdFor: (email: string) => string | null,
  { seedAnonDates = {} }: BackfillContext = {}
): BackfillPlan {
  const owners = rows.map((row) => (row.email ? donorIdFor(row.email) : null));
  const isLive = (field: string | null): boolean =>
    field !== null && field in donors && !field.startsWith('seed:') && !field.startsWith('anon-');

  const ownRows = (field: string, name: string | null): number[] => {
    const all = rows.map((_, i) => i);
    if (field.startsWith('seed:named:'))
      return name ? all.filter((i) => rows[i].from === name) : [];
    return isLive(field) ? all.filter((i) => owners[i] === field) : [];
  };
  const isCertain = (field: string, idx: number[]): boolean => {
    if (!field.startsWith('seed:named:')) return idx.length > 0;
    const donorsIn = new Set(
      idx.map((i) => rows[i].email || `${rows[i].from}|${rows[i].dateTime}`)
    );
    return donorsIn.size === 1 && idx.every((i) => !isLive(owners[i]));
  };

  const fixes: RecordFix[] = [];
  let unmatched = 0;
  for (const [field, raw] of Object.entries(donors)) {
    const record = parseDonorRecord(raw);
    const idx = ownRows(field, record.name);
    const own = idx.map((i) => rows[i]);
    const certain = isCertain(field, idx);
    const unedited = field.startsWith('seed:named:') || isBareName(raw);
    const fix: Omit<RecordFix, 'field' | 'previous' | 'value'> = {};
    const next = { ...record };

    if (record.name) {
      const texts = own.map((row) => filterMessage(row.message)).filter((t): t is string => !!t);
      const stored = record.message;
      if (!stored) {
        if (certain && unedited && own.length === 1) {
          next.message = filterMessage(own[0].message) ?? undefined;
          if (next.message) fix.message = 'added';
        }
      } else if (
        stored.length >= PREVIOUS_MESSAGE_LENGTH - 1 &&
        stored.length <= PREVIOUS_MESSAGE_LENGTH
      ) {
        const matches = new Set(
          texts.filter(
            (full) =>
              full.length > stored.length && sliceWhole(full, PREVIOUS_MESSAGE_LENGTH) === stored
          )
        );
        if (matches.size === 1) {
          [next.message] = matches;
          fix.message = 'restored';
        } else {
          unmatched++;
        }
      }
    }

    const firstTip = field.startsWith('seed:anon:')
      ? seedAnonDates[field]
      : certain
        ? earliest(own.map((row) => parseCsvDate(row.dateTime)))
        : undefined;
    if (firstTip) {
      if (!record.joinedAt) {
        next.joinedAt = firstTip;
        fix.date = 'added';
      } else if (Date.parse(record.joinedAt) - Date.parse(firstTip) > MOVED_DATE_MS) {
        next.joinedAt = firstTip;
        fix.date = 'moved';
      }
    }

    if (fix.message || fix.date) {
      fixes.push({ field, previous: raw, value: serializeDonorRecord(next), ...fix });
    }
  }
  return { fixes, unmatched };
}

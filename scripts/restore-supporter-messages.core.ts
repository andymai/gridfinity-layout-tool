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
  /** Webhook records an account has linked to, whose owner may have edited them from the panel. */
  linkedDonors?: Set<string>;
}

/**
 * What a Ko-fi export can still add to the stored records: a message the old
 * cap cut, a message or join date that was never stored, and a join date a
 * repeat tip moved forward. A record only takes rows from its own donor (the
 * salted email id for a webhook record; the public name for a `seed:named`
 * record, skipping rows that belong to a webhook record), and only while it
 * shows a public name.
 *
 * The export has no public/private flag, so a missing message is added only
 * when the donor's single tip carried it: a named record whose donor tipped
 * once proves that tip was public. Never to a record whose account could have
 * cleared the message on purpose. A seed name shared by two donors gets no
 * message or date. A cut message is restored only when it is exactly what the
 * old cap would have cut that full text to, so an edited message never matches.
 */
export function planBackfill(
  donors: Record<string, string>,
  rows: TransactionRow[],
  donorIdFor: (email: string) => string | null,
  { seedAnonDates = {}, linkedDonors = new Set<string>() }: BackfillContext = {}
): BackfillPlan {
  const owners = rows.map((row) => (row.email ? donorIdFor(row.email) : null));
  const isLive = (field: string | null): boolean =>
    field !== null && field in donors && !field.startsWith('seed:') && !field.startsWith('anon-');

  const ownRows = (field: string, name: string | null): TransactionRow[] => {
    if (field.startsWith('seed:named:')) {
      return name ? rows.filter((row, i) => row.from === name && !isLive(owners[i])) : [];
    }
    if (!isLive(field)) return [];
    return rows.filter((_, i) => owners[i] === field);
  };

  const fixes: RecordFix[] = [];
  let unmatched = 0;
  for (const [field, raw] of Object.entries(donors)) {
    const record = parseDonorRecord(raw);
    const own = ownRows(field, record.name);
    const oneDonor =
      new Set(own.map((row) => row.email || `${row.from}|${row.dateTime}`)).size === 1;
    const fix: Omit<RecordFix, 'field' | 'previous' | 'value'> = {};
    const next = { ...record };

    if (record.name) {
      const texts = own.map((row) => filterMessage(row.message)).filter((t): t is string => !!t);
      const stored = record.message;
      if (!stored) {
        if (own.length === 1 && !linkedDonors.has(field)) {
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
      : oneDonor
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

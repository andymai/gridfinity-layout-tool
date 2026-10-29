import {
  filterMessage,
  parseDonorRecord,
  serializeDonorRecord,
  sliceWhole,
} from '../api/lib/supporters.js';
import type { TransactionRow } from './seed-supporters.core.js';

export const PREVIOUS_MESSAGE_LENGTH = 140;

export interface MessageRestore {
  field: string;
  previous: string;
  value: string;
  storedLength: number;
  restoredLength: number;
}

export interface RestorePlan {
  restores: MessageRestore[];
  /** Messages at the old cap with no single full text from their own donor; left as they are. */
  unmatched: number;
}

/**
 * A stored message is restored only from its own donor's transactions (the
 * salted email id for a webhook record, the public name for a `seed:` record,
 * as the seed attributed it) and only when it is exactly what the old cap
 * would have cut that full text to. A message a supporter has since edited,
 * even to 139 or 200 characters, never matches, and neither does a full text
 * the content filter now rejects.
 */
export function planMessageRestores(
  donors: Record<string, string>,
  rows: TransactionRow[],
  donorIdFor: (email: string) => string | null
): RestorePlan {
  const restores: MessageRestore[] = [];
  let unmatched = 0;
  for (const [field, raw] of Object.entries(donors)) {
    const record = parseDonorRecord(raw);
    const stored = record.message;
    if (!record.name || !stored) continue;
    if (stored.length < PREVIOUS_MESSAGE_LENGTH - 1 || stored.length > PREVIOUS_MESSAGE_LENGTH)
      continue;

    const own = field.startsWith('seed:')
      ? rows.filter((row) => row.from === record.name)
      : rows.filter((row) => row.email && donorIdFor(row.email) === field);
    const matches = new Set<string>();
    for (const row of own) {
      const full = filterMessage(row.message);
      if (
        full &&
        full.length > stored.length &&
        sliceWhole(full, PREVIOUS_MESSAGE_LENGTH) === stored
      ) {
        matches.add(full);
      }
    }
    if (matches.size !== 1) {
      unmatched++;
      continue;
    }
    const [message] = matches;
    restores.push({
      field,
      previous: raw,
      value: serializeDonorRecord({ ...record, message }),
      storedLength: stored.length,
      restoredLength: message.length,
    });
  }
  return { restores, unmatched };
}

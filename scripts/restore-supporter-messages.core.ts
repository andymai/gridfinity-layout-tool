/**
 * Pure transform behind `restore-supporter-messages.ts`: finds stored supporter
 * messages that the old 140-character cap cut short and pairs each with the
 * full text from a Ko-fi transaction export. Kept separate from the Redis I/O
 * so it can be unit-tested.
 */

import { filterMessage, parseDonorRecord, serializeDonorRecord } from '../api/lib/supporters.js';
import type { TransactionRow } from './seed-supporters.core.js';

export const PREVIOUS_MESSAGE_LENGTH = 140;

export interface MessageRestore {
  field: string;
  value: string;
  storedLength: number;
  restoredLength: number;
}

export interface RestorePlan {
  restores: MessageRestore[];
  /** Messages at the old cap with no single full text in the export; left as they are. */
  unmatched: number;
}

/**
 * A stored message counts as cut only when it is as long as the old cap allowed
 * (one less where the cut dropped half an emoji) and exactly one full message in
 * the export starts with it. A shorter message, such as one a supporter edited
 * themselves, is never touched, and neither is a full text the content filter
 * now rejects.
 */
export function planMessageRestores(
  donors: Record<string, string>,
  rows: TransactionRow[]
): RestorePlan {
  const full = new Set<string>();
  for (const row of rows) {
    const message = filterMessage(row.message);
    if (message && message.length > PREVIOUS_MESSAGE_LENGTH) full.add(message);
  }

  const restores: MessageRestore[] = [];
  let unmatched = 0;
  for (const [field, raw] of Object.entries(donors)) {
    const record = parseDonorRecord(raw);
    const stored = record.message;
    if (!record.name || !stored || stored.length < PREVIOUS_MESSAGE_LENGTH - 1) continue;
    const matches = [...full].filter((m) => m.length > stored.length && m.startsWith(stored));
    if (matches.length !== 1) {
      unmatched++;
      continue;
    }
    restores.push({
      field,
      value: serializeDonorRecord({ ...record, message: matches[0] }),
      storedLength: stored.length,
      restoredLength: matches[0].length,
    });
  }
  return { restores, unmatched };
}

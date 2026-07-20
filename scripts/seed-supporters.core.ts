/**
 * Pure transform behind `seed-supporters.ts` — parses a Ko-fi transaction
 * export and produces the `supporters:donors` fields (and a per-currency total)
 * to write. Kept separate from the Redis I/O so it can be unit-tested.
 *
 * Enriches the reconciled public list in `supporters.json` with real join dates
 * and messages: a name only carries a date/message if it appears in that list
 * (the opt-in public set), so a supporter shown anonymously surfaces neither.
 */

import {
  filterMessage,
  serializeDonorRecord,
  type SupporterRecord,
} from '../api/lib/supporters.js';

export interface TransactionRow {
  dateTime: string;
  from: string;
  message: string;
  received: string;
  currency: string;
  email: string;
}

export interface BackfillResult {
  /** `supporters:donors` field → serialized record, keyed by stable `seed:*` ids. */
  entries: Record<string, string>;
  /** Currency → received minor units, summed across every transaction. */
  totals: Record<string, number>;
  stats: { named: number; anon: number; withDate: number; withMessage: number };
}

/** Minimal RFC-4180 CSV reader: handles quoted fields, embedded commas/newlines, and `""`. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c !== '\r') {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Extract the columns we use from a Ko-fi `Transaction_All` export. */
export function parseTransactionCsv(text: string): TransactionRow[] {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.replace(/^﻿/, '').trim());
  const col = (name: string): number => header.indexOf(name);
  const iDate = col('DateTime (UTC)');
  const iFrom = col('From');
  const iMsg = col('Message');
  const iRecv = col('Received');
  const iCur = col('Currency');
  const iEmail = col('BuyerEmail');
  return rows
    .slice(1)
    .filter((r) => r.length > 1)
    .map((r) => ({
      dateTime: iDate >= 0 ? (r[iDate] ?? '') : '',
      from: (iFrom >= 0 ? (r[iFrom] ?? '') : '').trim(),
      message: iMsg >= 0 ? (r[iMsg] ?? '') : '',
      received: iRecv >= 0 ? (r[iRecv] ?? '') : '',
      currency: iCur >= 0 ? (r[iCur] ?? '') : '',
      email: (iEmail >= 0 ? (r[iEmail] ?? '') : '').trim().toLowerCase(),
    }));
}

/** ISO form of a CSV timestamp, or undefined if it can't be parsed (never "now"). */
export function parseCsvDate(raw: string): string | undefined {
  const t = Date.parse(raw);
  return Number.isFinite(t) ? new Date(t).toISOString() : undefined;
}

function earliest(dates: string[]): string | undefined {
  return dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : undefined;
}

/** Longest message that survives the same filter live messages pass through. */
function bestMessage(rows: TransactionRow[]): string | undefined {
  let best: string | undefined;
  for (const r of rows) {
    const cleaned = filterMessage(r.message);
    if (cleaned && (!best || cleaned.length > best.length)) best = cleaned;
  }
  return best;
}

/**
 * Build the seed fields. `publicNames` is the ordered public list (its index
 * fixes each `seed:named:N` slot); `anonCount` is how many anonymous slots to
 * fill. With no rows this degrades to names-only (dates/messages absent).
 */
export function buildSeedEntries(
  publicNames: string[],
  anonCount: number,
  rows: TransactionRow[]
): BackfillResult {
  const entries: Record<string, string> = {};
  const publicSet = new Set(publicNames);
  const publicRows = rows.filter((r) => publicSet.has(r.from));
  const anonRows = rows.filter((r) => !publicSet.has(r.from));
  let withDate = 0;
  let withMessage = 0;

  publicNames.forEach((name, i) => {
    const matching = publicRows.filter((r) => r.from === name);
    const dates = matching.map((r) => parseCsvDate(r.dateTime)).filter((d): d is string => !!d);
    const record: SupporterRecord = { name };
    const joinedAt = earliest(dates);
    if (joinedAt) {
      record.joinedAt = joinedAt;
      withDate++;
    }
    const message = bestMessage(matching);
    if (message) {
      record.message = message;
      withMessage++;
    }
    entries[`seed:named:${i}`] = serializeDonorRecord(record);
  });

  // One earliest date per unique anonymous donor, oldest first into the slots.
  const earliestByDonor = new Map<string, string>();
  for (const r of anonRows) {
    const d = parseCsvDate(r.dateTime);
    if (!d) continue;
    const key = r.email || `${r.from}|${r.dateTime}`;
    const prev = earliestByDonor.get(key);
    if (!prev || d < prev) earliestByDonor.set(key, d);
  }
  const anonDates = [...earliestByDonor.values()].sort();
  for (let i = 0; i < anonCount; i++) {
    const record: SupporterRecord = { name: null };
    if (anonDates[i]) {
      record.joinedAt = anonDates[i];
      withDate++;
    }
    entries[`seed:anon:${i}`] = serializeDonorRecord(record);
  }

  const totals: Record<string, number> = {};
  for (const r of rows) {
    const cur = r.currency.trim().toUpperCase();
    const amt = Number.parseFloat(r.received);
    if (/^[A-Z]{3}$/.test(cur) && Number.isFinite(amt) && amt > 0) {
      totals[cur] = (totals[cur] ?? 0) + Math.round(amt * 100);
    }
  }

  return {
    entries,
    totals,
    stats: { named: publicNames.length, anon: anonCount, withDate, withMessage },
  };
}

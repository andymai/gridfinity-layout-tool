/**
 * Turn pasted text into label rows.
 *
 * Two shapes arrive in practice. Rows copied from a spreadsheet or an order
 * page are tab-separated, so the part-number column is found by majority and
 * the longest text cell becomes the name. Typed lists are one label per line,
 * and only a token in a known supplier format is split off as the detail: a
 * generic rule would also split `M3x8 screws` into a part number and a name.
 */

import { looksLikePartNumber, normalizePartNumber, vendorOfPartNumber } from './partNumbers';

export interface ParsedLabel {
  readonly name: string;
  readonly detail: string;
}

const PRICE_OR_NUMBER = /^[$€£¥]?\s?[\d.,]+\s?[$€£¥]?$/;

function isTextCell(cell: string): boolean {
  return /\p{L}/u.test(cell) && !PRICE_OR_NUMBER.test(cell);
}

function parseLine(line: string): ParsedLabel {
  if (vendorOfPartNumber(line) !== null) return { name: normalizePartNumber(line), detail: '' };
  const leading = /^(\S+)\s+(.+)$/.exec(line);
  if (leading && vendorOfPartNumber(leading[1]) !== null) {
    return { name: leading[2].trim(), detail: normalizePartNumber(leading[1]) };
  }
  const trailing = /^(.+)\s+(\S+)$/.exec(line);
  if (trailing && vendorOfPartNumber(trailing[2]) !== null) {
    return { name: trailing[1].trim(), detail: normalizePartNumber(trailing[2]) };
  }
  return { name: line, detail: '' };
}

/** The column most rows fill with a part number, preferring a known supplier's. */
function findPartColumn(rows: readonly (readonly string[])[]): number {
  const width = Math.max(...rows.map((row) => row.length));
  let best = -1;
  let bestScore = 0;
  for (let col = 0; col < width; col++) {
    let generic = 0;
    let vendor = 0;
    for (const row of rows) {
      const cell = row[col] ?? '';
      if (looksLikePartNumber(cell)) generic++;
      if (vendorOfPartNumber(cell) !== null) vendor++;
    }
    if (generic * 2 < rows.length) continue;
    const score = generic + vendor * rows.length;
    if (score > bestScore) {
      best = col;
      bestScore = score;
    }
  }
  return best;
}

function parseTable(rows: readonly (readonly string[])[]): ParsedLabel[] {
  const partCol = findPartColumn(rows);
  const body =
    partCol >= 0 && rows.length > 1 && !looksLikePartNumber(rows[0][partCol] ?? '')
      ? rows.slice(1)
      : rows;

  if (partCol < 0) {
    // Without a part number the columns are the user's own: name, then detail.
    return body.flatMap((row) => {
      const [name = '', detail = ''] = row.filter(isTextCell);
      return name === '' ? [] : [{ name, detail }];
    });
  }

  const labels: ParsedLabel[] = [];
  for (const row of body) {
    const detail = normalizePartNumber(row[partCol] ?? '');
    let name = '';
    row.forEach((cell, col) => {
      if (col !== partCol && isTextCell(cell) && cell.length > name.length) name = cell;
    });
    if (name === '' && detail === '') continue;
    labels.push(name === '' ? { name: detail, detail: '' } : { name, detail });
  }
  return labels;
}

export function parseLabelList(text: string): ParsedLabel[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '');
  if (lines.length === 0) return [];

  if (lines.some((line) => line.includes('\t'))) {
    return parseTable(lines.map((line) => line.split('\t').map((cell) => cell.trim())));
  }
  return lines.map(parseLine);
}

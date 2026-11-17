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
import type { LabelText } from './planLabel';

const PRICE_OR_NUMBER = /^[$€£¥]?\s?[\d.,]+\s?[$€£¥]?$/;
const PART_THEN_NAME = /^(?<part>\S+)\s+(?<name>.+)$/;
const NAME_THEN_PART = /^(?<name>.+)\s+(?<part>\S+)$/;

function isTextCell(cell: string): boolean {
  return /\p{L}/u.test(cell) && !PRICE_OR_NUMBER.test(cell);
}

function parseLine(line: string): LabelText {
  if (vendorOfPartNumber(line) !== null) return { name: normalizePartNumber(line), detail: '' };
  for (const pattern of [PART_THEN_NAME, NAME_THEN_PART]) {
    const groups = pattern.exec(line)?.groups;
    if (groups && vendorOfPartNumber(groups.part) !== null) {
      return { name: groups.name.trim(), detail: normalizePartNumber(groups.part) };
    }
  }
  return { name: line, detail: '' };
}

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

function parseTable(rows: readonly (readonly string[])[]): LabelText[] {
  const partCol = findPartColumn(rows);
  if (partCol < 0) {
    // Without a part number the columns are the user's own: name, then detail.
    return rows.flatMap((row) => {
      const [name = '', detail = ''] = row.filter(isTextCell);
      return name === '' ? [] : [{ name, detail }];
    });
  }

  const header = rows[0][partCol] ?? '';
  // A header names the column, so a cell with a digit is data, even a size
  // such as M3 that is too short to read as a part number.
  const hasHeader = rows.length > 1 && isTextCell(header) && !/\d/.test(header);
  return (hasHeader ? rows.slice(1) : rows).flatMap((row) => {
    const detail = normalizePartNumber(row[partCol] ?? '');
    const name = row
      .filter((cell, col) => col !== partCol && isTextCell(cell))
      .reduce((longest, cell) => (cell.length > longest.length ? cell : longest), '');
    if (name !== '') return [{ name, detail }];
    return detail === '' ? [] : [{ name: detail, detail: '' }];
  });
}

export function parseLabelList(text: string): LabelText[] {
  // Lines are not trimmed before the split: a leading tab is an empty first
  // cell, and dropping it would shift every column of that row left.
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');
  if (lines.some((line) => line.includes('\t'))) {
    return parseTable(lines.map((line) => line.split('\t').map((cell) => cell.trim())));
  }
  return lines.map((line) => parseLine(line.trim()));
}

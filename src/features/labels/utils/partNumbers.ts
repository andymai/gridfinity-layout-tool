/**
 * Supplier part-number patterns.
 *
 * A pattern only recognises a token. Nothing here fetches a description: the
 * suppliers that matter have no open lookup API, so the user brings the
 * description with the part number.
 */

export type PartNumberVendor = 'mcmaster';

interface VendorPattern {
  readonly vendor: PartNumberVendor;
  readonly pattern: RegExp;
}

const VENDOR_PATTERNS: readonly VendorPattern[] = [
  // Digits, a letter group, digits: 91290A113, 6100K134, 47065T101.
  { vendor: 'mcmaster', pattern: /^\d{3,6}[A-Z]{1,2}\d{1,5}$/i },
];

/** The supplier whose part-number format `token` matches, or null. */
export function vendorOfPartNumber(token: string): PartNumberVendor | null {
  const trimmed = token.trim();
  for (const { vendor, pattern } of VENDOR_PATTERNS) {
    if (pattern.test(trimmed)) return vendor;
  }
  return null;
}

/**
 * Whether a spreadsheet cell reads as a part number of any supplier: one token
 * with a digit in it that is not a plain quantity or price. A size such as
 * `M3x8` passes too, so callers pick a column, not a cell.
 */
export function looksLikePartNumber(cell: string): boolean {
  const value = cell.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9\-./_#]{2,29}$/.test(value)) return false;
  if (!/\d/.test(value)) return false;
  return !/^[\d.,]+$/.test(value);
}

/** Part numbers print in upper case for a recognised supplier, as typed otherwise. */
export function normalizePartNumber(token: string): string {
  const trimmed = token.trim();
  return vendorOfPartNumber(trimmed) === null ? trimmed : trimmed.toUpperCase();
}

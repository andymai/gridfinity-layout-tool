/**
 * Server-side validation for community print reports.
 *
 * MIRROR: `COMMUNITY_PRINT_MATERIALS`, `COMMUNITY_PRINT_FIT_VERDICTS` and the
 * limit/range constants here must match the identically-named exports in
 * `src/shared/types/communityPrint.ts` (api/ cannot import from src/, so the
 * members are duplicated, not shared). Update both sides together; the
 * cross-boundary equality test in `src/shared/types/communityPrint.test.ts`
 * guards against drift.
 */

import { checkText, filterDisplayName } from './contentFilter.js';
import { isObject, isString, validationError } from './validationUtils.js';
import { COMMUNITY_PRINTER_OTHER, isCommunityPrinterId } from './communityPrinters.js';
import { COMMUNITY_AUTHOR_NAME_MAX_LENGTH } from './communityValidation.js';

export const COMMUNITY_PRINT_MATERIALS = ['pla', 'petg', 'abs', 'asa', 'tpu', 'other'] as const;
export type CommunityPrintMaterial = (typeof COMMUNITY_PRINT_MATERIALS)[number];

export const COMMUNITY_PRINT_FIT_VERDICTS = ['as-designed', 'adjusted', 'did-not-fit'] as const;
export type CommunityPrintFitVerdict = (typeof COMMUNITY_PRINT_FIT_VERDICTS)[number];

export const COMMUNITY_PRINT_MAX_PHOTOS = 4;
export const COMMUNITY_PRINT_NOTE_MAX_LENGTH = 200;
export const COMMUNITY_PRINT_PRINTER_OTHER_MAX_LENGTH = 40;
export const COMMUNITY_PRINT_PHOTO_MAX_EDGE_PX = 1200;
export const COMMUNITY_PRINT_PHOTO_MAX_BYTES = 400_000;

/** Mirror of the client's browsing-sized copy bounds; see communityPrint.ts. */
export const COMMUNITY_PRINT_THUMB_MAX_EDGE_PX = 400;
export const COMMUNITY_PRINT_THUMB_MAX_BYTES = 120_000;

export const COMMUNITY_PRINT_RANGES = {
  nozzleMm: { min: 0.1, max: 2 },
  layerHeightMm: { min: 0.02, max: 1.2 },
  printMinutes: { min: 1, max: 10_000 },
  filamentGrams: { min: 0.1, max: 10_000 },
} as const;

/**
 * Kill switch mirroring `COMMUNITY_PUBLISH_ENABLED`: unset, or anything but the
 * literal string 'true', makes every print endpoint 503. Prints carry
 * user-submitted photos, so the feature stays dark until there is moderation
 * capacity behind it. Documented in CLAUDE.md's env section.
 */
export function communityPrintsEnabled(): boolean {
  return process.env.COMMUNITY_PRINTS_ENABLED === 'true';
}

const BASE64_REGEX = /^[A-Za-z0-9+/]+={0,2}$/;
const WEBP_DATA_URL_PREFIX = 'data:image/webp;base64,';

function maxEncodedLength(maxDecodedBytes: number): number {
  return Math.ceil(maxDecodedBytes / 3) * 4 + 4;
}

function decodedBase64Bytes(base64: string): number {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

/**
 * Decode a WebP's canvas dimensions from its header chunk.
 *
 * The byte cap alone does not bound pixels: a flat-colour 4000px image
 * compresses well under 400KB, and the client's downscale is advisory because
 * a hostile client can post whatever it likes. Returns null when the header is
 * absent or malformed, which the caller treats as a rejection.
 *
 * Three container variants carry the size in different places: 'VP8 ' (lossy)
 * behind a 3-byte frame tag and the 0x9D012A sync code, 'VP8L' (lossless) as
 * two 14-bit minus-one fields after a 0x2F signature, and 'VP8X' (extended) as
 * two 24-bit minus-one fields after a 4-byte flags block.
 */
export function readWebpDimensions(header: Buffer): { width: number; height: number } | null {
  if (header.length < 16) return null;
  if (header.toString('latin1', 0, 4) !== 'RIFF') return null;
  if (header.toString('latin1', 8, 12) !== 'WEBP') return null;

  const format = header.toString('latin1', 12, 16);

  if (format === 'VP8 ') {
    if (header.length < 30) return null;
    if (header[23] !== 0x9d || header[24] !== 0x01 || header[25] !== 0x2a) return null;
    return {
      width: header.readUInt16LE(26) & 0x3fff,
      height: header.readUInt16LE(28) & 0x3fff,
    };
  }

  if (format === 'VP8L') {
    if (header.length < 25) return null;
    if (header[20] !== 0x2f) return null;
    const bits = header.readUInt32LE(21);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    };
  }

  if (format === 'VP8X') {
    if (header.length < 30) return null;
    return {
      width: (header[24] | (header[25] << 8) | (header[26] << 16)) + 1,
      height: (header[27] | (header[28] << 8) | (header[29] << 16)) + 1,
    };
  }

  return null;
}

/**
 * A photo entry is either a new upload (base64/data URL) or an instruction to
 * keep one the print already has (its exact blob URL). Without the keep form,
 * editing a note would force the client to re-upload every photo, which means
 * either hoarding the original base64 in memory or re-downloading and
 * re-encoding its own images. The caller must still verify a kept URL actually
 * belongs to the record being edited; this module only classifies the shape.
 */
export type CommunityPrintPhotoEntry =
  | {
      kind: 'new';
      base64: string;
      /**
       * Browsing-sized copy of the same image, absent when the client predates
       * the field. It rides the entry rather than a parallel `photoThumbs`
       * array on the wire: the handler rebuilds the photo list on every edit,
       * splicing fresh uploads between kept slots, and a second array ordered
       * by position is the drift that gotcha 6 in CLAUDE.md is about.
       */
      thumbBase64: string | null;
    }
  | { kind: 'keep'; url: string };

const PHOTO_URL_MAX_LENGTH = 512;

type PhotoCheck = { ok: true; entry: CommunityPrintPhotoEntry } | { ok: false; message: string };

/**
 * Validates one encoded WebP image against a byte and edge ceiling, returning
 * the bare base64. Shared by the photo and its browsing-sized copy so the
 * smaller one cannot skip a check the larger one gets — in particular the
 * dimension read, without which a client could post a full-size image in the
 * thumbnail field and defeat the whole point of having one.
 */
function checkEncodedImage(
  base64Input: string,
  label: string,
  maxBytes: number,
  maxEdgePx: number
): { ok: true; base64: string } | { ok: false; message: string } {
  let base64 = base64Input;
  if (base64.startsWith('data:')) {
    if (!base64.startsWith(WEBP_DATA_URL_PREFIX)) {
      return { ok: false, message: `${label} must be an image/webp data URL` };
    }
    base64 = base64.slice(WEBP_DATA_URL_PREFIX.length);
  }
  if (base64.length === 0) {
    return { ok: false, message: `${label} is empty` };
  }
  // Length gate precedes the regex so it never walks an unbounded string.
  if (base64.length > maxEncodedLength(maxBytes)) {
    return { ok: false, message: `${label} exceeds ${maxBytes} decoded bytes` };
  }
  if (!BASE64_REGEX.test(base64)) {
    return { ok: false, message: `${label} must be base64` };
  }
  if (decodedBase64Bytes(base64) > maxBytes) {
    return { ok: false, message: `${label} exceeds ${maxBytes} decoded bytes` };
  }
  // 64 base64 chars decode to 48 bytes, past the furthest header field (VP8 's
  // dimensions end at byte 30), without touching the compressed body.
  const dimensions = readWebpDimensions(Buffer.from(base64.slice(0, 64), 'base64'));
  if (dimensions === null) {
    return { ok: false, message: `${label} is not a WebP image` };
  }
  if (dimensions.width > maxEdgePx || dimensions.height > maxEdgePx) {
    return { ok: false, message: `${label} exceeds ${maxEdgePx}px on its longest edge` };
  }
  return { ok: true, base64 };
}

function checkPhoto(value: unknown, index: number): PhotoCheck {
  if (isObject(value)) {
    const photo = checkPhoto(value.photo, index);
    if (!photo.ok || photo.entry.kind === 'keep') return photo;
    const rawThumb = value.thumb;
    if (rawThumb === undefined || rawThumb === null) {
      return { ok: true, entry: { ...photo.entry, thumbBase64: null } };
    }
    if (!isString(rawThumb)) {
      return { ok: false, message: `photos[${index}].thumb must be a string` };
    }
    const thumb = checkEncodedImage(
      rawThumb,
      `photos[${index}].thumb`,
      COMMUNITY_PRINT_THUMB_MAX_BYTES,
      COMMUNITY_PRINT_THUMB_MAX_EDGE_PX
    );
    if (!thumb.ok) return { ok: false, message: thumb.message };
    return { ok: true, entry: { ...photo.entry, thumbBase64: thumb.base64 } };
  }
  if (!isString(value)) {
    return { ok: false, message: `photos[${index}] must be a string` };
  }
  if (value.startsWith('https://')) {
    if (value.length > PHOTO_URL_MAX_LENGTH) {
      return { ok: false, message: `photos[${index}] URL is too long` };
    }
    return { ok: true, entry: { kind: 'keep', url: value } };
  }
  const checked = checkEncodedImage(
    value,
    `photos[${index}]`,
    COMMUNITY_PRINT_PHOTO_MAX_BYTES,
    COMMUNITY_PRINT_PHOTO_MAX_EDGE_PX
  );
  if (!checked.ok) return { ok: false, message: checked.message };
  return { ok: true, entry: { kind: 'new', base64: checked.base64, thumbBase64: null } };
}

function checkRange(
  value: unknown,
  field: keyof typeof COMMUNITY_PRINT_RANGES
): { ok: true; value: number } | { ok: false; message: string } {
  const range = COMMUNITY_PRINT_RANGES[field];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { ok: false, message: `${field} must be a finite number` };
  }
  if (value < range.min || value > range.max) {
    return { ok: false, message: `${field} must be between ${range.min} and ${range.max}` };
  }
  return { ok: true, value };
}

/** Absent (undefined/null) passes as null; a value present but out of range still fails. */
function checkOptionalRange(
  value: unknown,
  field: keyof typeof COMMUNITY_PRINT_RANGES
): { ok: true; value: number | null } | { ok: false; message: string } {
  if (value === undefined || value === null) return { ok: true, value: null };
  return checkRange(value, field);
}

export interface CommunityPrintPayload {
  authorName: string;
  material: CommunityPrintMaterial | null;
  nozzleMm: number | null;
  layerHeightMm: number | null;
  printMinutes: number | null;
  filamentGrams: number | null;
  printer: string | null;
  printerOther: string;
  fitVerdict: CommunityPrintFitVerdict;
  note: string;
  /** Ordered desired photo set: new uploads to persist, kept URLs to carry over. */
  photos: CommunityPrintPhotoEntry[];
}

export type CommunityPrintValidationResult =
  | { valid: true; payload: CommunityPrintPayload }
  | { valid: false; error: { code: string; message: string } };

/**
 * Does a print carry evidence (a photo) or context (a note)?
 *
 * The substance floor, now that every setting is optional: a fit verdict on its
 * own is a bare vote. It lives outside `validateCommunityPrint` because it is
 * the one rule that depends on what is already stored. Records written before
 * the floor existed could legitimately have neither (the old validator said so
 * explicitly), and their owners must still be able to fix a typo rather than
 * being left with delete as the only way out. Applied in `handleUpsert`.
 */
export function hasPrintSubstance(photoCount: number, note: string): boolean {
  return photoCount > 0 || note.trim() !== '';
}

export function validateCommunityPrint(body: unknown): CommunityPrintValidationResult {
  if (!isObject(body)) {
    return validationError('INVALID_PAYLOAD', 'Request body must be an object');
  }

  if (!isString(body.authorName)) {
    return validationError('INVALID_AUTHOR_NAME', 'authorName must be a string');
  }
  const authorName = body.authorName.trim();
  if (authorName.length < 1 || authorName.length > COMMUNITY_AUTHOR_NAME_MAX_LENGTH) {
    return validationError(
      'INVALID_AUTHOR_NAME',
      `authorName must be 1-${COMMUNITY_AUTHOR_NAME_MAX_LENGTH} characters`
    );
  }
  // Length cap first: the filter's regexes are ReDoS-prone on unbounded input.
  if (!filterDisplayName(authorName).passed) {
    return validationError('CONTENT_BLOCKED', 'authorName contains prohibited content');
  }

  // Every settings field is optional; the fit verdict below is the only one
  // this validator demands. An omitted field is stored absent, never as a zero
  // that would skew the aggregates. The substance floor (a photo or a note) is
  // enforced in `handleUpsert`, which is the only place that knows what is
  // already stored; see `hasPrintSubstance`.
  let material: CommunityPrintMaterial | null = null;
  if (body.material !== undefined && body.material !== null) {
    if (
      !isString(body.material) ||
      !(COMMUNITY_PRINT_MATERIALS as readonly string[]).includes(body.material)
    ) {
      return validationError(
        'INVALID_MATERIAL',
        `material must be one of: ${COMMUNITY_PRINT_MATERIALS.join(', ')}`
      );
    }
    material = body.material as CommunityPrintMaterial;
  }

  const nozzle = checkOptionalRange(body.nozzleMm, 'nozzleMm');
  if (!nozzle.ok) return validationError('INVALID_SETTINGS', nozzle.message);

  const layerHeight = checkOptionalRange(body.layerHeightMm, 'layerHeightMm');
  if (!layerHeight.ok) return validationError('INVALID_SETTINGS', layerHeight.message);

  const printMinutes = checkOptionalRange(body.printMinutes, 'printMinutes');
  if (!printMinutes.ok) return validationError('INVALID_SETTINGS', printMinutes.message);

  const filament = checkOptionalRange(body.filamentGrams, 'filamentGrams');
  if (!filament.ok) return validationError('INVALID_SETTINGS', filament.message);
  const filamentGrams = filament.value;

  let printer: string | null = null;
  if (body.printer !== undefined && body.printer !== null && body.printer !== '') {
    if (!isString(body.printer) || !isCommunityPrinterId(body.printer)) {
      return validationError('INVALID_PRINTER', 'printer must be a known printer id');
    }
    printer = body.printer;
  }

  // The free-text escape hatch is only readable alongside the 'other'
  // sentinel; carrying it on a known-printer report would let a caller attach
  // arbitrary text to a record that renders a curated label.
  let printerOther = '';
  if (printer === COMMUNITY_PRINTER_OTHER) {
    if (!isString(body.printerOther)) {
      return validationError('INVALID_PRINTER', 'printerOther is required when printer is "other"');
    }
    printerOther = body.printerOther.trim();
    if (printerOther.length < 1 || printerOther.length > COMMUNITY_PRINT_PRINTER_OTHER_MAX_LENGTH) {
      return validationError(
        'INVALID_PRINTER',
        `printerOther must be 1-${COMMUNITY_PRINT_PRINTER_OTHER_MAX_LENGTH} characters`
      );
    }
    // Length cap precedes the filter: its regexes are ReDoS-prone on unbounded input.
    if (!checkText(printerOther).passed) {
      return validationError('CONTENT_BLOCKED', 'printerOther contains prohibited content');
    }
  }

  if (
    !isString(body.fitVerdict) ||
    !(COMMUNITY_PRINT_FIT_VERDICTS as readonly string[]).includes(body.fitVerdict)
  ) {
    return validationError(
      'INVALID_FIT_VERDICT',
      `fitVerdict must be one of: ${COMMUNITY_PRINT_FIT_VERDICTS.join(', ')}`
    );
  }
  const fitVerdict = body.fitVerdict as CommunityPrintFitVerdict;

  let note = '';
  if (body.note !== undefined && body.note !== null) {
    if (!isString(body.note)) {
      return validationError('INVALID_NOTE', 'note must be a string');
    }
    note = body.note.trim();
    if (note.length > COMMUNITY_PRINT_NOTE_MAX_LENGTH) {
      return validationError(
        'INVALID_NOTE',
        `note must be at most ${COMMUNITY_PRINT_NOTE_MAX_LENGTH} characters`
      );
    }
    if (note !== '' && !checkText(note).passed) {
      return validationError('CONTENT_BLOCKED', 'note contains prohibited content');
    }
  }

  const photos: CommunityPrintPhotoEntry[] = [];
  if (body.photos !== undefined && body.photos !== null) {
    if (!Array.isArray(body.photos)) {
      return validationError('INVALID_PHOTOS', 'photos must be an array');
    }
    if (body.photos.length > COMMUNITY_PRINT_MAX_PHOTOS) {
      return validationError(
        'INVALID_PHOTOS',
        `at most ${COMMUNITY_PRINT_MAX_PHOTOS} photos allowed`
      );
    }
    for (let i = 0; i < body.photos.length; i++) {
      const check = checkPhoto(body.photos[i], i);
      if (!check.ok) return validationError('INVALID_PHOTOS', check.message);
      photos.push(check.entry);
    }
  }

  return {
    valid: true,
    payload: {
      authorName,
      material,
      nozzleMm: nozzle.value,
      layerHeightMm: layerHeight.value,
      printMinutes: printMinutes.value,
      filamentGrams,
      printer,
      printerOther,
      fitVerdict,
      note,
      photos,
    },
  };
}

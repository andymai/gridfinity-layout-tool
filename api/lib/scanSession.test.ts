import { describe, it, expect } from 'vitest';
import { isValidScanToken, validateScanSvg, MAX_SCAN_SVG_BYTES } from './scanSession.js';

const VALID_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0 L10 0 L10 10 Z"/></svg>';

describe('isValidScanToken', () => {
  it('accepts a v4 UUID', () => {
    expect(isValidScanToken('3f2504e0-4f89-41d3-9a0c-0305e82c3301')).toBe(true);
  });

  it('rejects non-UUID tokens', () => {
    expect(isValidScanToken('not-a-token')).toBe(false);
    expect(isValidScanToken('')).toBe(false);
    expect(isValidScanToken(123)).toBe(false);
    expect(isValidScanToken('../../etc/passwd')).toBe(false);
  });
});

describe('validateScanSvg', () => {
  it('accepts a well-formed outline SVG', () => {
    const result = validateScanSvg(VALID_SVG);
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.svg).toBe(VALID_SVG);
  });

  it('trims surrounding whitespace', () => {
    const result = validateScanSvg(`\n  ${VALID_SVG}  \n`);
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.svg).toBe(VALID_SVG);
  });

  it('rejects empty or non-string input', () => {
    expect(validateScanSvg('').valid).toBe(false);
    expect(validateScanSvg('   ').valid).toBe(false);
    expect(validateScanSvg(null).valid).toBe(false);
    expect(validateScanSvg(42).valid).toBe(false);
  });

  it('rejects content that is not an SVG', () => {
    expect(validateScanSvg('<html><body>hi</body></html>').valid).toBe(false);
    expect(validateScanSvg('<svg>no closing tag').valid).toBe(false);
  });

  it('rejects oversize payloads', () => {
    const huge = `<svg>${'x'.repeat(MAX_SCAN_SVG_BYTES)}</svg>`;
    const result = validateScanSvg(huge);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.code).toBe('SIZE_LIMIT');
  });

  it('rejects active content (defense-in-depth)', () => {
    const withScript = '<svg xmlns="..."><script>alert(1)</script><path d="M0 0Z"/></svg>';
    const withHandler = '<svg xmlns="..."><path d="M0 0Z" onload="x()"/></svg>';
    const withJsUrl = '<svg xmlns="..."><a href="javascript:x()"/></svg>';
    for (const svg of [withScript, withHandler, withJsUrl]) {
      const result = validateScanSvg(svg);
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.code).toBe('CONTENT_BLOCKED');
    }
  });

  it('rejects external-reference elements and href attributes', () => {
    const withImage = '<svg xmlns="..."><image href="https://x/y.png"/><path d="M0 0Z"/></svg>';
    const withUse = '<svg xmlns="..."><use xlink:href="#a"/><path d="M0 0Z"/></svg>';
    const withHref = '<svg xmlns="..."><a href="https://x"><path d="M0 0Z"/></a></svg>';
    for (const svg of [withImage, withUse, withHref]) {
      const result = validateScanSvg(svg);
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.code).toBe('CONTENT_BLOCKED');
    }
  });
});

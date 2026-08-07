/**
 * A design's name and authorName are attacker-authored and validated only for
 * length plus the content blocklist, neither of which removes control bytes.
 * These fields are printed straight to a moderator's TTY, where an escape
 * sequence can rewrite the screen the operator is deciding from — which design
 * is flagged, which id they are about to purge, whether the DIRECT WRITE banner
 * is even visible.
 */

import { describe, it, expect } from 'vitest';
import { formatTable, sanitizeForTerminal } from '../lib/output.js';

describe('sanitizeForTerminal', () => {
  it('neutralizes a screen-clearing sequence', () => {
    expect(sanitizeForTerminal('\x1b[2J\x1b[1;1HFAKE')).not.toContain('\x1b');
  });

  it('neutralizes a carriage return used to overwrite the current line', () => {
    expect(sanitizeForTerminal('safe\rmalicious')).not.toContain('\r');
  });

  it('neutralizes an OSC 52 clipboard write', () => {
    expect(sanitizeForTerminal('\x1b]52;c;ZXZpbA==\x07')).not.toMatch(/[\x1b\x07]/);
  });

  it('neutralizes C1 control bytes, not just C0', () => {
    expect(sanitizeForTerminal('a\x9bb')).not.toContain('\x9b');
  });

  it('replaces rather than deletes, so tampering stays visible', () => {
    expect(sanitizeForTerminal('a\x1bb')).toBe('a�b');
  });

  it('leaves ordinary text untouched', () => {
    expect(sanitizeForTerminal('Screw Tray (M3) — v2')).toBe('Screw Tray (M3) — v2');
  });
});

describe('formatTable', () => {
  it('sanitizes cell values', () => {
    const table = formatTable(['id', 'name'], [['abc123', '\x1b[2Jgotcha']]);
    expect(table).not.toContain('\x1b');
    expect(table).toContain('gotcha');
  });

  // A control byte counted toward a cell's width but occupied no column, so a
  // crafted name could shift every row below it and make one design's id line
  // up under another's status.
  it('measures width on the sanitized value so columns stay aligned', () => {
    const table = formatTable(
      ['id', 'status'],
      [
        ['aaa', 'live'],
        ['bbb\x1b\x1b\x1b', 'hidden'],
      ]
    );
    const [, first, second] = table.split('\n');
    expect(first.indexOf('live')).toBe(second.indexOf('hidden'));
  });
});

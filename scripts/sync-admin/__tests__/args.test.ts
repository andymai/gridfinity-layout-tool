import { describe, it, expect } from 'vitest';
import { parseArgs } from '../lib/args';

describe('parseArgs', () => {
  it('parses bare command', () => {
    const a = parseArgs(['audit']);
    expect(a.command).toBe('audit');
    expect(a.json).toBe(false);
  });

  it('parses flags and positional', () => {
    const a = parseArgs(['user', 'abc123', '--json', '--strict']);
    expect(a.command).toBe('user');
    expect(a.positional).toEqual(['abc123']);
    expect(a.json).toBe(true);
    expect(a.strict).toBe(true);
  });

  it('parses --kind with validation', () => {
    expect(parseArgs(['audit', '--kind=layouts']).kind).toBe('layouts');
    expect(parseArgs(['audit', '--kind=designs']).kind).toBe('designs');
    expect(() => parseArgs(['audit', '--kind=banana'])).toThrow();
  });

  it('parses --older-than', () => {
    expect(parseArgs(['tombstones', '--older-than=30d']).olderThanMs).toBe(30 * 86400000);
    expect(() => parseArgs(['tombstones', '--older-than=30'])).toThrow();
  });

  it('rejects unknown flags', () => {
    expect(() => parseArgs(['audit', '--banana'])).toThrow(/Unknown flag/);
  });

  it('parses --user', () => {
    expect(parseArgs(['audit', '--user=abc']).user).toBe('abc');
  });

  it('rejects empty --user= to prevent accidental full-production scans', () => {
    expect(() => parseArgs(['audit', '--user='])).toThrow(/cannot be empty/);
  });
});

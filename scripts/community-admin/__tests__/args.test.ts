import { describe, it, expect } from 'vitest';
import { parseArgs } from '../lib/args';

describe('parseArgs', () => {
  it('parses a bare command', () => {
    const a = parseArgs(['list']);
    expect(a.command).toBe('list');
    expect(a.positional).toEqual([]);
    expect(a.json).toBe(false);
    expect(a.yes).toBe(false);
  });

  it('parses positional args and flags together', () => {
    const a = parseArgs(['purge', 'abc123DEF456', '--yes', '--json']);
    expect(a.command).toBe('purge');
    expect(a.positional).toEqual(['abc123DEF456']);
    expect(a.yes).toBe(true);
    expect(a.json).toBe(true);
  });

  it('accepts -y as a short form of --yes', () => {
    expect(parseArgs(['purge', 'abc123DEF456', '-y']).yes).toBe(true);
  });

  it('parses --help and -h', () => {
    expect(parseArgs(['--help']).help).toBe(true);
    expect(parseArgs(['-h']).help).toBe(true);
  });

  it('rejects unknown flags', () => {
    expect(() => parseArgs(['list', '--banana'])).toThrow(/Unknown flag: --banana/);
  });

  it('treats a bare positional after the command as an id, not a second command', () => {
    const a = parseArgs(['inspect', 'abc123DEF456', 'extra']);
    expect(a.command).toBe('inspect');
    expect(a.positional).toEqual(['abc123DEF456', 'extra']);
  });
});

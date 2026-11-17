import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SCRIPT = join(import.meta.dirname, 'release-window.sh');

const at = (iso: string): number => Math.floor(Date.parse(iso) / 1000);

function gate(nowIso: string, lastRelease: string | null): string {
  return execFileSync('bash', [SCRIPT], {
    env: {
      PATH: process.env.PATH,
      NOW: String(at(nowIso)),
      LAST_RELEASE_EPOCH: lastRelease === null ? '' : String(at(lastRelease)),
    },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

describe('release-window.sh', () => {
  it.each([
    ['the first run in the morning window', '2026-11-17T05:23:00Z', '2026-11-16T23:30:00Z'],
    [
      'a late run that still lands in the morning window',
      '2026-11-17T07:59:00Z',
      '2026-11-17T00:10:00Z',
    ],
    ['the evening window', '2026-11-17T23:23:00Z', '2026-11-17T05:30:00Z'],
    [
      'the hour after midnight, before any release in that window',
      '2026-11-18T00:23:00Z',
      '2026-11-17T22:59:00Z',
    ],
    ['a repository that has never released', '2026-11-17T06:23:00Z', null],
  ])('releases for %s', (_label, now, last) => {
    expect(gate(now, last)).toBe('go=true');
  });

  it.each([
    [
      'a second run in a window that already released',
      '2026-11-17T06:23:00Z',
      '2026-11-17T05:30:00Z',
    ],
    [
      'the hour after midnight, when the window released at 23:00',
      '2026-11-18T00:23:00Z',
      '2026-11-17T23:30:00Z',
    ],
    ['the activity peak', '2026-11-17T18:23:00Z', '2026-11-17T05:30:00Z'],
    ['the hour after the morning window', '2026-11-17T08:23:00Z', '2026-11-16T23:30:00Z'],
    [
      'the late morning, with no release yet that day',
      '2026-11-17T09:23:00Z',
      '2026-11-16T23:30:00Z',
    ],
    ['the hour before the evening window', '2026-11-17T22:59:00Z', '2026-11-17T05:30:00Z'],
  ])('holds for %s', (_label, now, last) => {
    expect(gate(now, last)).toBe('go=false');
  });
});

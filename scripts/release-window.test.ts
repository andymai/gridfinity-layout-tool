import { execFileSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const SCRIPT = join(import.meta.dirname, 'release-window.sh');

const at = (iso: string): number => Math.floor(Date.parse(iso) / 1000);

function gate(nowIso: string, releases: string[]): string {
  return execFileSync('bash', [SCRIPT], {
    env: {
      PATH: process.env.PATH,
      NOW: String(at(nowIso)),
      RELEASE_EPOCHS: releases.map((iso) => String(at(iso))).join('\n'),
    },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

describe('release-window.sh', () => {
  it.each([
    ['the first run in the morning window', '2026-11-17T05:23:00Z', ['2026-11-16T23:30:00Z']],
    [
      'a late run that still lands in the morning window',
      '2026-11-17T07:59:00Z',
      ['2026-11-17T00:10:00Z'],
    ],
    ['the evening window', '2026-11-17T23:23:00Z', ['2026-11-17T05:30:00Z']],
    [
      'the hour after midnight, before any release in that window',
      '2026-11-18T00:23:00Z',
      ['2026-11-17T22:59:00Z'],
    ],
    [
      'a new UTC date after two releases the day before',
      '2026-11-18T00:23:00Z',
      ['2026-11-17T00:23:00Z', '2026-11-17T05:23:00Z'],
    ],
    ['a repository that has never released', '2026-11-17T06:23:00Z', []],
  ])('releases for %s', (_label, now, releases) => {
    expect(gate(now, releases)).toBe('go=true');
  });

  it.each([
    [
      'a second run in a window that already released',
      '2026-11-17T06:23:00Z',
      ['2026-11-17T05:30:00Z'],
    ],
    [
      'the hour after midnight, when the window released at 23:00',
      '2026-11-18T00:23:00Z',
      ['2026-11-17T23:30:00Z'],
    ],
    [
      'a third release on one UTC date',
      '2026-11-17T23:23:00Z',
      ['2026-11-17T00:23:00Z', '2026-11-17T05:23:00Z'],
    ],
    ['the activity peak', '2026-11-17T18:23:00Z', ['2026-11-17T05:30:00Z']],
    ['the hour after the morning window', '2026-11-17T08:23:00Z', ['2026-11-16T23:30:00Z']],
    [
      'the late morning, with no release yet that day',
      '2026-11-17T09:23:00Z',
      ['2026-11-16T23:30:00Z'],
    ],
    ['the hour before the evening window', '2026-11-17T22:59:00Z', ['2026-11-17T05:30:00Z']],
  ])('holds for %s', (_label, now, releases) => {
    expect(gate(now, releases)).toBe('go=false');
  });
});

describe('release-window.sh GitHub lookup', () => {
  let dir = '';

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it('reads every page since UTC midnight, so a busy day cannot hide a release', () => {
    dir = mkdtempSync(join(tmpdir(), 'release-window-'));
    const argsFile = join(dir, 'args');
    const releases = [at('2026-11-17T00:23:00Z'), at('2026-11-17T05:23:00Z')].join(' ');
    writeFileSync(
      join(dir, 'gh'),
      `#!/usr/bin/env bash\necho "$@" > "${argsFile}"\nprintf '%s\\n' ${releases}\n`
    );
    chmodSync(join(dir, 'gh'), 0o755);

    const out = execFileSync('bash', [SCRIPT], {
      env: {
        PATH: `${dir}:${process.env.PATH ?? ''}`,
        NOW: String(at('2026-11-17T23:23:00Z')),
        GITHUB_REPOSITORY: 'owner/repo',
      },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();

    expect(out).toBe('go=false');
    const args = readFileSync(argsFile, 'utf8');
    expect(args).toContain('--paginate');
    expect(args).toContain('since=2026-11-17T00:00:00Z');
  });
});

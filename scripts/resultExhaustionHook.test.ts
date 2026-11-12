import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const HOOK = join(import.meta.dirname, '..', '.claude', 'hooks', 'result-exhaustion-check.sh');
const INPUT = JSON.stringify({ tool_input: { command: 'git commit -m test' } });

const repos: string[] = [];

function git(repo: string, ...args: string[]): void {
  execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], {
    cwd: repo,
    stdio: 'ignore',
  });
}

function repo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'result-hook-'));
  repos.push(dir);
  mkdirSync(join(dir, 'src'));
  git(dir, 'init', '-q', '-b', 'main');
  writeFileSync(join(dir, 'src', 'a.ts'), 'export const a = 1;\n');
  writeFileSync(join(dir, 'src', 'b.ts'), 'export const b = 1;\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-qm', 'init');
  return dir;
}

function stage(dir: string, file: string, text: string): void {
  writeFileSync(join(dir, 'src', file), text);
  git(dir, 'add', '.');
}

function blocks(dir: string): boolean {
  return spawnSync('bash', [HOOK], { cwd: dir, input: INPUT }).status === 2;
}

afterEach(() => {
  for (const dir of repos.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('result-exhaustion hook', () => {
  it('blocks an ignored Result call', () => {
    const dir = repo();
    stage(dir, 'a.ts', 'export function f(id: string) {\n  updateBin(id, { x: 1 });\n}\n');
    expect(blocks(dir)).toBe(true);
  });

  it('blocks a discarded conditional expression', () => {
    const dir = repo();
    stage(
      dir,
      'a.ts',
      'export function f(c: boolean, id: string) {\n  c ? updateBin(id, patch) : deleteBin(id);\n}\n'
    );
    expect(blocks(dir)).toBe(true);
  });

  it('allows a method signature in a type', () => {
    const dir = repo();
    stage(
      dir,
      'a.ts',
      'type S = {\n  getState(): { updateBin(id: string, u: object): { ok: boolean } };\n};\n'
    );
    expect(blocks(dir)).toBe(false);
  });

  describe('in a merge commit', () => {
    function mergeWithConflict(): string {
      const dir = repo();
      git(dir, 'checkout', '-q', '-b', 'feat');
      stage(dir, 'a.ts', 'export const a = 2;\n');
      git(dir, 'commit', '-qm', 'feat');
      git(dir, 'checkout', '-q', 'main');
      writeFileSync(join(dir, 'src', 'a.ts'), 'export const a = 3;\n');
      writeFileSync(
        join(dir, 'src', 'b.ts'),
        'export function f(id: string) {\n  updateBin(id, { x: 1 });\n}\n'
      );
      git(dir, 'commit', '-qam', 'main');
      git(dir, 'checkout', '-q', 'feat');
      spawnSync('git', ['merge', 'main'], { cwd: dir, stdio: 'ignore' });
      return dir;
    }

    it('skips the lines the other parent brings in', () => {
      const dir = mergeWithConflict();
      stage(dir, 'a.ts', 'export const a = 4;\n');
      expect(blocks(dir)).toBe(false);
    });

    it('still checks a conflict resolution', () => {
      const dir = mergeWithConflict();
      stage(dir, 'a.ts', 'export function h(id: string) {\n  deleteBin(id);\n}\n');
      expect(blocks(dir)).toBe(true);
    });
  });
});

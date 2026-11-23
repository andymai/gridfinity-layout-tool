import { execFileSync } from 'node:child_process';

type Run = (command: string, args: readonly string[]) => string;

const runGit: Run = (command, args) =>
  execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

/**
 * Whether page dates from git can be trusted. A shallow clone (Vercel's
 * default, CI's checkout) dates every page older than its depth to the oldest
 * commit it has, and the Docker build has no git at all.
 */
export function hasFullGitHistory(run: Run = runGit): boolean {
  try {
    return run('git', ['rev-parse', '--is-shallow-repository']).trim() === 'false';
  } catch {
    return false;
  }
}

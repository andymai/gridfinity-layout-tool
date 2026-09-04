import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

interface VersionInfo {
  version: string;
  gitSha: string;
  buildTime: string;
}

function isoOrNull(value: string | undefined): string | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

function readVersionInfo(): VersionInfo {
  const pkgPath = fileURLToPath(new URL('../package.json', import.meta.url));
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version: string };

  // git may be unavailable in tarball builds or detached environments — fall back gracefully.
  // execFileSync (not execSync) bypasses the shell, so no injection surface despite fixed args.
  // A container build has no .git at all; the Dockerfile passes what it knows as env.
  let gitSha = 'unknown';
  try {
    gitSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf-8' }).trim();
  } catch {
    gitSha = process.env.GIT_SHA || 'unknown';
  }

  // The commit's timestamp, NOT the wall clock. `__BUILD_TIME__` is inlined into
  // smokeBoot, so a per-build value gave that chunk a fresh hash every time —
  // and Rolldown propagates a changed hash to every chunk that references it,
  // which churned ~24% of the bundle between byte-identical builds. Users then
  // re-download unchanged code on every deploy. Same commit now means the same
  // output. The value still identifies the deployed build for the smoke gate.
  let buildTime: string | null = null;
  try {
    buildTime = new Date(
      execFileSync('git', ['log', '-1', '--format=%cI'], { encoding: 'utf-8' }).trim()
    ).toISOString();
  } catch {
    buildTime = isoOrNull(process.env.GIT_COMMIT_TIME);
  }

  return {
    version: pkg.version,
    gitSha,
    buildTime: buildTime ?? new Date().toISOString(),
  };
}

/**
 * Emits dist/version.json at build time and exposes __APP_VERSION__ / __GIT_SHA__ /
 * __BUILD_TIME__ as compile-time defines. Used by the PWA update smoke gate to
 * identify deployed versions and verify post-promote freshness.
 */
export function versionPlugin(): Plugin {
  let info: VersionInfo;

  return {
    name: 'gridfinity:version',
    config() {
      info = readVersionInfo();
      return {
        define: {
          __APP_VERSION__: JSON.stringify(info.version),
          __GIT_SHA__: JSON.stringify(info.gitSha),
          __BUILD_TIME__: JSON.stringify(info.buildTime),
        },
      };
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify(info, null, 2) + '\n',
      });
    },
  };
}

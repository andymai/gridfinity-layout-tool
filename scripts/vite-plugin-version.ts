import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

interface VersionInfo {
  version: string;
  gitSha: string;
  buildTime: string;
}

function readVersionInfo(): VersionInfo {
  const pkgPath = fileURLToPath(new URL('../package.json', import.meta.url));
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version: string };

  // git may be unavailable in tarball builds or detached environments — fall back gracefully.
  // execFileSync (not execSync) bypasses the shell, so no injection surface despite fixed args.
  let gitSha = 'unknown';
  try {
    gitSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf-8' }).trim();
  } catch {
    // ignore
  }

  return {
    version: pkg.version,
    gitSha,
    buildTime: new Date().toISOString(),
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

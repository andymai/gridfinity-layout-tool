import { execFileSync } from 'node:child_process';
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Plugin } from 'vite';
import { versionPlugin } from './vite-plugin-version';

type Defines = Record<string, string>;

/** Invoke the plugin's `config` hook, which may be a bare function or an object hook. */
function defines(plugin: Plugin): Defines {
  const hook = plugin.config;
  const handler = typeof hook === 'function' ? hook : hook?.handler;
  if (!handler) throw new Error('versionPlugin lost its config hook');
  const result = handler.call(
    // The hook reads nothing off `this`, and neither arg is used.
    null as never,
    {} as never,
    { command: 'build', mode: 'production' } as never
  );
  const config = result as { define: Defines } | undefined;
  if (!config?.define) throw new Error('config hook returned no defines');
  return config.define;
}

// The plugin deliberately tolerates a missing git (tarball builds, minimal
// images), so the suite that depends on a real checkout has to tolerate it too.
const HAS_GIT = ((): boolean => {
  try {
    execFileSync('git', ['rev-parse', '--git-dir'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

describe.skipIf(!HAS_GIT)('versionPlugin in a git checkout', () => {
  it('derives __BUILD_TIME__ from the commit, not the wall clock', () => {
    const commitIso = new Date(
      execFileSync('git', ['log', '-1', '--format=%cI'], { encoding: 'utf-8' }).trim()
    ).toISOString();

    expect(defines(versionPlugin()).__BUILD_TIME__).toBe(JSON.stringify(commitIso));
  });

  // The regression this guards: a wall-clock build time gave smokeBoot a fresh
  // hash on every build, and Rolldown propagated that to every chunk
  // referencing it — ~24% of the bundle re-downloaded per deploy for unchanged
  // code. Two builds of one commit must produce identical defines.
  it('is stable across repeated builds of the same commit', () => {
    expect(defines(versionPlugin()).__BUILD_TIME__).toBe(defines(versionPlugin()).__BUILD_TIME__);
  });

  it('exposes the commit sha and package version alongside it', () => {
    const d = defines(versionPlugin());
    const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf-8' }).trim();

    expect(d.__GIT_SHA__).toBe(JSON.stringify(sha));
    expect(d.__APP_VERSION__).toMatch(/^"\d+\.\d+\.\d+"$/);
  });
});

describe('versionPlugin without git', () => {
  afterEach(() => {
    vi.doUnmock('node:child_process');
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  async function pluginWithoutGit(): Promise<() => Plugin> {
    vi.resetModules();
    vi.doMock('node:child_process', () => ({
      execFileSync: () => {
        throw new Error('git: command not found');
      },
    }));
    const { versionPlugin: plugin } = await import('./vite-plugin-version');
    return plugin;
  }

  it('still builds, falling back to the wall clock and an unknown sha', async () => {
    vi.stubEnv('GIT_SHA', '');
    vi.stubEnv('GIT_COMMIT_TIME', '');
    const d = defines((await pluginWithoutGit())());

    expect(d.__GIT_SHA__).toBe(JSON.stringify('unknown'));
    expect(d.__APP_VERSION__).toMatch(/^"\d+\.\d+\.\d+"$/);
    // A real ISO instant, just not a reproducible one — the documented tradeoff.
    expect(Number.isNaN(Date.parse(JSON.parse(d.__BUILD_TIME__) as string))).toBe(false);
  });

  it('takes the sha and commit time from the environment, as a container build passes them', async () => {
    vi.stubEnv('GIT_SHA', 'abc123');
    vi.stubEnv('GIT_COMMIT_TIME', '2026-09-03T10:00:00+02:00');
    const d = defines((await pluginWithoutGit())());

    expect(d.__GIT_SHA__).toBe(JSON.stringify('abc123'));
    expect(d.__BUILD_TIME__).toBe(JSON.stringify('2026-09-03T08:00:00.000Z'));
  });

  it('ignores an unparseable commit time instead of failing the build', async () => {
    vi.stubEnv('GIT_SHA', '');
    vi.stubEnv('GIT_COMMIT_TIME', 'not a date');
    const d = defines((await pluginWithoutGit())());

    expect(Number.isNaN(Date.parse(JSON.parse(d.__BUILD_TIME__) as string))).toBe(false);
  });
});

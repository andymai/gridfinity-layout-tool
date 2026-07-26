import { execFileSync } from 'node:child_process';
import { describe, it, expect } from 'vitest';
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

describe('versionPlugin', () => {
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

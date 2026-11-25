import { describe, expect, it } from 'vitest';
import { nonFatal, skipReason } from './vite-plugin-posthog-sourcemaps';

describe('skipReason', () => {
  const keys = { POSTHOG_API_KEY: 'phx_test', POSTHOG_PROJECT_ID: '1' };

  it('uploads only from a production deploy with both keys', () => {
    expect(skipReason({ ...keys, VERCEL_ENV: 'production' })).toBeNull();
  });

  it('skips a local build, even with the keys from .env.local', () => {
    expect(skipReason(keys)).toBe('this is not a production deploy');
  });

  it('skips without the key, even on a production deploy', () => {
    expect(skipReason({ POSTHOG_PROJECT_ID: '1', VERCEL_ENV: 'production' })).toBe(
      'POSTHOG_API_KEY is not set'
    );
    expect(skipReason({ POSTHOG_API_KEY: '', POSTHOG_PROJECT_ID: '1' })).toBe(
      'POSTHOG_API_KEY is not set'
    );
    expect(skipReason({})).toBe('POSTHOG_API_KEY is not set');
  });

  it('skips without the project id, or on a preview', () => {
    expect(skipReason({ POSTHOG_API_KEY: 'phx_test' })).toBe('POSTHOG_PROJECT_ID is not set');
    expect(skipReason({ ...keys, VERCEL_ENV: 'preview' })).toBe('this is not a production deploy');
  });
});

describe('nonFatal', () => {
  it('turns a failed hook into a warning, and skips the hooks after it', async () => {
    const calls: string[] = [];
    const warnings: string[] = [];
    const plugin = nonFatal(
      {
        renderChunk: {
          order: 'post',
          handler: () => {
            calls.push('render');
            throw new Error('release resolve failed');
          },
        },
        writeBundle: () => {
          calls.push('write');
        },
      },
      (message) => warnings.push(message)
    );

    expect(plugin.renderChunk.order).toBe('post');
    await expect(plugin.renderChunk.handler()).resolves.toBeNull();
    await expect(plugin.writeBundle()).resolves.toBeNull();
    expect(calls).toEqual(['render']);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('release resolve failed');
  });

  it('passes results through when nothing fails', async () => {
    const plugin = nonFatal({ renderChunk: () => 'code' }, () => undefined);
    await expect(plugin.renderChunk()).resolves.toBe('code');
  });
});
